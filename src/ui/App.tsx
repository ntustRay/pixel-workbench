import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  Download,
  Eraser,
  Files,
  RotateCw,
  SlidersHorizontal,
  Type,
  ImagePlus,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Plus,
  ScanFace,
  Shield,
  Sticker,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { TOOLS } from "../core/catalog";
import { DEFAULT_SETTINGS } from "../core/types";
import type { EditSettings, PipelineResult, ToolId } from "../core/types";
import { ImageProcessor } from "../core/client";
import {
  archiveResults,
  downloadBlob,
  formatBytes,
  MAX_FILES,
  outputName,
  readSource,
} from "../core/files";
import type { SourceImage } from "../core/files";
import { Controls } from "./Controls";
import { createDemo } from "./demo";

const icons: Record<ToolId, LucideIcon> = {
  background: Eraser,
  sticker: Sticker,
  privacy: ScanFace,
  avatar: ScanFace,
  crop: RotateCw,
  adjust: SlidersHorizontal,
  watermark: Type,
  export: Files,
};
interface Preview {
  sourceId: string;
  signature: string;
  url: string;
  result: PipelineResult;
}

export function App() {
  const [sources, setSources] = useState<SourceImage[]>([]);
  const [selected, setSelected] = useState<string>();
  const [settings, setSettings] = useState<EditSettings>({
    ...DEFAULT_SETTINGS,
  });
  const [preview, setPreview] = useState<Preview>();
  const [working, setWorking] = useState<
    "idle" | "importing" | "processing" | "batch"
  >("idle");
  const [status, setStatus] = useState("請加入圖片，選擇工具後套用處理。");
  const [error, setError] = useState("");
  const [batchWarnings, setBatchWarnings] = useState<string[]>([]);
  const [original, setOriginal] = useState(false);
  const [compare, setCompare] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const processor = useRef(new ImageProcessor());
  const abort = useRef<AbortController | undefined>(undefined);
  const runId = useRef(0);
  const sourcesRef = useRef(sources);
  const previewUrl = useRef<string | undefined>(undefined);
  sourcesRef.current = sources;
  const busy = working !== "idle";
  const source = sources.find((item) => item.id === selected);
  const currentPreview = preview?.sourceId === source?.id ? preview : undefined;
  const upToDate = Boolean(
    currentPreview && currentPreview.signature === JSON.stringify(settings),
  );
  const tool = TOOLS.find((item) => item.id === settings.tool)!;

  useEffect(
    () => () => {
      runId.current++;
      abort.current?.abort();
      processor.current.dispose();
      sourcesRef.current.forEach((item) => URL.revokeObjectURL(item.url));
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  function updateSettings(value: Partial<EditSettings>) {
    setSettings((previous) => ({ ...previous, ...value }));
    setError("");
    setBatchWarnings([]);
  }

  async function importFiles(files: FileList | File[]) {
    if (busy) return;
    setError("");
    setWorking("importing");
    const slots = MAX_FILES - sources.length;
    const candidates = Array.from(files).slice(0, slots);
    const accepted: SourceImage[] = [];
    const failures: string[] =
      Array.from(files).length > slots
        ? [`一次最多放入 ${MAX_FILES} 張圖片，超過的檔案未加入。`]
        : [];
    for (const file of candidates) {
      try {
        accepted.push(await readSource(file));
      } catch (error) {
        failures.push(
          error instanceof Error ? error.message : "無法讀取圖片。",
        );
      }
    }
    if (accepted.length) {
      setSources((previous) => [...previous, ...accepted]);
      setSelected(accepted[0].id);
      setStatus(
        `已加入 ${accepted.length} 張圖片。選擇效果後，按「套用處理」。`,
      );
      setOriginal(false);
      setCompare(false);
    }
    setError(failures.join("\n"));
    setWorking("idle");
  }

  async function processImage(target = source, options = settings) {
    if (!target || busy) return;
    const token = ++runId.current;
    setWorking("processing");
    setError("");
    setBatchWarnings([]);
    setStatus("正在準備圖片…");
    try {
      const result = await processor.current.process(
        target,
        options,
        (message) => {
          if (token === runId.current) setStatus(message);
        },
      );
      if (token !== runId.current) return;
      const url = URL.createObjectURL(result.blob);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = url;
      setPreview({
        sourceId: target.id,
        signature: JSON.stringify(options),
        url,
        result,
      });
      setOriginal(false);
      setStatus(
        `處理完成 · ${result.width} × ${result.height} px · ${formatBytes(result.blob.size)}${options.tool === "privacy" || options.tool === "avatar" ? ` · 偵測到 ${result.faces} 張人臉` : ""}`,
      );
    } catch (error) {
      if (token === runId.current) {
        setError(error instanceof Error ? error.message : "圖片處理失敗。");
        setStatus("處理未完成，請調整設定後重試。");
      }
    } finally {
      if (token === runId.current) setWorking("idle");
    }
  }

  async function loadDemo() {
    if (busy) return;
    setWorking("importing");
    setError("");
    try {
      const file = await createDemo();
      const demo = await readSource(file);
      if (sources.length >= MAX_FILES) {
        URL.revokeObjectURL(demo.url);
        setError("圖片已滿，請先移除一張。");
        setWorking("idle");
        return;
      }
      const options = {
        ...DEFAULT_SETTINGS,
        tool: "sticker" as const,
        usePortraitMask: false,
        outline: 14,
        shadow: 20,
      };
      setSources((previous) => [...previous, demo]);
      setSelected(demo.id);
      setSettings(options);
      await processImage(demo, options);
    } catch (error) {
      setError(error instanceof Error ? error.message : "無法載入範例。");
      setWorking("idle");
    }
  }

  async function exportBatch() {
    if (busy || !sources.length) return;
    const token = ++runId.current;
    const controller = new AbortController();
    abort.current = controller;
    const snapshot = { ...settings };
    setWorking("batch");
    setError("");
    setBatchWarnings([]);
    try {
      const result = await archiveResults(
        sources,
        snapshot,
        (target) => processor.current.process(target, snapshot),
        (current, total) => {
          if (token === runId.current)
            setStatus(`批次處理 ${current} / ${total} · ${tool.label}`);
        },
        controller.signal,
      );
      if (token !== runId.current) return;
      downloadBlob(result.blob, `pixel-workbench-${snapshot.tool}.zip`);
      setBatchWarnings(result.warnings);
      setStatus(
        `批次完成 · ${sources.length} 張圖片已打包為 ZIP · ${formatBytes(result.blob.size)}`,
      );
    } catch (error) {
      if (token === runId.current) {
        setError(error instanceof Error ? error.message : "批次處理失敗。");
        setStatus("批次未完成，可重新嘗試。");
      }
    } finally {
      if (token === runId.current) setWorking("idle");
    }
  }

  function cancel() {
    runId.current++;
    abort.current?.abort();
    processor.current.dispose();
    setWorking("idle");
    setStatus("已取消處理。");
  }

  async function continueEditing() {
    if (!source || !currentPreview || !upToDate || busy) return;
    if (sources.length >= MAX_FILES) {
      setError("圖片清單已滿，請先移除一張再接續編輯。");
      return;
    }
    setWorking("importing");
    setError("");
    try {
      const file = new File(
        [currentPreview.result.blob],
        outputName(source.file.name, settings),
        {
          type: currentPreview.result.blob.type,
        },
      );
      const next = await readSource(file);
      setSources((previous) => [...previous, next]);
      setSelected(next.id);
      setSettings({ ...DEFAULT_SETTINGS, tool: "export" });
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = undefined;
      setPreview(undefined);
      setOriginal(false);
      setCompare(false);
      setBatchWarnings([]);
      setStatus("已將處理結果加入清單，請選擇下一個工具。原圖仍保留在清單內。");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "無法接續編輯，請下載後重新加入。",
      );
    } finally {
      setWorking("idle");
    }
  }

  function removeSource(id: string) {
    const target = sources.find((item) => item.id === id);
    if (target) URL.revokeObjectURL(target.url);
    const remaining = sources.filter((item) => item.id !== id);
    setSources(remaining);
    if (selected === id) setSelected(remaining[0]?.id);
    if (preview?.sourceId === id) {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = undefined;
      setPreview(undefined);
    }
  }

  return (
    <div
      className="app-shell"
      onPaste={(event) => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.matches("input, textarea") || target.isContentEditable)
        )
          return;
        const files = Array.from(event.clipboardData.files).filter((file) =>
          file.type.startsWith("image/"),
        );
        if (files.length && !busy) {
          event.preventDefault();
          void importFiles(files);
        }
      }}
    >
      <header className="app-header">
        <a className="brand" href="./" aria-label="Pixel Workbench 首頁">
          <span className="brand-icon">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span>
            pixel<span className="brand-light">workbench</span>
            <small>像素工作室</small>
          </span>
        </a>
        <div className="header-right">
          <span className="local-badge">
            <span />
            照片留在你的裝置
          </span>
          <a
            href="https://github.com/ntustRay/pixel-workbench"
            target="_blank"
            rel="noreferrer"
            className="github-link"
          >
            GitHub
            <ArrowUpRight size={14} />
          </a>
        </div>
      </header>
      <div className="workspace">
        <nav className="sidebar" aria-label="圖片工具">
          <div className="sidebar-label">圖片工具</div>
          {TOOLS.map((item) => {
            const Icon = icons[item.id];
            return (
              <button
                key={item.id}
                aria-label={item.label}
                title={item.label}
                aria-pressed={settings.tool === item.id}
                className={`tool-button ${settings.tool === item.id ? "active" : ""}`}
                onClick={() => updateSettings({ tool: item.id })}
                disabled={busy}
              >
                <Icon size={21} />
                <span>
                  {item.label}
                  <small>{item.short}</small>
                </span>
                {settings.tool === item.id && <ChevronRight size={15} />}
              </button>
            );
          })}
          <div className="sidebar-bottom">
            <div className="version-label">Pixel Workbench 0.2</div>
            <p>所有工具皆在瀏覽器處理。</p>
            <div className="privacy-note">
              <LockKeyhole size={15} />
              <span>
                不需帳號
                <br />
                不需上傳圖片
              </span>
            </div>
          </div>
        </nav>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <h1>瀏覽器圖片工具</h1>
              <p>{tool.description}</p>
            </div>
          </div>
          <input
            ref={input}
            className="visually-hidden"
            aria-label="選擇圖片"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(event) => {
              if (event.target.files) void importFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <div className="editor-layout">
            <section className="editor" aria-label="圖片編輯區">
              <div className="editor-toolbar">
                <div>
                  <span className="tiny-square" />
                  <h2>{source ? source.file.name : "編輯預覽"}</h2>
                  {source && (
                    <span className="dimensions">
                      {source.width} × {source.height}
                    </span>
                  )}
                </div>
                <div className="preview-actions">
                  {currentPreview && (
                    <>
                      <button
                        aria-pressed={original}
                        onClick={() => {
                          setOriginal(!original);
                          setCompare(false);
                        }}
                      >
                        原圖
                      </button>
                      <button
                        aria-pressed={compare}
                        onClick={() => {
                          setCompare(!compare);
                          setOriginal(false);
                        }}
                      >
                        並排比較
                      </button>
                    </>
                  )}
                  <button
                    className="icon-button"
                    aria-label="新增圖片"
                    onClick={() => input.current?.click()}
                    disabled={busy}
                  >
                    <Plus size={17} />
                  </button>
                </div>
              </div>
              <div
                className={`preview-stage ${dragging ? "dragging" : ""} ${source ? "has-image" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null,
                    )
                  )
                    setDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void importFiles(event.dataTransfer.files);
                }}
              >
                {source ? (
                  <>
                    {compare && currentPreview ? (
                      <div className="compare-grid">
                        <figure>
                          <img src={source.url} alt="處理前的原圖" />
                          <figcaption>原圖</figcaption>
                        </figure>
                        <figure>
                          <img src={currentPreview.url} alt="處理後的圖片" />
                          <figcaption>處理後</figcaption>
                        </figure>
                      </div>
                    ) : (
                      <img
                        className="preview-image"
                        src={
                          !original && currentPreview
                            ? currentPreview.url
                            : source.url
                        }
                        alt={
                          original || !currentPreview ? "原始圖片" : "處理結果"
                        }
                      />
                    )}
                    <span className="preview-label">
                      {original
                        ? "原圖"
                        : upToDate
                          ? "處理後"
                          : currentPreview
                            ? "設定已變更 · 請套用處理"
                            : "原圖 · 尚未套用"}
                    </span>
                    <span className="canvas-corner top-left" />
                    <span className="canvas-corner bottom-right" />
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-art">
                      <div className="art-back" />
                      <div className="art-front">
                        <ImagePlus size={38} strokeWidth={1.4} />
                      </div>
                      <span className="art-dot" />
                    </div>
                    <h2>加入要處理的圖片</h2>
                    <p>拖曳、選取，或按 Ctrl／⌘ + V 貼上圖片</p>
                    <button
                      className="primary-button"
                      onClick={() => input.current?.click()}
                      disabled={busy}
                    >
                      <Upload size={17} />
                      選擇圖片
                    </button>
                    <span className="file-support">
                      JPG、PNG、WebP · 每張最多 30 MB
                    </span>
                    <button
                      className="demo-button"
                      onClick={() => void loadDemo()}
                      disabled={busy}
                    >
                      先用範例做張貼紙
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                )}
                {busy && (
                  <div className="processing-overlay">
                    <LoaderCircle className="spin" size={28} />
                    <strong>
                      {working === "batch"
                        ? "正在批次處理"
                        : working === "importing"
                          ? "正在讀取圖片"
                          : "正在處理圖片"}
                    </strong>
                    <span>{status}</span>
                    {working !== "importing" && (
                      <button onClick={cancel}>取消處理</button>
                    )}
                  </div>
                )}
              </div>
              <div
                className="editor-status"
                role="status"
                aria-label="處理狀態"
                aria-live="polite"
              >
                <span>
                  {busy ? (
                    <LoaderCircle className="spin" size={14} />
                  ) : currentPreview && upToDate ? (
                    <CheckCheck size={15} />
                  ) : (
                    <Layers3 size={14} />
                  )}
                  {status}
                </span>
                <span className="status-right">本機處理</span>
              </div>
              {currentPreview && (
                <div className="continue-edit">
                  <span>將結果加入清單，繼續套用其他工具。原圖會保留。</span>
                  <button
                    className="secondary-button"
                    disabled={busy || !upToDate}
                    onClick={() => void continueEditing()}
                  >
                    接續編輯
                  </button>
                </div>
              )}
            </section>
            <Controls
              settings={settings}
              onChange={updateSettings}
              onReset={() =>
                setSettings({ ...DEFAULT_SETTINGS, tool: settings.tool })
              }
              onProcess={() => void processImage()}
              onDownload={() => {
                if (source && currentPreview && upToDate)
                  downloadBlob(
                    currentPreview.result.blob,
                    outputName(source.file.name, settings),
                  );
              }}
              busy={busy}
              canProcess={Boolean(source)}
              canDownload={upToDate}
            />
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="關閉錯誤訊息"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!busy &&
            currentPreview &&
            upToDate &&
            currentPreview.result.warnings.length > 0 && (
              <div className="warning-banner" role="note">
                {currentPreview.result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          {batchWarnings.length > 0 && (
            <div className="warning-banner">
              <strong>批次結果提醒</strong>
              {batchWarnings.slice(0, 4).map((warning, index) => (
                <p key={index}>{warning}</p>
              ))}
              {batchWarnings.length > 4 && (
                <p>另有 {batchWarnings.length - 4} 則提醒，請逐張檢查輸出。</p>
              )}
            </div>
          )}
          <section className="file-tray" aria-label="批次圖片">
            <div className="tray-heading">
              <h2>
                <Files size={17} />
                圖片清單
                <span>
                  {sources.length} / {MAX_FILES}
                </span>
              </h2>
              <button
                className="batch-button"
                onClick={() => void exportBatch()}
                disabled={!sources.length || busy}
              >
                <Download size={15} />
                批次處理並下載 ZIP
              </button>
            </div>
            {sources.length ? (
              <div className="thumbnail-list">
                {sources.map((item) => (
                  <div
                    key={item.id}
                    className={`thumbnail ${item.id === selected ? "selected" : ""}`}
                  >
                    <button
                      className="thumbnail-select"
                      aria-label={`選取 ${item.file.name}`}
                      aria-pressed={item.id === selected}
                      onClick={() => {
                        setSelected(item.id);
                        setOriginal(false);
                        setCompare(false);
                      }}
                      disabled={busy}
                    >
                      <img src={item.url} alt="" />
                      <span>{item.file.name}</span>
                      {item.id === selected && <Check size={13} />}
                    </button>
                    <button
                      className="remove-image"
                      aria-label={`移除 ${item.file.name}`}
                      onClick={() => removeSource(item.id)}
                      disabled={busy}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                <button
                  className="add-thumbnail"
                  aria-label="加入更多圖片"
                  onClick={() => input.current?.click()}
                  disabled={busy || sources.length >= MAX_FILES}
                >
                  <Plus size={22} />
                  加入圖片
                </button>
              </div>
            ) : (
              <div className="tray-empty">
                <span>最多加入 20 張圖片，套用相同設定後下載 ZIP。</span>
                <button onClick={() => input.current?.click()} disabled={busy}>
                  <Plus size={15} />
                  加入圖片
                </button>
              </div>
            )}
          </section>
          <div className="workspace-footer">
            <span>
              <Shield size={13} />
              圖片在裝置上處理；去背與人臉工具首次使用時會載入本站模型。
            </span>
            <span>JPG / PNG / WebP</span>
          </div>
        </main>
      </div>
    </div>
  );
}
