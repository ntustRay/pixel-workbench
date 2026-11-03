import {
  CROP_RATIOS,
  ROTATIONS,
  WATERMARK_POSITIONS,
  type EditSettings,
} from "../core/types";
import { Range } from "./Range";

const POSITION_LABELS = {
  "top-left": "左上",
  "top-right": "右上",
  center: "中央",
  "bottom-left": "左下",
  "bottom-right": "右下",
};

export function EditControls({
  settings: s,
  onChange,
}: {
  settings: EditSettings;
  onChange: (value: Partial<EditSettings>) => void;
}) {
  if (s.tool === "crop")
    return (
      <>
        <label className="select-field">
          裁切比例
          <select
            aria-label="裁切比例"
            value={s.cropRatio}
            onChange={(event) => {
              const cropRatio = CROP_RATIOS.find(
                (value) => value === event.target.value,
              );
              if (cropRatio) onChange({ cropRatio });
            }}
          >
            {CROP_RATIOS.map((ratio) => (
              <option key={ratio} value={ratio}>
                {ratio === "original" ? "不裁切" : ratio}
              </option>
            ))}
          </select>
        </label>
        {s.cropRatio !== "original" && (
          <>
            <Range
              label="裁切水平位置"
              value={s.cropX}
              min={0}
              max={100}
              unit="%"
              onChange={(cropX) => onChange({ cropX })}
            />
            <Range
              label="裁切垂直位置"
              value={s.cropY}
              min={0}
              max={100}
              unit="%"
              onChange={(cropY) => onChange({ cropY })}
            />
          </>
        )}
        <fieldset>
          <legend>順時針旋轉</legend>
          <div className="segments">
            {ROTATIONS.map((rotation) => (
              <button
                key={rotation}
                aria-pressed={s.rotation === rotation}
                onClick={() => onChange({ rotation })}
              >
                {rotation}°
              </button>
            ))}
          </div>
        </fieldset>
        <label className="check-field">
          <input
            type="checkbox"
            checked={s.flipHorizontal}
            onChange={(event) =>
              onChange({ flipHorizontal: event.target.checked })
            }
          />
          水平翻轉
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={s.flipVertical}
            onChange={(event) =>
              onChange({ flipVertical: event.target.checked })
            }
          />
          垂直翻轉
        </label>
        <p className="field-description">
          先旋轉、翻轉，再裁切。位置 0% 靠左／上，100%
          靠右／下；套用後查看結果。
        </p>
      </>
    );

  if (s.tool === "adjust")
    return (
      <>
        <Range
          label="對比度"
          value={s.contrast}
          min={-100}
          max={100}
          onChange={(contrast) => onChange({ contrast })}
        />
        <Range
          label="飽和度"
          value={s.saturation}
          min={-100}
          max={100}
          onChange={(saturation) => onChange({ saturation })}
        />
        <label className="check-field">
          <input
            type="checkbox"
            checked={s.grayscale}
            onChange={(event) => onChange({ grayscale: event.target.checked })}
          />
          黑白照片
        </label>
        <Range
          label="銳化程度"
          value={s.sharpen}
          min={0}
          max={100}
          unit="%"
          onChange={(sharpen) => onChange({ sharpen })}
        />
        <p className="field-description">
          銳化強化邊緣對比，也會放大雜訊；無法還原失焦細節。
        </p>
      </>
    );

  if (s.tool === "watermark")
    return (
      <>
        <label className="text-field">
          浮水印文字
          <input
            type="text"
            aria-label="浮水印文字"
            maxLength={80}
            placeholder="輸入姓名、品牌或版權文字"
            value={s.watermarkText}
            onChange={(event) =>
              onChange({ watermarkText: event.target.value })
            }
          />
        </label>
        <label className="select-field">
          文字位置
          <select
            aria-label="文字位置"
            value={s.watermarkPosition}
            onChange={(event) => {
              const watermarkPosition = WATERMARK_POSITIONS.find(
                (value) => value === event.target.value,
              );
              if (watermarkPosition) onChange({ watermarkPosition });
            }}
          >
            {WATERMARK_POSITIONS.map((position) => (
              <option key={position} value={position}>
                {POSITION_LABELS[position]}
              </option>
            ))}
          </select>
        </label>
        <label className="color-field">
          文字顏色
          <input
            type="color"
            aria-label="文字顏色"
            value={s.watermarkColor}
            onChange={(event) =>
              onChange({ watermarkColor: event.target.value })
            }
          />
        </label>
        <Range
          label="文字大小"
          value={s.watermarkSize}
          min={2}
          max={15}
          unit="%"
          onChange={(watermarkSize) => onChange({ watermarkSize })}
        />
        <Range
          label="文字不透明度"
          value={Math.round(s.watermarkOpacity * 100)}
          min={10}
          max={100}
          unit="%"
          onChange={(value) => onChange({ watermarkOpacity: value / 100 })}
        />
        <p className="field-description">
          大小依圖片短邊計算。長文字會自動縮小至畫面內；所有圖片使用相同設定。
        </p>
      </>
    );

  return null;
}
