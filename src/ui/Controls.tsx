import {
  SlidersHorizontal,
  Download,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Info,
} from "lucide-react";
import type { EditSettings, OutputFormat, ToolId } from "../core/types";
import { useId } from "react";

interface Props {
  settings: EditSettings;
  onChange: (value: Partial<EditSettings>) => void;
  onReset: () => void;
  onProcess: () => void;
  onDownload: () => void;
  busy: boolean;
  canProcess: boolean;
  canDownload: boolean;
}

const titles: Record<ToolId, string> = {
  background: "背景設定",
  sticker: "貼紙設定",
  privacy: "馬賽克設定",
  avatar: "裁切設定",
  export: "圖片設定",
};
const COLORS = [
  "#b9d8ee",
  "#d6c6ef",
  "#f2c7bf",
  "#dde8cf",
  "#ffffff",
  "#152442",
];

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <label className="range-field" htmlFor={id}>
      <span>
        {label}
        <output aria-hidden="true">
          {value}
          {unit}
        </output>
      </span>
      <input
        id={id}
        aria-label={label}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function Controls({
  settings: s,
  onChange,
  onReset,
  onProcess,
  onDownload,
  busy,
  canProcess,
  canDownload,
}: Props) {
  return (
    <aside className="controls" aria-label="圖片處理設定">
      <div className="panel-heading">
        <h2>
          <SlidersHorizontal size={16} />
          {titles[s.tool]}
        </h2>
        <button
          className="icon-button"
          aria-label="重設設定"
          title="重設設定"
          onClick={onReset}
          disabled={busy}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      <div className="controls-body">
        {s.tool === "background" && (
          <>
            <fieldset>
              <legend>背景效果</legend>
              <div className="segments">
                {(
                  [
                    ["transparent", "透明"],
                    ["color", "底色"],
                    ["blur", "虛化"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={s.backgroundMode === value}
                    onClick={() => onChange({ backgroundMode: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            {s.backgroundMode === "color" && (
              <fieldset>
                <legend>背景顏色</legend>
                <div className="swatches">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      className={s.backgroundColor === color ? "selected" : ""}
                      aria-label={`選擇底色 ${color}`}
                      style={{ backgroundColor: color }}
                      onClick={() => onChange({ backgroundColor: color })}
                    />
                  ))}
                  <label className="custom-color" title="自訂底色">
                    <input
                      type="color"
                      aria-label="自訂底色"
                      value={s.backgroundColor}
                      onChange={(event) =>
                        onChange({ backgroundColor: event.target.value })
                      }
                    />
                    <span>＋</span>
                  </label>
                </div>
              </fieldset>
            )}
            {s.backgroundMode === "blur" && (
              <Range
                label="虛化程度"
                value={s.blur}
                min={0}
                max={60}
                unit=" px"
                onChange={(blur) => onChange({ blur })}
              />
            )}
            <p className="hint">
              <Info size={14} />
              適合清楚的人像照片；商品請先使用透明 PNG。
            </p>
          </>
        )}
        {s.tool === "sticker" && (
          <>
            <label className="check-field">
              <input
                type="checkbox"
                checked={s.usePortraitMask}
                onChange={(event) =>
                  onChange({ usePortraitMask: event.target.checked })
                }
              />
              先做人像去背
            </label>
            <p className="field-description">
              透明 PNG 或 WebP 可關閉去背，直接製作貼紙。
            </p>
            <Range
              label="外框粗細"
              value={s.outline}
              min={0}
              max={40}
              unit=" px"
              onChange={(outline) => onChange({ outline })}
            />
            <label className="color-field">
              外框顏色
              <input
                type="color"
                aria-label="外框顏色"
                value={s.outlineColor}
                onChange={(event) =>
                  onChange({ outlineColor: event.target.value })
                }
              />
            </label>
            <Range
              label="陰影強度"
              value={s.shadow}
              min={0}
              max={50}
              onChange={(shadow) => onChange({ shadow })}
            />
          </>
        )}
        {s.tool === "privacy" && (
          <>
            <Range
              label="馬賽克大小"
              value={s.pixelSize}
              min={6}
              max={80}
              unit=" px"
              onChange={(pixelSize) => onChange({ pixelSize })}
            />
            <div className="notice">
              <ShieldCheck size={17} />
              <p>
                自動偵測清楚的近距離人臉。小臉、側臉與遮擋可能漏判，下載前請逐一檢查。
              </p>
            </div>
          </>
        )}
        {s.tool === "avatar" && (
          <>
            <fieldset>
              <legend>頭像比例</legend>
              <div className="segments">
                {(["1:1", "4:5", "3:4"] as const).map((ratio) => (
                  <button
                    key={ratio}
                    aria-pressed={s.avatarRatio === ratio}
                    onClick={() => onChange({ avatarRatio: ratio })}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="hint">
              <Info size={14} />
              以最大的人臉置中，保留頭部空間。沒偵測到人臉時保留原圖。
            </p>
          </>
        )}
        <Range
          label="曝光補償"
          value={s.exposure}
          min={-2}
          max={2}
          step={0.1}
          unit=" EV"
          onChange={(exposure) => onChange({ exposure })}
        />
        <div className="control-divider" />
        <h3>輸出設定</h3>
        <label className="select-field">
          圖片格式
          <select
            aria-label="圖片格式"
            value={s.format}
            onChange={(event) =>
              onChange({ format: event.target.value as OutputFormat })
            }
          >
            <option value="image/png">PNG · 保留透明</option>
            <option value="image/webp">WebP · 體積較小</option>
            <option value="image/jpeg">JPEG · 白色底圖</option>
          </select>
        </label>
        {s.format !== "image/png" && (
          <Range
            label="圖片品質"
            value={Math.round(s.quality * 100)}
            min={10}
            max={100}
            unit="%"
            onChange={(quality) => onChange({ quality: quality / 100 })}
          />
        )}
        <label className="select-field">
          最長邊上限
          <select
            aria-label="最長邊上限"
            value={s.maxEdge}
            onChange={(event) =>
              onChange({ maxEdge: Number(event.target.value) })
            }
          >
            <option value={2400}>2,400 px</option>
            <option value={1600}>1,600 px</option>
            <option value={1080}>1,080 px</option>
            <option value={800}>800 px</option>
            <option value={512}>512 px</option>
          </select>
        </label>
        <p className="field-description">
          縮小不放大；初版處理長邊上限 2,400 px。
        </p>
      </div>
      <div className="control-actions">
        <button
          className="primary-button"
          onClick={onProcess}
          disabled={busy || !canProcess}
        >
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <SlidersHorizontal size={17} />
          )}
          {busy ? "處理中…" : "套用處理"}
        </button>
        <button
          className="secondary-button"
          onClick={onDownload}
          disabled={busy || !canDownload}
        >
          <Download size={17} />
          下載圖片
        </button>
        <span>在你的裝置處理，不需上傳照片</span>
      </div>
    </aside>
  );
}
