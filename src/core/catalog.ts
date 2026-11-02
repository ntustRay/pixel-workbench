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
    description: "留下主角，換一個好背景。",
    capabilities: ["portrait-mask"],
  },
  {
    id: "sticker",
    label: "貼紙效果",
    short: "貼紙",
    description: "描邊、柔和陰影，變成自己的貼紙。",
    capabilities: [],
  },
  {
    id: "privacy",
    label: "人臉馬賽克",
    short: "馬賽克",
    description: "自動尋找人臉，保留分享的分寸。",
    capabilities: ["faces"],
  },
  {
    id: "avatar",
    label: "頭像裁切",
    short: "頭像",
    description: "找到人臉，裁出剛剛好的比例。",
    capabilities: ["faces"],
  },
  {
    id: "export",
    label: "尺寸與轉檔",
    short: "轉檔",
    description: "調整尺寸與格式，一次整理多張。",
    capabilities: [],
  },
];
