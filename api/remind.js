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
  try {
    // 구글 시트 데이터 fetch
    const response = await fetch(API_URL);
    const rows = await response.json();

    // KST 기준 오늘 날짜
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(Date.now() + kstOffset);

    const today = new Date(kstNow);
    today.setUTCHours(0, 0, 0, 0);

    // 집계 기준: 오늘 - 2일
    const targetDate = new Date(today);
    targetDate.setUTCDate(targetDate.getUTCDate() - 2);

    // Live 프로젝트: 마지막 날짜가 (오늘-2일) 이후인 프로젝트
    // → 모든 데이터를 수집할 수 있는 날까지 Live로 간주
    const liveProjects = new Set();
    rows.forEach((row) => {
      const d = parseDateValue(row.Date);
      if (d && d >= targetDate) liveProjects.add(row.Project);
    });

    // 모든 Live 프로젝트의 집계 기준일 데이터 입력 여부 확인
    const metricKeys = [
      "CPI", "Installs (Meta)", "Installs (GA)",
      "D1 Retention", "D0 Playtime", "D1 Playtime",
    ];

    // liveProjects에서 iteration도 함께 추적
    const liveProjectMap = {};
    rows.forEach((row) => {
      const d = parseDateValue(row.Date);
      if (d && d >= targetDate && row.Project && row.Iteration) {
        liveProjectMap[row.Project] = row.Iteration;
      }
    });

    // null = 해당 날짜 row 없음(아직 시작 전), false = 미입력, true = 완료
    const statusMap = {};
    Object.keys(liveProjectMap).forEach((p) => { statusMap[p] = null; });

    rows.forEach((row) => {
      if (!statusMap.hasOwnProperty(row.Project)) return;
      if (row.Iteration !== liveProjectMap[row.Project]) return;

      const rowDate = parseDateValue(row.Date);
      if (!rowDate) return;
      rowDate.setHours(0, 0, 0, 0);
      targetDate.setHours(0, 0, 0, 0);
      if (rowDate.getTime() !== targetDate.getTime()) return;

      // row가 존재하면 일단 false(미입력)로 설정
      if (statusMap[row.Project] === null) statusMap[row.Project] = false;

      const hasData = metricKeys.some(
        (key) => row[key] && String(row[key]).trim() !== ""
      );
      if (hasData) statusMap[row.Project] = true;
    });

    // null(시작 전) 제외하고 판단
    const relevantEntries = Object.entries(statusMap).filter(([, v]) => v !== null);
    const allDone = relevantEntries.length > 0 && relevantEntries.every(([, v]) => v === true);

    const dateStr = formatKoreanDate(targetDate);
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) throw new Error("SLACK_WEBHOOK_URL 환경변수 없음");

    const projectLines = Object.entries(statusMap)
      .filter(([, v]) => v !== null) // 시작 전 제외
      .sort(([, a], [, b]) => b - a)
      .map(([project, done]) => `• ${done ? "✅" : "❌"} ${project} ${liveProjectMap[project]}`)
      .join("\n");

    let text;

    if (allDone) {
      text = [
        `*📊 CPI Test 데이터 업데이트 알림 - \`${dateStr} 데이터 기준\`* <!subteam^${BIZ_GROUP_ID}|biz>`,
        `✅ 모든 Live 프로젝트 업데이트 완료!`,
        projectLines,
        ``,
        `CPI Test 대시보드 바로가기`,
        `• ${DASHBOARD_URL}`,
      ].join("\n");
    } else {
      text = [
        `*📊 CPI Test 데이터 업데이트 알림 - \`${dateStr} 데이터 기준\`* <!subteam^${BIZ_GROUP_ID}|biz>`,
        `담당자분들은 다음 프로젝트의 데이터를 업데이트 해주세요.`,
        projectLines,
        ``,
        `CPI Test 대시보드 바로가기`,
        `• ${DASHBOARD_URL}`,
      ].join("\n");
    }

    // 슬랙 전송
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    res.json({ success: true, projects: needsUpdate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}
