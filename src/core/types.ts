export type ToolId = "background" | "sticker" | "privacy" | "avatar" | "export";
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type Capability = "portrait-mask" | "faces";

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
