export const config = { runtime: "edge" };

const SYSTEM_PROMPT = `You are a game design analyst for a mobile game publisher. Analyze the provided GDD slide images and generate a complete interactive HTML review board.

The GDD follows Pick6 format. Images are provided in pairs per game:
- "ov" image: Overview page (game title, concept, mechanic reference, art reference)
- "htp" image: How to Play page (gameplay example)

For each game, extract from the images:
- title: English game title (read from slide)
- genre: genre/category in Korean
- concept: core concept in Korean (1-2 sentences)
- mechanic: array of Korean mechanic tags
- art: art style in Korean
- steps: array of numbered play steps in Korean
- why: array of {icon, text} — reasons why this game works, in Korean
- usp: one-line USP in Korean
- mech_ref: mechanic reference game name
- art_ref: art reference game name

Generate a COMPLETE self-contained HTML file. Requirements:

LAYOUT (3-panel, min-width 900px):
  Left sidebar 200px | Center max-width 760px centered | Right review panel 248px

LEFT SIDEBAR:
  - Studio name + GDD title at top
  - List of games with: number, title, status dot (⚪ default, 🟢 Pass, 🟡 Hold, 🔴 Drop)
  - Click to navigate
  - Summary counts at bottom: X Pass / Y Hold / Z Drop

CENTER CARD (.gdd-card, max-width 760px):
  Order of sections:
  1. Game title (h2) + genre chip + mechanic tags + art style tag
  2. Concept paragraph
  3. Reference row: "🔧 {mech_ref}" badge | "🎨 {art_ref}" badge
  4. Overview image (ov) — full width, object-fit: contain
  5. <hr>
  6. How to Play image (htp) — full width, object-fit: contain
  7. <hr>
  8. Play steps numbered list
  9. "왜 작동하는가" section — icon + text items
  10. USP highlight box (amber left border)

RIGHT REVIEW PANEL (248px fixed):
  - Verdict buttons: Pass (green) | Hold (amber) | Drop (red)
  - Checklist (6 items, each with checkbox):
    □ Core Loop 명확성
    □ 레퍼런스 CPI 검증 가능
    □ Hyper·Hybrid 구분 적용
    □ Physics 구현 난이도 수용
    □ CP 소재화 가능
    □ 메타 레이어 확장성
  - Comment textarea (placeholder: "리뷰 코멘트...")
  - Save button — persists to localStorage key: "gdd_review_{YYYYMMDD}"

STYLING:
  - Body background: #F4F5F7, white cards
  - Sidebar: #1C1D2E text #E8E9F0, active item amber left border
  - Accent: #F5B400 (amber)
  - Pass: #16A34A, Hold: #D97706, Drop: #DC2626
  - Font: -apple-system, 'Segoe UI', sans-serif
  - Card shadow: 0 1px 4px rgba(0,0,0,0.08)
  - Tags: small rounded pill chips
  - Images: white background, padding 8px, border 1px solid #E5E7EB

JS BEHAVIOR:
  - On load: set game index 0 as active
  - switchGame(i): update center card + right panel for game i
  - Verdict click: highlight button, update sidebar dot, call saveReview()
  - Checklist change: call saveReview()
  - saveReview(): save {gameIdx, verdict, checks, comment} to localStorage
  - On load: restore all saved verdicts + highlight active verdict buttons

Output ONLY the raw HTML. Start with <!DOCTYPE html>. No markdown, no code fences.`;

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response("ANTHROPIC_API_KEY not set", { status: 500 });

  const { pages, studio, title, gameCount } = await req.json();

  // Build content array: text intro + images + label guide
  const content = [
    {
      type: "text",
      text: `Analyze this GDD from studio "${studio}", title "${title}". There are ${gameCount} games. Images below are ordered: game 1 ov, game 1 htp, game 2 ov, game 2 htp, ... etc.`,
    },
    ...pages.map((p) => ({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: p.base64 },
    })),
    {
      type: "text",
      text: "Now generate the complete interactive HTML review board for all games shown. Output only raw HTML starting with <!DOCTYPE html>.",
    },
  ];

  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      stream: true,
    }),
  });

  if (!claudeRes.ok) {
    const err = await claudeRes.text();
    return new Response(err, { status: claudeRes.status });
  }

  // Pass through Anthropic SSE stream to client
  return new Response(claudeRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
