const DB_ID = "8ba3d64f-e8b0-4582-9bb8-87195bbff23e";
const NOTION_VERSION = "2022-06-28";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const token = process.env.NOTION_TOKEN;
  if (!token) return res.status(500).json({ error: "NOTION_TOKEN not set" });

  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  // PATCH: 완료 상태 토글
  if (req.method === "PATCH") {
    const { pageId, done } = req.body;
    const r = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ properties: { 완료: { checkbox: done } } }),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  }

  // GET: DB 항목 조회
  const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      sorts: [
        { property: "우선순위", direction: "ascending" },
        { property: "완료", direction: "ascending" },
      ],
      page_size: 100,
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    return res.status(r.status).json({ error: err });
  }

  const data = await r.json();

  const items = data.results.map((page) => {
    const p = page.properties;
    return {
      id: page.id,
      url: page.url,
      항목명: p["항목명"]?.title?.[0]?.plain_text || "",
      프로젝트: p["프로젝트"]?.rich_text?.[0]?.plain_text || "",
      유형: p["유형"]?.select?.name || "",
      우선순위: p["우선순위"]?.select?.name || "일반",
      완료: p["완료"]?.checkbox || false,
      메모: p["메모"]?.rich_text?.[0]?.plain_text || "",
      마감일: p["마감일"]?.date?.start || null,
    };
  });

  return res.status(200).json({ items });
}
