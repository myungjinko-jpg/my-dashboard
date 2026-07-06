const DB_ID = "b3a19869-43aa-41a9-b89d-202eaf7c354f";
const NOTION_VERSION = "2022-06-28";

const text = (v) => (v ? { rich_text: [{ text: { content: v } }] } : { rich_text: [] });

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: "NOTION_TOKEN not set" });

  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  const mapPage = (page) => {
    const p = page.properties;
    return {
      id: page.id,
      url: page.url,
      계약명: p["계약명"]?.title?.[0]?.plain_text || "",
      스튜디오: p["스튜디오"]?.rich_text?.[0]?.plain_text || "",
      계약유형: p["계약유형"]?.select?.name || "기타",
      상태: p["상태"]?.select?.name || "협상중",
      체결일: p["체결일"]?.date?.start || null,
      만료일: p["만료일"]?.date?.start || null,
      자동갱신: p["자동갱신"]?.checkbox || false,
      계약서링크: p["계약서링크"]?.url || null,
      메모: p["메모"]?.rich_text?.[0]?.plain_text || "",
      상위계약: p["상위계약"]?.rich_text?.[0]?.plain_text || "",
    };
  };

  // POST: 계약 생성
  if (req.method === "POST") {
    const { 계약명, 스튜디오, 계약유형, 상태, 체결일, 만료일, 자동갱신, 계약서링크, 메모, 상위계약 } = req.body;
    if (!계약명 || !스튜디오) return res.status(400).json({ error: "계약명/스튜디오 필수" });

    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers,
      body: JSON.stringify({
        parent: { database_id: DB_ID },
        properties: {
          계약명: { title: [{ text: { content: 계약명 } }] },
          스튜디오: text(스튜디오),
          계약유형: { select: { name: 계약유형 || "본계약" } },
          상태: { select: { name: 상태 || "협상중" } },
          ...(체결일 ? { 체결일: { date: { start: 체결일 } } } : {}),
          ...(만료일 ? { 만료일: { date: { start: 만료일 } } } : {}),
          자동갱신: { checkbox: !!자동갱신 },
          ...(계약서링크 ? { 계약서링크: { url: 계약서링크 } } : {}),
          ...(메모 ? { 메모: text(메모) } : {}),
          ...(상위계약 ? { 상위계약: text(상위계약) } : {}),
        },
      }),
    });
    const page = await r.json();
    if (!r.ok) return res.status(r.status).json(page);
    return res.status(200).json({ item: mapPage(page) });
  }

  // PATCH: 필드 업데이트
  if (req.method === "PATCH") {
    const { pageId, ...fields } = req.body;
    if (!pageId) return res.status(400).json({ error: "pageId 필수" });

    const properties = {};
    if (fields.계약명 !== undefined) properties["계약명"] = { title: [{ text: { content: fields.계약명 } }] };
    if (fields.스튜디오 !== undefined) properties["스튜디오"] = text(fields.스튜디오);
    if (fields.계약유형 !== undefined) properties["계약유형"] = { select: { name: fields.계약유형 } };
    if (fields.상태 !== undefined) properties["상태"] = { select: { name: fields.상태 } };
    if (fields.체결일 !== undefined) properties["체결일"] = fields.체결일 ? { date: { start: fields.체결일 } } : { date: null };
    if (fields.만료일 !== undefined) properties["만료일"] = fields.만료일 ? { date: { start: fields.만료일 } } : { date: null };
    if (fields.자동갱신 !== undefined) properties["자동갱신"] = { checkbox: !!fields.자동갱신 };
    if (fields.계약서링크 !== undefined) properties["계약서링크"] = { url: fields.계약서링크 || null };
    if (fields.메모 !== undefined) properties["메모"] = text(fields.메모);
    if (fields.상위계약 !== undefined) properties["상위계약"] = text(fields.상위계약);

    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ properties }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(200).json({ item: mapPage(data) });
  }

  // DELETE: 계약 아카이브
  if (req.method === "DELETE") {
    const { pageId } = req.body;
    if (!pageId) return res.status(400).json({ error: "pageId 필수" });
    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ archived: true }),
    });
    const data = await r.json();
    return res.status(r.status).json(r.ok ? { deleted: true } : data);
  }

  // GET: 전체 조회
  const results = [];
  let cursor;
  do {
    const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sorts: [{ property: "체결일", direction: "descending" }],
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }
    const data = await r.json();
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return res.status(200).json({ items: results.map(mapPage) });
}
