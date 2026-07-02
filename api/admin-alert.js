const DB_ID = "8ba3d64f-e8b0-4582-9bb8-87195bbff23e";
const NOTION_VERSION = "2022-06-28";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const token = process.env.NOTION_TOKEN;
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!token || !webhook) return res.status(500).json({ error: "env missing" });

  // 미완료 항목 조회
  const r = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filter: { property: "완료", checkbox: { equals: false } },
      sorts: [{ property: "우선순위", direction: "ascending" }],
      page_size: 50,
    }),
  });

  const data = await r.json();
  const items = data.results.map((p) => ({
    항목명: p.properties["항목명"]?.title?.[0]?.plain_text || "",
    프로젝트: p.properties["프로젝트"]?.rich_text?.[0]?.plain_text || "",
    유형: p.properties["유형"]?.select?.name || "",
    우선순위: p.properties["우선순위"]?.select?.name || "일반",
    url: p.url,
  }));

  if (items.length === 0) {
    return res.status(200).json({ message: "미처리 항목 없음" });
  }

  const urgent = items.filter((i) => i.우선순위 === "긴급");
  const normal = items.filter((i) => i.우선순위 === "일반");

  const formatItem = (i) =>
    `• *[${i.유형}]* ${i.프로젝트} — ${i.항목명}`;

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: "📋 행정 처리 미완료 항목 알림" },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `총 *${items.length}건* 미처리 (긴급 ${urgent.length}건 / 일반 ${normal.length}건)`,
      },
    },
  ];

  if (urgent.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔴 *긴급*\n${urgent.map(formatItem).join("\n")}`,
      },
    });
  }

  if (normal.length > 0) {
    blocks.push({ type: "divider" });
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🟡 *일반*\n${normal.map(formatItem).join("\n")}`,
      },
    });
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "대시보드에서 확인 →" },
        url: "https://my-dashboard-gamma-amber.vercel.app",
      },
    ],
  });

  const slackRes = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "#test", blocks }),
  });

  if (!slackRes.ok) return res.status(500).json({ error: "Slack 전송 실패" });
  return res.status(200).json({ sent: items.length });
}
