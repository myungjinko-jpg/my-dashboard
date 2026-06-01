import flickLogo from "../assets/Flick Brand Logo.png";

const MESSAGES = [
  "현조님, 기획서 37번째 버전 불러오는 중",
  "명진님 KPI 목표치 살짝 올리는 중",
  "이번 iteration은 다를 거야 — 선봉조 리더 談",
  "장원님께 물어보면 다 알 수 있음. 로딩 중",
  "오늘의 상식 담당: 장원님 대기 중",
  "장원님 파트너사 슬랙 읽씹 확인 중",
  "혜림님 썸네일 시안 12번째 수정 중",
  "혜림님 폰트 한 번만 더 바꾸는 중",
  "혜림님 크리에이티브 툴 빌드 배포 중",
  "디자이너가 개발까지 — 혜림님 스택 업데이트 중",
  "장용님 CPI $0.01 낮추는 법 구글링 중",
  "건욱님 Meta 광고 예산 추가 요청서 작성 중",
  "장용님, 건욱님 CTR 올려줄 소재 기도 중",
  "목표: 어떤 프로젝트든 스케일업. 지금 그 과정 중",
  "데이터는 거짓말 안 해, 해석을 잘못하는 거지 — Flick 팀 名言",
  "이번엔 진짜 유의미한 결과 나올 것 같은데 (매 iteration 동일 발언)",
];

export default function LoadingScreen({ msgIndex, dots }) {
  const msg = MESSAGES[msgIndex] ?? MESSAGES[0];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#000",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "40px",
    }}>
      <img src={flickLogo} alt="Flick" style={{ width: "560px", maxWidth: "80vw" }} />

      <div style={{ width: "560px", maxWidth: "80vw", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ fontSize: "18px", color: "rgba(255,255,255,0.55)", textAlign: "center", letterSpacing: "0.02em", lineHeight: 1.6 }}>
          {msg}<span style={{ display: "inline-block", width: "1.5em", textAlign: "left" }}>{dots}</span>
        </div>
        <div style={{ width: "100%", height: "8px", background: "rgba(255,255,255,0.15)", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ height: "100%", background: "#fff", borderRadius: "999px", animation: "progress 3s cubic-bezier(0.4, 0, 0.2, 1) forwards" }} />
        </div>
        <div style={{ textAlign: "right", fontSize: "16px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.05em" }}>
          v3.3.0
        </div>
      </div>

      <style>{`
        @keyframes progress {
          0%   { width: 0%; }
          60%  { width: 75%; }
          85%  { width: 88%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  );
}
