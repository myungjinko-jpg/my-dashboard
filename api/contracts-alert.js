const DB_ID = "519164c1-6c91-4567-9daf-ce69b6d9ab58";
const NOTION_VERSION = "2022-06-28";
const DASHBOARD_URL = "https://my-dashboard-gamma-amber.vercel.app";
const BIZ_GROUP_ID = "S0AE7K2HLM6";

const CONTRACT_KINDS = ["파트너십계약", "부속합의서", "NDA"];
const DOCS_BY_KIND = {
  거래처등록: ["법인등록증", "법인통장"],
  지출기안: ["법인등록증", "법인통장", "부속합의서", "스펙내용", "인보이스"],
};

function dday(dateStr) {
  if (!dateStr) return null;
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = new Date(kstNow); today.setUTCHours(0, 0, 0, 0);
  const exp = new Date(dateStr); exp.setUTCHours(0, 0, 0, 0);
  return Math.round((exp - today) / 86400000);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.NOTION_TOKEN;
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!token) return res.status(500).json({ error: "NOTION_TOKEN not set" });
  if (!webhookUrl) return res.status(500).json({ error: "SLACK_WEBHOOK_URL not set" });

  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  try {
    // 전체 조회
    const results = [];
    let cursor;
    do {
      const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: "POST", headers,
        body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      results.push(...data.results);
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    const items = results.map(page => {
      const p = page.properties;
      const txt = (k) => p[k]?.rich_text?.[0]?.plain_text || "";
      return {
        제목: p["제목"]?.title?.[0]?.plain_text || "",
        구분: p["구분"]?.select?.name || "",
        상태: p["상태"]?.select?.name || "요청전",
        파트너사: p["파트너사"]?.select?.name || txt("파트너사"),
        만료일: p["만료일"]?.date?.start || null,
        자동갱신: p["자동갱신"]?.checkbox || false,
        법인등록증: p["법인등록증"]?.checkbox || false,
        법인통장: p["법인통장"]?.checkbox || false,
        부속합의서: p["부속합의서"]?.checkbox || false,
        스펙내용: p["스펙내용"]?.checkbox || false,
        인보이스: p["인보이스"]?.checkbox || false,
      };
    });

    // 1) 만료 임박 (D-30 이내, 지난 것 제외)
    const expiring = items
      .filter(i => CONTRACT_KINDS.includes(i.구분) && !i.자동갱신)
      .map(i => ({ ...i, d: dday(i.만료일) }))
      .filter(i => i.d !== null && i.d >= 0 && i.d <= 30)
      .sort((a, b) => a.d - b.d);

    // 2) 서류 미비 진행중 항목
    const missingDocs = items
      .filter(i => i.상태 === "진행중" && DOCS_BY_KIND[i.구분])
      .map(i => ({ 제목: i.제목, missing: DOCS_BY_KIND[i.구분].filter(doc => !i[doc]) }))
      .filter(i => i.missing.length > 0);

    if (expiring.length === 0 && missingDocs.length === 0) {
      return res.json({ message: "알림 대상 없음 (만료 임박·서류 미비 없음)", sent: 0 });
    }

    const lines = [`*📝 계약·행정 현황 알림* <!subteam^${BIZ_GROUP_ID}|biz>`];

    if (expiring.length > 0) {
      lines.push("", "*⏰ 만료 임박 계약*");
      expiring.forEach(i => lines.push(`• ${i.d === 0 ? "오늘 만료" : `D-${i.d}`} · ${i.제목}`));
    }
    if (missingDocs.length > 0) {
      lines.push("", "*📄 서류 미비 (진행중)*");
      missingDocs.forEach(i => lines.push(`• ${i.제목} — ${i.missing.join(", ")}`));
    }

    lines.push("", "계약 관리 대시보드", `• ${DASHBOARD_URL}`);

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });

    return res.json({ success: true, sent: expiring.length + missingDocs.length, expiring: expiring.length, missingDocs: missingDocs.length });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
