const SHEET_ID = "1pBJWVce2CgrPBlFMGbS2yCp6tBQnNn4gkEHz7jG3LZk";
const API_URL = `https://opensheet.elk.sh/${SHEET_ID}/Test_Raw Data`;
const DASHBOARD_URL = "https://my-dashboard-gamma-amber.vercel.app";
const BIZ_GROUP_ID = "S0AE7K2HLM6";

function parseDateValue(value) {
  if (!value) return null;
  const parts = String(value).trim().split(".").map((v) => v.trim()).filter(Boolean);
  if (parts.length < 3) return null;
  const [year, month, day] = parts.map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatKoreanDate(date) {
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdays[date.getDay()];
  return `${month}월 ${day}일(${weekday})`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const response = await fetch(API_URL);
    const rows = await response.json();

    // KST 기준 오늘
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(Date.now() + kstOffset);

    const today = new Date(kstNow);
    today.setUTCHours(0, 0, 0, 0);

    // 집계 기준: 오늘 - 2일
    const targetDate = new Date(today);
    targetDate.setUTCDate(targetDate.getUTCDate() - 2);
    targetDate.setHours(0, 0, 0, 0);

    // Live 프로젝트: 마지막 날짜가 (오늘-2일) 이후인 프로젝트 + 최신 iteration
    // → 모든 데이터를 수집할 수 있는 날까지 Live로 간주
    const liveProjectMap = {};
    rows.forEach((row) => {
      const d = parseDateValue(row.Date);
      if (d && d >= targetDate && row.Project && row.Iteration) {
        liveProjectMap[row.Project] = row.Iteration;
      }
    });

    if (Object.keys(liveProjectMap).length === 0) {
      return res.json({ message: "현재 Live 중인 프로젝트가 없습니다." });
    }

    // 각 프로젝트의 집계 기준일 데이터 입력 여부 확인
    const metricKeys = [
      "CPI", "Installs (Meta)", "Installs (GA)",
      "D1 Retention", "D0 Playtime", "D1 Playtime",
    ];

    // null = 해당 날짜 row 없음(아직 시작 전), false = 미입력, true = 완료
    const statusMap = {};
    Object.keys(liveProjectMap).forEach((project) => {
      statusMap[project] = null;
    });

    rows.forEach((row) => {
      if (!statusMap.hasOwnProperty(row.Project)) return;
      if (row.Iteration !== liveProjectMap[row.Project]) return;

      const rowDate = parseDateValue(row.Date);
      if (!rowDate) return;

      rowDate.setHours(0, 0, 0, 0);
      if (rowDate.getTime() !== targetDate.getTime()) return;

      if (statusMap[row.Project] === null) statusMap[row.Project] = false;

      const hasData = metricKeys.some(
        (key) => row[key] && String(row[key]).trim() !== ""
      );
      if (hasData) statusMap[row.Project] = true;
    });

    // 슬랙 메시지 구성
    const dateStr = formatKoreanDate(targetDate);
    const lines = Object.entries(statusMap)
      .filter(([, v]) => v !== null) // 시작 전 제외
      .sort(([, a], [, b]) => b - a) // 완료(true) 먼저
      .map(([project, done]) => {
        const iteration = liveProjectMap[project];
        return `${done ? "✅" : "❌"} ${project} ${iteration}`;
      });

    const relevantEntries = Object.entries(statusMap).filter(([, v]) => v !== null);
    const allDone = relevantEntries.length > 0 && relevantEntries.every(([, v]) => v === true);

    const text = [
      `*📊 CPI Test 데이터 업데이트 현황 - \`${dateStr} 기준\`* <!subteam^${BIZ_GROUP_ID}|biz>`,
      ...lines,
      ``,
      `CPI Test 대시보드 바로가기`,
      `• ${DASHBOARD_URL}`,
    ].join("\n");

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) throw new Error("SLACK_WEBHOOK_URL 환경변수 없음");

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    res.json({ success: true, allDone, status: statusMap });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
