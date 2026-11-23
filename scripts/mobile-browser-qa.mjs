import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, devices, webkit } from "@playwright/test";
import { unzipSync } from "fflate";

const engine = process.argv[2];
const appUrl = process.env.QA_APP_URL || "http://127.0.0.1:4173";
assert(["chromium", "webkit"].includes(engine), "Choose chromium or webkit.");
const browser = await (engine === "chromium" ? chromium : webkit).launch();
const work = await mkdtemp(join(tmpdir(), "pixel-mobile-qa-"));
const inputs = [];
const count = 20;

function processTreeRss(pid) {
  try {
    const status = readFileSync("/proc/" + pid + "/status", "utf8");
    const rss = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0);
    const active = readFileSync("/proc/" + pid + "/task/" + pid + "/children", "utf8");
    return rss + active.trim().split(/\s+/).filter(Boolean)
      .reduce((sum, child) => sum + processTreeRss(Number(child)), 0);
  } catch {
    return 0;
  }
}

try {
  const fixture = await browser.newPage();
  let bytesIn = 0;
  for (let i = 1; i <= count; i++) {
    const encoded = await fixture.evaluate((index) => {
      if (!window.fixtureCanvas) {
        const canvas = document.createElement("canvas");
        canvas.width = 2400;
        canvas.height = 1800;
        const context = canvas.getContext("2d");
        const noisy = context.createImageData(canvas.width, canvas.height);
        let seed = 1039;
        for (let offset = 0; offset < noisy.data.length; offset += 4) {
          seed ^= seed << 13;
          seed ^= seed >>> 17;
          seed ^= seed << 5;
          noisy.data[offset] = seed & 255;
          noisy.data[offset + 1] = (seed >>> 8) & 255;
          noisy.data[offset + 2] = (seed >>> 16) & 255;
          noisy.data[offset + 3] = 255;
        }
        context.putImageData(noisy, 0, 0);
        window.fixtureCanvas = canvas;
      }
      const canvas = window.fixtureCanvas;
      const context = canvas.getContext("2d");
      context.fillStyle = "#fefefe";
      context.fillRect(16, 16, 290, 150);
      context.fillStyle = "#152016";
      context.font = "bold 52px sans-serif";
      context.fillText("QA " + index, 44, 105);
      return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    }, i);
    const file = join(work, "sample-" + String(i).padStart(2, "0") + ".jpg");
    const image = Buffer.from(encoded, "base64");
    bytesIn += image.byteLength;
    await writeFile(file, image);
    inputs.push(file);
  }
  await fixture.close();

  const page = await browser.newPage({ ...devices["iPhone 15"], acceptDownloads: true });
  const errors = [];
  const requests = new Set();
  const downloads = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const origin = new URL(request.url()).origin;
    if (origin !== "null") requests.add(origin);
  });
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  const response = await page.goto(appUrl);
  assert.equal(response?.status(), 200);
  await page.getByLabel("選擇圖片", { exact: true }).setInputFiles(inputs);
  await page.getByRole("status", { name: "處理狀態" })
    .filter({ hasText: "已加入 20 張圖片" }).waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: /尺寸與轉檔/ }).first().click();
  await page.locator("select").filter({ has: page.locator('option[value="image/jpeg"]') })
    .selectOption("image/jpeg");

  const batch = page.getByRole("button", { name: "批次處理並下載 ZIP" });
  const cancel = page.getByRole("button", { name: "取消處理", exact: true });
  await batch.click();
  await cancel.click();
  await page.getByRole("status", { name: "處理狀態" })
    .filter({ hasText: "已取消處理" }).waitFor();
  assert.equal(downloads.length, 0, "Cancellation cannot start a ZIP download.");

  const baselineRss = processTreeRss(process.pid);
  let peakRss = baselineRss;
  const monitor = setInterval(() => {
    peakRss = Math.max(peakRss, processTreeRss(process.pid));
  }, 150);
  const start = performance.now();
  let download;
  try {
    [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 120000 }),
      batch.click(),
    ]);
  } catch (error) {
    console.error("Pixel status:", await page.getByRole("status").allTextContents());
    console.error("Pixel alerts:", await page.getByRole("alert").allTextContents());
    console.error("Page errors:", errors);
    throw error;
  } finally {
    clearInterval(monitor);
  }
  await page.getByRole("status", { name: "處理狀態" })
    .filter({ hasText: "20 張圖片已打包為 ZIP" }).waitFor();
  assert.equal(download.suggestedFilename(), "pixel-workbench-export.zip");
  assert.equal(await download.failure(), null);
  const zip = await readFile(await download.path());
  const entries = Object.entries(unzipSync(zip));
  assert.equal(entries.length, count);
  const hashes = new Set();
  for (const [i, [name, jpg]] of entries.entries()) {
    const number = String(i + 1).padStart(2, "0");
    assert.equal(name, number + "-sample-" + number + "-export.jpg");
    assert(jpg.length > 10000);
    assert.deepEqual([...jpg.slice(0, 2)], [0xff, 0xd8]);
    assert.deepEqual([...jpg.slice(-2)], [0xff, 0xd9]);
    hashes.add(createHash("sha256").update(jpg).digest("hex"));
  }
  assert.equal(hashes.size, count);
  assert.equal(downloads.length, 1);
  assert.deepEqual([...requests], [new URL(appUrl).origin]);
  assert.deepEqual(errors, []);
  const viewport = await page.evaluate(() => ({
    inner: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  assert(viewport.content <= viewport.inner, JSON.stringify(viewport));
  console.log("QA_RESULT", JSON.stringify({
    app: "Pixel Workbench", engine, version: browser.version(), mobileProfile: "iPhone 15",
    inputResolution: "2400x1800", files: entries.length, uniqueOutputs: hashes.size,
    inputBytes: bytesIn, zipBytes: zip.byteLength, elapsedMs: Math.round(performance.now() - start),
    testProcessTreeRssMiB: { before: Math.round(baselineRss / 1024), peak: Math.round(peakRss / 1024) },
    canceledThenRetried: true, onlySameOriginRequests: true, viewport,
  }));
} finally {
  await browser.close();
  await rm(work, { recursive: true, force: true });
}
