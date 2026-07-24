// 거래처 서류(법인등록증·법인통장) → Claude API(비전)로 거래처/송금 정보 추출
// POST body: { docs: [{ kind: "법인등록증"|"법인통장", mediaType, data(base64, no prefix) }] }
// 응답: { fields: { ...폼 필드 } }  — 프론트에서 초안에 채운 뒤 사람이 검토·저장
const MODEL = "claude-sonnet-5";
const ANTHROPIC_VERSION = "2023-06-01";

// 추출 대상 필드 (Contracts 폼과 1:1) — 값은 문서에서 읽은 것만, 추정 금지, 없으면 ""
const FIELD_KEYS = [
  "거래처식별번호", "거래처명", "거래처국가", "거래처주소", "거래처대표", "거래처Email", "거래처계좌번호",
  "BankName", "BranchName", "BankAddress", "SWIFT", "BeneficiaryName", "AccountNumber",
];

const FIELD_DESC = {
  거래처식별번호: "법인등록번호/사업자등록번호 등 등록증상 식별번호",
  거래처명: "법인/사업자명 (국내=한글 그대로, 해외=영문 그대로)",
  거래처국가: "법인 등록국 — 반드시 법인등록증(사업자등록증) 기준. 국내면 '대한민국'",
  거래처주소: "등록증상 주소",
  거래처대표: "대표자명",
  거래처Email: "이메일 (있을 때만)",
  거래처계좌번호: "법인통장 계좌번호",
  BankName: "은행명 (통장/송금정보 기준)",
  BranchName: "지점명",
  BankAddress: "은행 주소",
  SWIFT: "SWIFT/BIC 코드",
  BeneficiaryName: "예금주명 (Beneficiary)",
  AccountNumber: "계좌번호/IBAN (해외 송금용)",
};

const SYSTEM_PROMPT = [
  "너는 계약 담당자를 돕는 거래처 정보 추출기다. 업로드된 법인등록증(사업자등록증)과 법인통장 이미지/PDF에서 거래처 정보와 해외 송금 정보를 읽어 구조화한다.",
  "규칙:",
  "1) 문서에 실제로 적힌 값만 추출한다. 추정·창작 금지. 값이 없으면 빈 문자열 \"\".",
  "2) 국내 문서는 한글 그대로, 해외 문서는 영문 그대로 표기한다. 임의 번역/음역 금지.",
  "3) 거래처국가는 반드시 법인등록증(사업자등록증)의 등록국 기준. 개발 소재지나 은행 소재지와 혼동하지 말 것. 국내면 '대한민국'.",
  "4) 법인등록증 → 거래처 식별번호/명/국가/주소/대표. 법인통장 → 은행명/지점/은행주소/SWIFT/예금주/계좌번호.",
  "5) 개인 계약(개인사업자·개인)일 경우 여권/신분증 기준 영문명 등을 그대로.",
  "반드시 vendor_info 도구를 호출해 결과를 반환한다.",
].join("\n");

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. Vercel에 등록 후 재배포하세요." });

  const docs = (req.body && req.body.docs) || [];
  if (!Array.isArray(docs) || docs.length === 0) {
    return res.status(400).json({ error: "docs(파일) 필요" });
  }

  // Claude content 블록 구성: 문서/이미지 먼저, 텍스트 지시 마지막
  const content = [];
  for (const d of docs) {
    if (!d || !d.data) continue;
    const label = d.kind ? `[${d.kind}]` : "[문서]";
    content.push({ type: "text", text: label });
    if (d.mediaType === "application/pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: d.data } });
    } else {
      content.push({ type: "image", source: { type: "base64", media_type: d.mediaType || "image/png", data: d.data } });
    }
  }
  content.push({ type: "text", text: "위 서류에서 거래처 정보와 해외 송금 정보를 추출해 vendor_info 도구로 반환해줘. 없는 값은 빈 문자열." });

  const properties = {};
  for (const k of FIELD_KEYS) properties[k] = { type: "string", description: FIELD_DESC[k] || k };

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        thinking: { type: "disabled" },
        system: SYSTEM_PROMPT,
        tools: [{
          name: "vendor_info",
          description: "추출한 거래처 정보와 해외 송금 정보. 없는 값은 빈 문자열.",
          input_schema: { type: "object", properties, required: FIELD_KEYS, additionalProperties: false },
        }],
        tool_choice: { type: "tool", name: "vendor_info" },
        messages: [{ role: "user", content }],
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(r.status).json({ error: data?.error?.message || "Claude API 오류", detail: data });
    }
    const toolUse = (data.content || []).find(b => b.type === "tool_use");
    if (!toolUse) return res.status(502).json({ error: "추출 결과를 받지 못했습니다.", detail: data });

    // 알려진 필드만 통과
    const fields = {};
    for (const k of FIELD_KEYS) fields[k] = typeof toolUse.input?.[k] === "string" ? toolUse.input[k].trim() : "";
    return res.status(200).json({ fields });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
