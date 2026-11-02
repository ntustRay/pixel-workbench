import type { EditSettings, PipelineResult } from "./types";

export interface SourceImage {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
}

export const MAX_FILES = 20;
export const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function validateFile(file: Pick<File, "type" | "size" | "name">): void {
  if (!MIME_TYPES.has(file.type))
    throw new Error(`${file.name}：請使用 JPG、PNG 或 WebP。`);
  if (file.size > MAX_FILE_BYTES)
    throw new Error(`${file.name}：單張圖片上限為 30 MB。`);
  if (file.size === 0)
    throw new Error(`${file.name}：檔案是空的，請重新選擇。`);
}

export async function readSource(file: File): Promise<SourceImage> {
  validateFile(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(`${file.name}：無法讀取圖片，請檢查檔案是否完整。`);
  }
  const { width, height } = bitmap;
  bitmap.close();
  if (width * height > 40_000_000)
    throw new Error(`${file.name}：圖片超過 4,000 萬像素，請先縮小。`);
  return {
    id: crypto.randomUUID(),
    file,
    url: URL.createObjectURL(file),
    width,
    height,
  };
}

export function outputName(
  original: string,
  settings: EditSettings,
  index?: number,
): string {
  const extension = settings.format.split("/")[1].replace("jpeg", "jpg");
  const safe =
    original
      .replace(/\.[^.]+$/, "")
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .slice(0, 80) || "image";
  return `${index === undefined ? "" : `${String(index + 1).padStart(2, "0")}-`}${safe}-${settings.tool}.${extension}`;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

// 串流 ZIP，避免一次持有全部輸出圖片的像素或未壓縮副本。
export async function archiveResults(
  sources: SourceImage[],
  settings: EditSettings,
  process: (source: SourceImage) => Promise<PipelineResult>,
  onProgress: (current: number, total: number) => void,
  signal: AbortSignal,
): Promise<{ blob: Blob; warnings: string[] }> {
  const { Zip, ZipPassThrough } = await import("fflate");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  const warnings: string[] = [];
  let rejectZip: (reason: unknown) => void = () => {};
  const complete = new Promise<Blob>((resolve, reject) => {
    rejectZip = reject;
    const zip = new Zip((error, data, final) => {
      if (error) {
        reject(error);
        return;
      }
      if (data) chunks.push(new Uint8Array(data));
      if (final) resolve(new Blob(chunks, { type: "application/zip" }));
    });
    void (async () => {
      try {
        for (let index = 0; index < sources.length; index++) {
          signal.throwIfAborted();
          onProgress(index + 1, sources.length);
          const result = await process(sources[index]);
          signal.throwIfAborted();
          const entry = new ZipPassThrough(
            outputName(sources[index].file.name, settings, index),
          );
          zip.add(entry);
          entry.push(new Uint8Array(await result.blob.arrayBuffer()), true);
          warnings.push(
            ...result.warnings.map(
              (warning) => `${sources[index].file.name}：${warning}`,
            ),
          );
        }
        zip.end();
      } catch (error) {
        zip.terminate();
        rejectZip(error);
      }
    })();
  });
  return { blob: await complete, warnings };
}
