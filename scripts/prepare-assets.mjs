import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = join(root, "node_modules", "@mediapipe", "tasks-vision");
const wasmTarget = join(root, "public", "wasm");
const modelsTarget = join(root, "public", "models");
const models = [
  {
    file: "selfie_segmenter.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
    sha256: "191ac9529ae506ee0beefa6b2c945a172dab9d07d1e802a290a4e4038226658b",
  },
  {
    file: "blaze_face_short_range.tflite",
    url: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
    sha256: "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f",
  },
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function prepareModel(model) {
  const destination = join(modelsTarget, model.file);
  try {
    if (sha256(await readFile(destination)) === model.sha256) {
      console.log(`Verified cached model: ${model.file}`);
      return;
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  console.log(`Downloading official model: ${model.file}`);
  const response = await fetch(model.url, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${model.file}: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (sha256(bytes) !== model.sha256) {
    throw new Error(
      `${model.file}: SHA256 mismatch; refusing to install changed model.`,
    );
  }
  // 先驗證再原子替換，避免下載中斷留下貌似有效的模型。
  const temporary = `${destination}.download`;
  await writeFile(temporary, bytes);
  await rename(temporary, destination);
  console.log(
    `Verified ${model.file}: ${bytes.byteLength.toLocaleString()} bytes`,
  );
}

try {
  const packageJson = JSON.parse(
    await readFile(join(packageRoot, "package.json"), "utf8"),
  );
  if (packageJson.version !== "0.10.32") {
    throw new Error(
      `Expected @mediapipe/tasks-vision 0.10.32; found ${packageJson.version}. Revalidate the ESM loader before upgrading.`,
    );
  }
  await mkdir(wasmTarget, { recursive: true });
  await mkdir(modelsTarget, { recursive: true });
  for (const name of ["vision_wasm_internal", "vision_wasm_nosimd_internal"]) {
    const loader = await readFile(
      join(packageRoot, "wasm", `${name}.js`),
      "utf8",
    );
    // MediaPipe 0.10.32 的 loader 為 classic script。保留原始內容並附加
    // ESM export，使 module worker 可載入；不使用 eval 或 CDN 執行碼。
    // 原 loader 的 custom_dbg 使用 Annex B 區塊函式外溢，ESM strict mode
    // 不提供該行為，因此明確提供同等的 module-level logger。
    await writeFile(
      join(wasmTarget, `${name}.mjs`),
      `// MediaPipe 0.10.32 WASM loader; Apache-2.0. ESM bridge added by Pixel Workbench.\nconst custom_dbg = (...messages) => console.warn(...messages);\n${loader}\nexport default ModuleFactory;\n`,
      "utf8",
    );
    await copyFile(
      join(packageRoot, "wasm", `${name}.wasm`),
      join(wasmTarget, `${name}.wasm`),
    );
  }
  await Promise.all(models.map(prepareModel));
  const summary = await Promise.all(
    models.map(async (model) => ({
      file: model.file,
      sha256: model.sha256,
      bytes: (await stat(join(modelsTarget, model.file))).size,
    })),
  );
  console.log(
    "Image assets ready. Models and WASM are served from this app; photos are never uploaded.",
  );
  for (const model of summary)
    console.log(`${model.file}: ${model.bytes} bytes; SHA256 ${model.sha256}`);
} catch (error) {
  console.error("Asset preparation failed:", error.message);
  console.error(
    "Check your connection, then run npm run assets:prepare again. No credential is required.",
  );
  process.exitCode = 1;
}
