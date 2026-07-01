# my-dashboard

내부용 CPI Test Dashboard + LTV Calculator. React + Vite, Vercel 배포.

## 프로젝트 구조

```
src/
  App.jsx               # CPI 대시보드 메인
  utils.js              # 공통 유틸 함수
  components/
    LtvCalculator.jsx   # LTV 계산기 (탭으로 전환)
    KpiGrid.jsx         # KPI 카드 영역
    ChartSection.jsx    # CPI/D1 Retention 트렌드 차트
    IterationTable.jsx  # Iteration 비교 테이블
    DailyTable.jsx      # 일별 지표 테이블
    LoadingScreen.jsx   # 초기 로딩 화면
api/
  remind.js             # Vercel Cron 자동 슬랙 리마인더
  status.js             # 수동 슬랙 현황 공유
```

## 데이터 소스

- **구글 시트**: `1pBJWVce2CgrPBlFMGbS2yCp6tBQnNn4gkEHz7jG3LZk`
- **시트 탭명**: `Test_Raw Data` (URL 인코딩: `Test_Raw%20Data`)
- **API**: `https://opensheet.elk.sh/{SHEET_ID}/Test_Raw%20Data` (무료 서비스, 가끔 지연 있음)
- 컬럼: `Project`, `Iteration`, `Date`, `CPI`, `Installs (Meta)`, `Installs (GA)`, `D1 Retention`, `D0 Playtime`, `D1 Playtime`

## CPI 대시보드 주요 로직

- **Live 프로젝트 판단**: 마지막 데이터 날짜가 `오늘 - 2일` 이후인 프로젝트
- **날짜 형식**: `2026. 6. 3` (점 구분, `parseDateValue`로 파싱)
- **가중 평균**: CPI는 Meta 설치수, Retention/Playtime은 GA 설치수 기준 가중 평균

## LTV Calculator

`src/components/LtvCalculator.jsx` — 파워 법칙 잔존율 모델 기반 LTV 시뮬레이터.

**입력 파라미터**
- `D1 Retention`: D1 잔존율
- `k`: 감쇠 계수 (power law: `ret(d) = D1 × d^k`)
- `ARPDAU`: 일 평균 매출 / 유저
- `IAP:IAA 비중`: 인앱결제 vs 광고수익 비율 (수동 조정 필요)
- `CPI`: 유저 획득 비용

**주요 기능**
- LTV D1/D7/D14/D30/D90, Breakeven 일자, ROI 자동 계산
- Retention Curve + Cumulative LTV vs CPI 차트
- Monthly Breakdown 테이블 (12개월)
- Benchmark: AppMagic CSV 업로드 → 경쟁 앱 지표 자동 입력
- Saved Scenarios: 파라미터 세트 저장/불러오기

**외부 연동**
- `VITE_LTV_SCRIPT_URL` 환경변수 → Google Apps Script URL (프리셋/벤치마크 저장소)
- Apps Script 미설정 시 계산기 기능은 동작하나 저장/벤치마크 기능 비활성화

## 슬랙 알림

- **채널**: `#biz_alert`, 그룹 멘션: `<!subteam^S0AE7K2HLM6|biz>`
- **자동 리마인더**: Vercel Cron `0 0 * * *` (UTC) = KST 약 09:00, `api/remind.js`
- **수동 공유**: 대시보드 내 "Slack Update" 버튼 → `api/status.js`
- **알림 로직**: `null`(시작 전) / `false`(미입력) / `true`(완료) 3단계, 시작 전 프로젝트 제외, 완료 상위 정렬

## 환경변수 (Vercel)

- `SLACK_WEBHOOK_URL`: 슬랙 Incoming Webhook
- `VITE_LTV_SCRIPT_URL`: LTV 계산기용 Apps Script URL

## 배포

- **URL**: https://my-dashboard-gamma-amber.vercel.app
- GitHub push → Vercel 자동 배포 (main 브랜치)
- 롤백: `git revert` 사용 (git reset 금지)
