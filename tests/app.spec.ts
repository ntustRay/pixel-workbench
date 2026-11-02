import { test, expect } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFile } from "node:fs/promises";

test("demo creates a real transparent sticker and downloads an image and batch ZIP", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (
      !request.url().startsWith("http://127.0.0.1:4173") &&
      !request.url().startsWith("blob:")
    )
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
    page.getByRole("heading", { name: "好作品，從這張開始。" }),
  ).toBeVisible();
  await expect(download).toBeDisabled();
});

test("reports invalid inputs without adding broken files", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("選擇圖片", { exact: true })
    .setInputFiles({
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
