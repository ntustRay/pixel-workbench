export type ToolId =
  | "background"
  | "sticker"
  | "privacy"
  | "avatar"
  | "crop"
  | "adjust"
  | "watermark"
  | "export";
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type Capability = "portrait-mask" | "faces";
export const CROP_RATIOS = [
  "original",
  "1:1",
  "4:5",
  "3:4",
  "16:9",
  "9:16",
] as const;
export type CropRatio = (typeof CROP_RATIOS)[number];
export const ROTATIONS = [0, 90, 180, 270] as const;
export const WATERMARK_POSITIONS = [
  "top-left",
  "top-right",
  "center",
  "bottom-left",
  "bottom-right",
] as const;

export interface EditSettings {
  tool: ToolId;
  backgroundMode: "transparent" | "color" | "blur";
  backgroundColor: string;
  blur: number;
  outline: number;
  outlineColor: string;
  shadow: number;
  usePortraitMask: boolean;
  pixelSize: number;
  avatarRatio: "1:1" | "4:5" | "3:4";
  cropRatio: CropRatio;
  cropX: number;
  cropY: number;
  rotation: (typeof ROTATIONS)[number];
  flipHorizontal: boolean;
  flipVertical: boolean;
  contrast: number;
  saturation: number;
  grayscale: boolean;
  sharpen: number;
  watermarkText: string;
  watermarkColor: string;
  watermarkOpacity: number;
  watermarkSize: number;
  watermarkPosition: (typeof WATERMARK_POSITIONS)[number];
  exposure: number;
  format: OutputFormat;
  quality: number;
  maxEdge: number;
}

export const DEFAULT_SETTINGS: EditSettings = {
  tool: "background",
  backgroundMode: "transparent",
  backgroundColor: "#b9d8ee",
  blur: 18,
  outline: 12,
  outlineColor: "#ffffff",
  shadow: 18,
  usePortraitMask: true,
  pixelSize: 18,
  avatarRatio: "1:1",
  cropRatio: "original",
  cropX: 50,
  cropY: 50,
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  contrast: 0,
  saturation: 0,
  grayscale: false,
  sharpen: 0,
  watermarkText: "",
  watermarkColor: "#ffffff",
  watermarkOpacity: 0.6,
  watermarkSize: 5,
  watermarkPosition: "bottom-right",
  exposure: 0,
  format: "image/png",
  quality: 0.88,
  maxEdge: 2400,
};

export interface PortraitMask {
  width: number;
  height: number;
  alpha: Uint8ClampedArray;
}
export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}
export interface AnalysisProvider {
  portrait(image: ImageBitmap): Promise<PortraitMask>;
  faces(image: ImageBitmap): Promise<FaceBox[]>;
}
export interface PipelineResult {
  blob: Blob;
  width: number;
  height: number;
  faces: number;
  warnings: string[];
}
export interface ToolDefinition {
  id: ToolId;
  label: string;
  short: string;
  description: string;
  capabilities: readonly Capability[];
  run(
    image: ImageBitmap,
    settings: EditSettings,
    analysis: AnalysisProvider,
  ): Promise<OffscreenCanvas>;
}

export interface ProcessRequest {
  type: "process";
  id: number;
  sourceId: string;
  bitmap: ImageBitmap;
  settings: EditSettings;
  assetBase: string;
}
export type WorkerReply =
  | { type: "progress"; id: number; message: string }
  | { type: "result"; id: number; result: PipelineResult }
  | { type: "error"; id: number; message: string };
