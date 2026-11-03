import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFile } from "node:fs/promises";

test("demo creates a real transparent sticker and downloads an image and batch ZIP", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("測試必須設定 baseURL。");
  const appOrigin = new URL(baseURL).origin;
  const external: string[] = [];
  page.on("request", (request) => {
    // URL.origin 同時處理 blob 網址；只接受目前網站的確切 origin。
    if (new URL(request.url()).origin !== appOrigin)
      external.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "先用範例做張貼紙" }).click();
  await expect(page.getByRole("status", { name: "處理狀態" })).toContainText(
    "處理完成",
  );
  const download = page.getByRole("button", { name: "下載圖片", exact: true });
  await expect(download).toBeEnabled();
  const [image] = await Promise.all([
    page.waitForEvent("download"),
    download.click(),
  ]);
  expect(image.suggestedFilename()).toBe("grow-slow-sticker.png");
  const imageBytes = await readFile((await image.path())!);
  expect([...imageBytes.slice(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);

  await page.getByLabel("外框粗細").fill("20");
  await expect(download).toBeDisabled();
  await expect(page.getByText("設定已變更 · 請套用處理")).toBeVisible();
  await page.getByRole("button", { name: "套用處理", exact: true }).click();
  await expect(download).toBeEnabled();
  const [zip] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "批次處理並下載 ZIP" }).click(),
  ]);
  const entries = unzipSync(
    new Uint8Array(await readFile((await zip.path())!)),
  );
  expect(Object.keys(entries)).toEqual(["01-grow-slow-sticker.png"]);
  expect(external).toEqual([]);
  await page.getByRole("button", { name: "移除 grow-slow.png" }).click();
  await expect(
    page.getByRole("heading", { name: "加入要處理的圖片" }),
  ).toBeVisible();
  await expect(download).toBeDisabled();
});

test("reports invalid inputs without adding broken files", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("選擇圖片", { exact: true }).setInputFiles({
    name: "bad.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a valid image"),
  });
  await expect(page.getByRole("alert")).toContainText("無法讀取圖片");
  await expect(
    page.getByRole("button", { name: "套用處理", exact: true }),
  ).toBeDisabled();
});

test("mobile layout keeps tools, editing and downloads usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "先用範例做張貼紙" }).click();
  await expect(page.getByRole("status", { name: "處理狀態" })).toContainText(
    "處理完成",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "下載圖片", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "並排比較", exact: true }).click();
  await expect(page.getByAltText("處理前的原圖")).toBeVisible();
  await expect(page.getByAltText("處理後的圖片")).toBeVisible();
});

test("chains crop, adjustments and a watermark while retaining the original images", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "瀏覽器圖片工具" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "先用範例做張貼紙" }).click();
  const apply = page.getByRole("button", { name: "套用處理", exact: true });
  const download = page.getByRole("button", { name: "下載圖片", exact: true });
  await expect(download).toBeEnabled();
  await page.getByRole("button", { name: "接續編輯", exact: true }).click();
  await expect(page.locator(".thumbnail")).toHaveCount(2);
  await expect(page.getByRole("status", { name: "處理狀態" })).toContainText(
    "原圖仍保留",
  );

  await page.getByRole("button", { name: "裁切與旋轉", exact: true }).click();
  await page.getByLabel("裁切比例", { exact: true }).selectOption("16:9");
  await page.getByRole("button", { name: "90°", exact: true }).click();
  await page.getByLabel("水平翻轉", { exact: true }).check();
  await apply.click();
  await expect(download).toBeEnabled();
  await page.getByRole("button", { name: "接續編輯", exact: true }).click();
  await expect(page.locator(".thumbnail")).toHaveCount(3);
  await page.getByRole("button", { name: "色彩與銳化", exact: true }).click();
  await page.getByLabel("黑白照片", { exact: true }).check();
  await page.getByLabel("銳化程度", { exact: true }).fill("30");
  await apply.click();
  await expect(download).toBeEnabled();
  await page.getByRole("button", { name: "接續編輯", exact: true }).click();
  await expect(page.locator(".thumbnail")).toHaveCount(4);
  await page.getByRole("button", { name: "文字浮水印", exact: true }).click();
  await apply.click();
  await expect(page.getByRole("alert")).toContainText("浮水印文字");
  await page.getByLabel("浮水印文字", { exact: true }).fill("MingRay 測試");
  await page.getByLabel("文字位置", { exact: true }).selectOption("center");
  await apply.click();
  await expect(download).toBeEnabled();
  await page.getByLabel("文字不透明度", { exact: true }).fill("70");
  await expect(download).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "接續編輯", exact: true }),
  ).toBeDisabled();
  await apply.click();
  await expect(download).toBeEnabled();
  const [zip] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "批次處理並下載 ZIP" }).click(),
  ]);
  await page.screenshot({ path: test.info().outputPath("desktop-watermark.png"), fullPage: true });
  const entries = unzipSync(
    new Uint8Array(await readFile((await zip.path())!)),
  );
  expect(Object.keys(entries)).toHaveLength(4);
  expect(
    Object.keys(entries).every((name) => name.endsWith("watermark.png")),
  ).toBe(true);
});

test("new controls remain usable on a phone without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  for (const name of ["裁切與旋轉", "色彩與銳化", "文字浮水印"]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel("浮水印文字", { exact: true }).fill("測試文字");
  await expect(page.getByLabel("浮水印文字", { exact: true })).toBeInViewport();
});

test("accepts pasted image files through the same input validation", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 40;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((blob) => resolve(blob!)),
    );
    const data = new DataTransfer();
    data.items.add(new File([blob], "pasted.png", { type: "image/png" }));
    document
      .querySelector("main")!
      .dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: data, bubbles: true }),
      );
  });
  await expect(
    page.getByRole("button", { name: "選取 pasted.png", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "處理狀態" })).toContainText(
    "已加入 1 張圖片",
  );
});
