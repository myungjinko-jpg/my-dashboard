const DB_ID = "519164c1-6c91-4567-9daf-ce69b6d9ab58";
const NOTION_VERSION = "2022-06-28";

const FIELD_TYPES = {
  제목: "title",
  구분: "select", 상태: "select", 파트너사: "select",
  이터레이션구분: "text", 메모: "text", 프로젝트: "text",
  거래처식별번호: "text", 거래처명: "text", 거래처국가: "text", 거래처주소: "text",
  거래처대표: "text", 거래처담당자: "text",
  BankName: "text", BranchName: "text", BankAddress: "text", BeneficiaryName: "text", AccountNumber: "text",
  거래처Email: "email",
  계약서URL: "url", 기안링크: "url",
  법인등록증: "checkbox", 법인통장: "checkbox", 부속합의서: "checkbox", 스펙내용: "checkbox", 인보이스: "checkbox", 자동갱신: "checkbox",
  체결일: "date", 만료일: "date", 최종업데이트일: "date",
};

function toNotionProp(key, value) {
  switch (FIELD_TYPES[key]) {
    case "title": return { title: [{ text: { content: value || "" } }] };
    case "select": return value ? { select: { name: value } } : { select: null };
    case "text": return { rich_text: value ? [{ text: { content: value } }] : [] };
    case "email": return { email: value || null };
    case "url": return { url: value || null };
    case "checkbox": return { checkbox: !!value };
    case "date": return value ? { date: { start: value } } : { date: null };
    default: return undefined;
  }
}

function fromNotionPage(page) {
  const p = page.properties;
  const out = { id: page.id, url: page.url };
  for (const [key, type] of Object.entries(FIELD_TYPES)) {
    const prop = p[key];
    if (!prop) { out[key] = type === "checkbox" ? false : null; continue; }
    switch (type) {
      case "title": out[key] = prop.title?.[0]?.plain_text || ""; break;
      case "select": out[key] = prop.select?.name || null; break;
      case "text": out[key] = prop.rich_text?.[0]?.plain_text || ""; break;
      case "email": out[key] = prop.email || null; break;
      case "url": out[key] = prop.url || null; break;
      case "checkbox": out[key] = prop.checkbox || false; break;
      case "date": out[key] = prop.date?.start || null; break;
    }
  }
  return out;
}

function buildProperties(fields) {
  const properties = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!(key in FIELD_TYPES)) continue;
    const prop = toNotionProp(key, value);
    if (prop !== undefined) properties[key] = prop;
  }
  return properties;
}

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

  // POST: 항목 생성
  if (req.method === "POST") {
    const fields = req.body || {};
    if (!fields.제목 || !fields.파트너사 || !fields.구분) {
      return res.status(400).json({ error: "제목/파트너사/구분 필수" });
    }
    fields.최종업데이트일 = new Date().toISOString().slice(0, 10);
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers,
      body: JSON.stringify({ parent: { database_id: DB_ID }, properties: buildProperties(fields) }),
    });
    const page = await r.json();
    if (!r.ok) return res.status(r.status).json(page);
    return res.status(200).json({ item: fromNotionPage(page) });
  }

  // PATCH: 필드 업데이트
  if (req.method === "PATCH") {
    const { pageId, ...fields } = req.body || {};
    if (!pageId) return res.status(400).json({ error: "pageId 필수" });
    fields.최종업데이트일 = new Date().toISOString().slice(0, 10);
    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ properties: buildProperties(fields) }),
    });
    const page = await r.json();
    if (!r.ok) return res.status(r.status).json(page);
    return res.status(200).json({ item: fromNotionPage(page) });
  }

  // DELETE: 아카이브
  if (req.method === "DELETE") {
    const { pageId } = req.body || {};
    if (!pageId) return res.status(400).json({ error: "pageId 필수" });
    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ archived: true }),
    });
    const data = await r.json();
    return res.status(r.status).json(r.ok ? { deleted: true } : data);
  }

  // GET: 전체 조회 (+ DB 스키마의 파트너사 옵션 목록)
  const results = [];
  let cursor;
  do {
    const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: "POST",
      headers,
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(r.status).json({ error: err });
    }
    const data = await r.json();
    results.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  // 파트너사 select 옵션 (등록된 전체 파트너 목록)
  let partners = [];
  try {
    const dbRes = await fetch(`https://api.notion.com/v1/databases/${DB_ID}`, { headers });
    const db = await dbRes.json();
    partners = db.properties?.["파트너사"]?.select?.options?.map(o => o.name) || [];
  } catch { /* 목록 없이 진행 */ }

  return res.status(200).json({ items: results.map(fromNotionPage), partners });
}
