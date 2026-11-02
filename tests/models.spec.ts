import { test, expect } from "@playwright/test";

// 下載官方公開測試圖；圖片只在測試記憶體內，沒有上傳或納入原始碼。
test("real MediaPipe models run in the worker: portrait alpha, face mosaic, avatar and local-only requests", async ({
  page,
  request,
}) => {
  const fixture = await request.get(
    "https://storage.googleapis.com/mediapipe-assets/portrait.jpg",
  );
  expect(fixture.ok()).toBe(true);
  const bytes = await fixture.body();
  const outgoing: string[] = [];
  const errors: string[] = [];
  page.on("request", (req) => {
    if (
      !req.url().startsWith("http://127.0.0.1:4173") &&
      !req.url().startsWith("blob:")
    )
      outgoing.push(req.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByLabel("選擇圖片", { exact: true })
    .setInputFiles({
      name: "portrait.jpg",
      mimeType: "image/jpeg",
      buffer: bytes,
    });
  await page.getByRole("button", { name: "套用處理", exact: true }).click();
  await expect(page.getByRole("status", { name: "處理狀態" })).toContainText(
    "處理完成",
    { timeout: 60_000 },
  );
  const alpha = await page
    .getByAltText("處理結果", { exact: true })
    .evaluate(async (image: HTMLImageElement) => {
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const c = canvas.getContext("2d")!;
      c.drawImage(image, 0, 0);
      const data = c.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparent = 0,
        opaque = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < 15) transparent++;
        if (data[i] > 240) opaque++;
      }
      return { transparent, opaque, total: data.length / 4 };
    });
  expect(alpha.transparent / alpha.total).toBeGreaterThan(0.1);
  expect(alpha.opaque / alpha.total).toBeGreaterThan(0.1);
  await page.getByRole("button", { name: "人臉馬賽克", exact: false }).click();
  await page.getByRole("button", { name: "套用處理", exact: true }).click();
  await expect(page.getByRole("status", { name: "處理狀態" })).toContainText(
    "偵測到 1 張人臉",
  );
  await expect(page.getByRole("note")).toContainText("逐一檢查");
  await page.getByRole("button", { name: "頭像裁切", exact: false }).click();
  await page.getByRole("button", { name: "套用處理", exact: true }).click();
  await expect(page.getByRole("status", { name: "處理狀態" })).toContainText(
    "偵測到 1 張人臉",
  );
  const dimensions = await page
    .getByAltText("處理結果", { exact: true })
    .evaluate(async (image: HTMLImageElement) => {
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    });
  expect(dimensions[0]).toBe(dimensions[1]);
  expect(errors).toEqual([]);
  expect(outgoing).toEqual([]);
});
