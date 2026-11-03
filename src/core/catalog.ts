import type { Capability, ToolId } from "./types";

// 僅提供介面所需資料；不要讓 UI 匯入推論或 Canvas 實作。
export interface ToolInfo {
  id: ToolId;
  label: string;
  short: string;
  description: string;
  capabilities: readonly Capability[];
}

export const TOOLS: readonly ToolInfo[] = [
  {
    id: "background",
    label: "人像去背",
    short: "背景",
    description: "移除人像背景，或替換底色、虛化背景。",
    capabilities: ["portrait-mask"],
  },
  {
    id: "sticker",
    label: "貼紙效果",
    short: "貼紙",
    description: "替透明圖片或去背人像加入描邊與陰影。",
    capabilities: [],
  },
  {
    id: "privacy",
    label: "人臉馬賽克",
    short: "馬賽克",
    description: "偵測近距離人臉並套用馬賽克。",
    capabilities: ["faces"],
  },
  {
    id: "avatar",
    label: "頭像裁切",
    short: "頭像",
    description: "依最大的人臉位置裁切頭像。",
    capabilities: ["faces"],
  },
  {
    id: "crop",
    label: "裁切與旋轉",
    short: "裁切",
    description: "依比例裁切、調整位置，旋轉或翻轉圖片。",
    capabilities: [],
  },
  {
    id: "adjust",
    label: "色彩與銳化",
    short: "調色",
    description: "調整對比、飽和度、黑白與銳化程度。",
    capabilities: [],
  },
  {
    id: "watermark",
    label: "文字浮水印",
    short: "浮水印",
    description: "加入文字，設定位置、顏色、大小與透明度。",
    capabilities: [],
  },
  {
    id: "export",
    label: "尺寸與轉檔",
    short: "轉檔",
    description: "調整尺寸與格式，一次整理多張。",
    capabilities: [],
  },
];
