import { useCallback, useEffect, useRef, useState } from "react";

const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV ? "http://localhost:5601" : "";

const amber = "#F5B400";
const amberFaint = "rgba(245,180,0,0.10)";
const green = "#16A34A";
const red = "#DC2626";

// ── Status chip ──────────────────────────────────────────────────────────────
function StatusChip({ status }) {
  const map = {
    미검토: { bg: "#F4F5F7", color: "#6B7280", border: "#E4E6EA" },
    검토중: { bg: amberFaint, color: amber, border: amber + "44" },
    완료:   { bg: "rgba(22,163,74,.08)", color: green, border: "rgba(22,163,74,.25)" },
  };
  const s = map[status] || map["미검토"];
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 3,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: ".03em",
    }}>{status}</span>
  );
}

// ── PDF extraction ────────────────────────────────────────────────────────────
async function extractGddPages(file, onProgress) {
  // Dynamic import to avoid blocking the main bundle
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).href;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  // Pick6 format: page 0 = cover, per game i: ov=1+i*4, htp=2+i*4
  const gameCount = Math.floor((totalPages - 1) / 4);
  const pagesToExtract = [];
  for (let i = 0; i < gameCount; i++) {
    pagesToExtract.push({ idx: 1 + i * 4, label: `game${i + 1}_ov` });
    pagesToExtract.push({ idx: 2 + i * 4, label: `game${i + 1}_htp` });
  }

  const pages = [];
  for (let pi = 0; pi < pagesToExtract.length; pi++) {
    const { idx, label } = pagesToExtract[pi];
    if (idx >= totalPages) continue;
    onProgress?.(`슬라이드 추출 중… (${pi + 1}/${pagesToExtract.length})`);

    const page = await pdf.getPage(idx + 1); // pdf.js is 1-indexed
    const viewport = page.getViewport({ scale: 1.2 });
    // Cap width to 480px for payload size
    const scale = Math.min(1.2, 480 / viewport.width);
    const vp = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width  = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport: vp }).promise;

    const base64 = canvas.toDataURL("image/jpeg", 0.75).split(",")[1];
    pages.push({ label, base64 });
  }

  return { pages, gameCount };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GddLibrary() {
  const [index, setIndex]               = useState({ studios: [], reviews: [] });
  const [loading, setLoading]           = useState(true);
  const [selectedStudio, setSelectedStudio] = useState(null);
  const [viewingReview, setViewingReview]   = useState(null); // review entry

  // Upload state
  const [showUpload, setShowUpload]     = useState(false);
  const [uploadStudio, setUploadStudio] = useState("");
  const [uploadTitle, setUploadTitle]   = useState("");
  const [uploadDate, setUploadDate]     = useState(new Date().toISOString().slice(0, 10));
  const [uploadFile, setUploadFile]     = useState(null);
  const [processing, setProcessing]     = useState(false);
  const [processStep, setProcessStep]   = useState("");
  const [processError, setProcessError] = useState("");
  const [generatedHtml, setGeneratedHtml] = useState(""); // streamed HTML

  const fileInputRef = useRef(null);

  // ── Load index ──────────────────────────────────────────────────────────────
  const loadIndex = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/gdd-list`);
      if (r.ok) {
        const data = await r.json();
        setIndex(data);
        if (data.studios.length > 0 && !selectedStudio) {
          setSelectedStudio(data.studios[0]);
        }
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { loadIndex(); }, [loadIndex]);

  // ── Upload handler ──────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile || !uploadStudio.trim() || !uploadTitle.trim()) return;
    setProcessing(true);
    setProcessError("");
    setGeneratedHtml("");

    try {
      // 1. Extract PDF pages
      setProcessStep("PDF 슬라이드 추출 중…");
      const { pages, gameCount } = await extractGddPages(uploadFile, setProcessStep);

      if (pages.length === 0) {
        setProcessError("슬라이드를 추출하지 못했습니다. Pick6 형식 PDF인지 확인해주세요.");
        return;
      }

      // 2. Call Claude via streaming API
      setProcessStep(`Claude AI 분석 중… (게임 ${gameCount}개)`);

      const res = await fetch(`${API_BASE}/api/gdd-process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pages,
          studio: uploadStudio.trim(),
          title: uploadTitle.trim(),
          gameCount,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      // 3. Parse SSE stream and accumulate HTML
      setProcessStep("HTML 리뷰 생성 중…");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let html = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              html += evt.delta.text;
              setGeneratedHtml(html);
            }
          } catch { /* ignore parse errors */ }
        }
      }

      if (!html) throw new Error("HTML 생성에 실패했습니다.");

      // 4. Save to Vercel Blob
      setProcessStep("저장 중…");
      const saveRes = await fetch(`${API_BASE}/api/gdd-save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html,
          studio: uploadStudio.trim(),
          title: uploadTitle.trim(),
          games: [],
          submittedAt: uploadDate,
        }),
      });

      if (!saveRes.ok) throw new Error("저장 실패");
      const { id, url } = await saveRes.json();

      // 5. Update local state
      const newEntry = {
        id, studio: uploadStudio.trim(), title: uploadTitle.trim(),
        games: [], submittedAt: uploadDate,
        pass: 0, hold: 0, drop: 0, status: "미검토", htmlUrl: url, note: "",
      };
      setIndex(prev => ({
        studios: prev.studios.includes(uploadStudio.trim())
          ? prev.studios
          : [...prev.studios, uploadStudio.trim()].sort(),
        reviews: [newEntry, ...prev.reviews],
      }));
      setSelectedStudio(uploadStudio.trim());

      // 6. Open the review
      setViewingReview({ ...newEntry, html });
      setShowUpload(false);
      resetUploadForm();
      setProcessStep("");

    } catch (e) {
      setProcessError(e.message);
    } finally {
      setProcessing(false);
    }
  };

  const resetUploadForm = () => {
    setUploadStudio("");
    setUploadTitle("");
    setUploadFile(null);
    setUploadDate(new Date().toISOString().slice(0, 10));
    setGeneratedHtml("");
    setProcessStep("");
    setProcessError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openReview = async (review) => {
    if (review.html) { setViewingReview(review); return; }
    try {
      const r = await fetch(review.htmlUrl);
      const html = await r.text();
      setViewingReview({ ...review, html });
    } catch { setViewingReview(review); }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const studioReviews = index.reviews.filter(r => r.studio === selectedStudio);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 500, overflow: "hidden" }}>

      {/* ── Left sidebar: studio list ── */}
      <div style={{
        width: 210, flexShrink: 0, borderRight: "1px solid var(--line)",
        display: "flex", flexDirection: "column", background: "var(--card)",
      }}>
        <div style={{
          padding: "10px 14px 8px", borderBottom: "1px solid var(--line)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--muted)", flex: 1 }}>개발사</span>
          <button onClick={loadIndex} style={{ fontSize: 11, padding: "2px 6px", borderRadius: 3, border: "1px solid var(--line)", color: "var(--muted)", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>↻</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: "20px 14px", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>불러오는 중…</div>
          ) : index.studios.length === 0 ? (
            <div style={{ padding: "24px 14px", fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.6 }}>
              아직 GDD가 없습니다.<br />아래 버튼으로 업로드하세요.
            </div>
          ) : index.studios.map(studio => {
            const reviews = index.reviews.filter(r => r.studio === studio);
            const isActive = selectedStudio === studio;
            return (
              <div key={studio} onClick={() => { setSelectedStudio(studio); setViewingReview(null); }}
                style={{
                  padding: "10px 14px", cursor: "pointer",
                  borderLeft: `2px solid ${isActive ? amber : "transparent"}`,
                  background: isActive ? amberFaint : "transparent",
                  borderBottom: "1px solid var(--line)", transition: "background .1s",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F8F9FA"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{studio}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{reviews.length}건 제출</div>
              </div>
            );
          })}
        </div>

        {/* Upload button */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line)" }}>
          <button onClick={() => setShowUpload(true)} style={{
            width: "100%", padding: "8px 0", borderRadius: 4,
            border: `1px solid ${amber}`, background: amberFaint,
            color: amber, fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", letterSpacing: ".02em",
          }}>+ GDD 업로드</button>
        </div>
      </div>

      {/* ── Right area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>

        {/* Viewing a review — iframe */}
        {viewingReview && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{
              padding: "10px 20px", borderBottom: "1px solid var(--line)",
              background: "var(--card)", display: "flex", alignItems: "center", gap: 12,
            }}>
              <button onClick={() => setViewingReview(null)} style={{
                fontSize: 11, padding: "4px 10px", borderRadius: 3,
                border: "1px solid var(--line)", background: "transparent",
                color: "var(--muted)", cursor: "pointer", fontFamily: "inherit",
              }}>← 목록</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{viewingReview.title}</span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{viewingReview.studio} · {viewingReview.submittedAt}</span>
              {viewingReview.htmlUrl && (
                <a href={viewingReview.htmlUrl} target="_blank" rel="noopener noreferrer" style={{
                  marginLeft: "auto", fontSize: 11, color: "var(--muted)", textDecoration: "none",
                }}>새 탭에서 열기 ↗</a>
              )}
            </div>
            <iframe
              srcDoc={viewingReview.html}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" }}
              title="GDD Review"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}

        {/* Studio GDD list */}
        {!viewingReview && selectedStudio && (
          <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 4 }}>개발사</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{selectedStudio}</div>
              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{studioReviews.length}건 제출 이력</div>
            </div>

            {studioReviews.length === 0 ? (
              <div style={{ padding: "40px 0", fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
                이 개발사의 GDD가 아직 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {studioReviews.map(review => (
                  <div key={review.id} style={{
                    background: "var(--card)", borderRadius: 6,
                    border: "1px solid var(--line)", padding: "16px 20px",
                    cursor: "pointer", transition: "box-shadow .15s",
                  }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,.08)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                    onClick={() => openReview(review)}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{review.title}</span>
                          <StatusChip status={review.status} />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>
                          제출일 {review.submittedAt}
                          {review.games?.length > 0 && ` · 게임 ${review.games.length}개`}
                        </div>
                      </div>
                      {/* Verdict summary */}
                      <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
                        {[
                          { label: "Pass", count: review.pass, color: green },
                          { label: "Hold", count: review.hold, color: amber },
                          { label: "Drop", count: review.drop, color: red },
                        ].map(({ label, count, color }) => (
                          <div key={label} style={{ textAlign: "center" }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: count > 0 ? color : "var(--muted)", fontVariantNumeric: "tabular-nums" }}>{count}</div>
                            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: ".04em", textTransform: "uppercase" }}>{label}</div>
                          </div>
                        ))}
                        <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>→</span>
                      </div>
                    </div>
                    {review.note && (
                      <div style={{ marginTop: 10, fontSize: 11, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 8 }}>{review.note}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!viewingReview && !selectedStudio && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 32 }}>📚</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>GDD 라이브러리</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>좌측에서 개발사를 선택하거나 새 GDD를 업로드하세요.</div>
          </div>
        )}
      </div>

      {/* ── Upload modal ── */}
      {showUpload && (
        <div onClick={() => { if (!processing) { setShowUpload(false); resetUploadForm(); } }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--card)", border: "1px solid var(--card-border)",
            borderRadius: 8, width: 440, boxShadow: "0 12px 48px rgba(0,0,0,.18)",
            overflow: "hidden",
          }}>
            {/* Modal header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>GDD 업로드</div>
              {!processing && (
                <button onClick={() => { setShowUpload(false); resetUploadForm(); }} style={{
                  width: 24, height: 24, borderRadius: 4, border: "1px solid var(--line)",
                  background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--muted)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
                }}>✕</button>
              )}
            </div>

            <div style={{ padding: "20px" }}>
              {!processing ? (
                <>
                  {/* Form fields */}
                  {[
                    { label: "개발사", value: uploadStudio, setter: setUploadStudio, placeholder: "예: Celesta", list: "studios-list" },
                    { label: "GDD 제목", value: uploadTitle, setter: setUploadTitle, placeholder: "예: Association Sort" },
                  ].map(({ label, value, setter, placeholder, list }) => (
                    <div key={label} style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 }}>{label}</div>
                      <input
                        value={value} onChange={e => setter(e.target.value)}
                        placeholder={placeholder} list={list}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 4, boxSizing: "border-box", border: "1px solid var(--card-border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                      />
                      {list && (
                        <datalist id={list}>
                          {index.studios.map(s => <option key={s} value={s} />)}
                        </datalist>
                      )}
                    </div>
                  ))}

                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 }}>제출일</div>
                    <input type="date" value={uploadDate} onChange={e => setUploadDate(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 4, boxSizing: "border-box", border: "1px solid var(--card-border)", background: "var(--bg)", color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
                  </div>

                  {/* File picker */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 5 }}>PDF 파일 (Pick6 형식)</div>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: `2px dashed ${uploadFile ? amber : "var(--line)"}`,
                        borderRadius: 6, padding: "20px", textAlign: "center", cursor: "pointer",
                        background: uploadFile ? amberFaint : "var(--bg)", transition: "all .15s",
                      }}
                    >
                      {uploadFile ? (
                        <>
                          <div style={{ fontSize: 13, fontWeight: 600, color: amber, marginBottom: 2 }}>{uploadFile.name}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
                          <div style={{ fontSize: 12, color: "var(--muted)" }}>클릭하여 PDF 선택</div>
                        </>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: "none" }}
                      onChange={e => setUploadFile(e.target.files?.[0] || null)} />
                  </div>

                  {processError && (
                    <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 4, background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.2)", fontSize: 12, color: red }}>{processError}</div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setShowUpload(false); resetUploadForm(); }} style={{ flex: 1, padding: "9px 0", borderRadius: 4, border: "1px solid var(--card-border)", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--muted)", fontFamily: "inherit" }}>취소</button>
                    <button
                      onClick={handleUpload}
                      disabled={!uploadFile || !uploadStudio.trim() || !uploadTitle.trim()}
                      style={{
                        flex: 2, padding: "9px 0", borderRadius: 4, border: "none",
                        background: (!uploadFile || !uploadStudio.trim() || !uploadTitle.trim()) ? "var(--line)" : amber,
                        color: (!uploadFile || !uploadStudio.trim() || !uploadTitle.trim()) ? "var(--muted)" : "#fff",
                        cursor: (!uploadFile || !uploadStudio.trim() || !uploadTitle.trim()) ? "not-allowed" : "pointer",
                        fontSize: 12, fontWeight: 700, fontFamily: "inherit",
                      }}>리뷰 생성 시작</button>
                  </div>
                </>
              ) : (
                /* Processing state */
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>
                    {processStep.startsWith("저장") ? "💾" : processStep.includes("Claude") ? "🤖" : "📄"}
                  </div>

                  {/* Progress bar (indeterminate) */}
                  <div style={{ height: 3, background: "var(--line)", borderRadius: 2, overflow: "hidden", marginBottom: 16 }}>
                    <div style={{
                      height: "100%", width: "40%", background: amber, borderRadius: 2,
                      animation: "gdd-slide 1.4s ease-in-out infinite",
                    }} />
                  </div>
                  <style>{`@keyframes gdd-slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }`}</style>

                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>{processStep}</div>

                  {/* Live HTML preview while generating */}
                  {generatedHtml && (
                    <div style={{ marginTop: 12, textAlign: "left", fontSize: 11, color: "var(--muted)", background: "var(--bg)", borderRadius: 4, padding: "8px 10px", maxHeight: 80, overflow: "hidden", fontFamily: "monospace" }}>
                      {generatedHtml.slice(-200)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
