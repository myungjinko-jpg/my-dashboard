import { useEffect, useMemo, useState } from "react";

const OWNERS = {
  "2bdd": { label: "권현조", short: "권", color: "#4f7ef0" },
  "2f4d": { label: "고명진", short: "고", color: "#a855f7" },
  "318d": { label: "반건욱", short: "반", color: "#ec4899" },
  "34fd": { label: "최장용", short: "최", color: "#f59e0b" },
  "36cd": { label: "김량희", short: "김", color: "#22c55e" },
};

const STATUS_MAP = {
  "DEV Iteration":     { stripe: "#22c55e", short: "DEV Iteration" },
  "UA testing":        { stripe: "#4f9cf0", short: "UA Testing" },
  "Action Needed":     { stripe: "#ef4444", short: "Action Needed" },
  "In Preparation":    { stripe: "#56637a", short: "In Prep." },
  "Need Discuss":      { stripe: "#f59e0b", short: "Need Discuss" },
  "Under negotiation": { stripe: "#a855f7", short: "Under Neg." },
  "Drop & Archive":    { stripe: "#374151", short: "Archived" },
};

const STATUS_ORDER = {
  "Action Needed": 0, "UA testing": 1, "DEV Iteration": 2,
  "In Preparation": 3, "Need Discuss": 4, "Under negotiation": 5, "Drop & Archive": 6,
};

const STAGES = [
  { key: "Stage 1 - Iteration",  label: "Stage 1 · Iteration", pip: "#f59e0b" },
  { key: "Stage 0 - CPI Test",   label: "Stage 0 · CPI Test",  pip: "#ec4899" },
  { key: "Stage 0 - Prototype",  label: "Stage 0 · Prototype", pip: "#8b5cf6" },
  { key: "Stage 0 - Ideation",   label: "Stage 0 · Ideation",  pip: "#64748b" },
  { key: "Drop",                  label: "Drop",                pip: "#374151" },
];

const NOTE_TAG = {
  next:    { txt: "예정", color: "#60a5fa" },
  ongoing: { txt: "진행", color: "#4ade80" },
  fix:     { txt: "픽스", color: "#fb923c" },
  hold:    { txt: "홀드", color: "#f59e0b" },
  done:    { txt: "종료", color: "#56637a" },
};

const PROJECTS = [
  // Stage 1 - Iteration
  { name: "Claw Shop: Tycoon Game",    studio: "ALBUS",     stage: "Stage 1 - Iteration", status: "DEV Iteration", platform: ["AOS","iOS"], contract: "파트너십 계약 완료",   iter: "#5",       owner: "2bdd", noteType: "next",    note: "6/30(화) 테스트 진행 목표",              url: "https://www.notion.so/329a45eaf6d380fc9180d6fd8117569b" },
  { name: "Tile Adventure: Match-3",   studio: "IMBA",      stage: "Stage 1 - Iteration", status: "UA testing",    platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "#3",       owner: "2bdd", noteType: "ongoing", note: "6/26~6/30 테스트 진행중",                url: "https://www.notion.so/329a45eaf6d380fd85a2f30ca04b8f88" },
  { name: "Arrow Pixel: Color Shooter",studio: "Minder",    stage: "Stage 1 - Iteration", status: "DEV Iteration", platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "#1",       owner: "2f4d", noteType: "next",    note: "6/29(월) 이터레이션 방향 공유 예정",     url: "https://www.notion.so/329a45eaf6d380ea8368d19931e1ca80" },
  { name: "Pinball Marble Flow",       studio: "Pundun",    stage: "Stage 1 - Iteration", status: "DEV Iteration", platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "#1",       owner: "2f4d", noteType: "next",    note: "6/29(월) 이터레이션 개발 일정 공유 예정",url: "https://www.notion.so/34ba45eaf6d38071bc2de74eb3fab468" },
  { name: "Sort Factory",              studio: "Gameyogi",  stage: "Stage 1 - Iteration", status: "DEV Iteration", platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "#1",       owner: "36cd", noteType: "ongoing", note: "6/25~6/29 AOS CPI 테스트 진행중",        url: "https://www.notion.so/34fa45eaf6d380a9ab63f65a7161dc79" },
  // Stage 0 - CPI Test
  { name: "Sticker Saga",              studio: "Celesta",   stage: "Stage 0 - CPI Test",  status: "UA testing",    platform: ["AOS"],       contract: "CPI 계약서 검토중",    iter: "cpi test", owner: "2f4d", noteType: "ongoing", note: "6/30~7/4 캠페인 진행 중",                url: "https://www.notion.so/37da45eaf6d3806b98d0e140510f7169" },
  { name: "Twisted Arrows",            studio: "Fiber Games",stage:"Stage 0 - CPI Test",  status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "N/A",      owner: "318d", noteType: "next",    note: "(6/17) 개발사 내부적으로 테스트 진행하고 지표 공유 예정", url: "https://www.notion.so/329a45eaf6d3808f9398d929c9c58081" },
  { name: "Bearcade Blast",            studio: "Fiber Games",stage:"Stage 0 - CPI Test",  status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "N/A",      owner: "318d", noteType: "next",    note: "(6/17) 개발사 내부적으로 테스트 진행하고 지표 공유 예정", url: "https://www.notion.so/329a45eaf6d380eea312c37d8336d582" },
  { name: "Dig Mania",                 studio: "Palefire",  stage: "Stage 0 - CPI Test",  status: "UA testing",    platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "318d", noteType: "ongoing", note: "6/25(목) ~ 6/29(월) 테스트 진행중",      url: "https://www.notion.so/345a45eaf6d380539754cb524a2e957f" },
  { name: "Laser Block Jam",           studio: "R2D",       stage: "Stage 0 - CPI Test",  status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "N/A",      owner: "318d", noteType: "next",    note: "6/26 가이드 전달 및 SDK 세팅 요청",        url: "https://www.notion.so/356a45eaf6d3809abe3cda2fb18199b6" },
  { name: "Triple Match Satars",       studio: "momosh",    stage: "Stage 0 - CPI Test",  status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "N/A",      owner: "318d", noteType: "ongoing", note: "6/30(화) 가이드 전달, 7/2(금) 작업 완료 예정", url: "https://www.notion.so/33ea45eaf6d380bd8e27c8e87fdca79e" },
  { name: "신작 검토 중",               studio: "Ripple",    stage: "Stage 0 - CPI Test",  status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "N/A",      owner: "318d", noteType: "next",    note: "",                                          url: "https://www.notion.so/329a45eaf6d3808496f7e4c3ae6d0827" },
  // Stage 0 - Prototype
  { name: "Screw Flow",                studio: "Pick6",     stage: "Stage 0 - Prototype", status: "Action Needed", platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "cpi test", owner: "34fd", noteType: "ongoing", note: "6/23~6/27 테스트 진행중",                url: "https://www.notion.so/361a45eaf6d380c1b035ec8b6edd0a8c" },
  { name: "Tasty Merge",               studio: "Easy Goging",stage:"Stage 0 - Prototype", status: "UA testing",    platform: ["AOS","iOS"], contract: "파트너십 계약 검토중", iter: "cpi test", owner: "36cd", noteType: "ongoing", note: "6/23~6/27 iOS CPI 테스트 진행중",        url: "https://www.notion.so/375a45eaf6d3803abcd3cb8b1e71c2a5" },
  { name: "Sticker World",             studio: "zombie mate",stage:"Stage 0 - Prototype", status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "34fd", noteType: "ongoing", note: "06/23~06/27 테스트 진행 중",             url: "https://www.notion.so/36fa45eaf6d38075b658e84b4649eef6" },
  { name: "Iza's Supermarket",         studio: "IzyPlay",   stage: "Stage 0 - Prototype", status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "34fd", noteType: "next",    note: "GA 연동 완료, 개발사 자체 QA",           url: "https://www.notion.so/379a45eaf6d380e7b446c131bbf085dd" },
  { name: "Block Master",              studio: "Lumos Games",stage:"Stage 0 - Prototype", status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "34fd", noteType: "done",    note: "테스트 완료, 다음 플랜 협의 중",         url: "https://www.notion.so/379a45eaf6d3800ca7eaf660aa747eb8" },
  { name: "Embered Time",              studio: "UNIC-ON",   stage: "Stage 0 - Prototype", status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "34fd", noteType: "ongoing", note: "06/24~06/28 테스트 진행 중",             url: "https://www.notion.so/37ba45eaf6d380b28278e6d534f1c1f1" },
  { name: "Wordscapes Solitaire",      studio: "MGIF",      stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "cpi test", owner: "2f4d", noteType: "fix",     note: "7/9(목) 플레이어블 공유",                url: "https://www.notion.so/367a45eaf6d380eebbe8eaeb0db6acc9" },
  { name: "Bubble Word Jam",           studio: "Minder",    stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "부속합의서 협의 완료", iter: "cpi test", owner: "2f4d", noteType: "fix",     note: "7/11(금) 프로토타입 완료 목표",          url: "https://www.notion.so/352a45eaf6d3807ca4b7fd4b60cdcacd" },
  { name: "Evo War TD",                studio: "Crabby",    stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "cpi test", owner: "2f4d", noteType: "fix",     note: "7/10(금) 프로토타입 공유 예정",          url: "https://www.notion.so/35da45eaf6d380f99556cb1d2a898ff8" },
  { name: "Sticker Patch",             studio: "Pundun",    stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "부속합의서 협의 완료", iter: "cpi test", owner: "2f4d", noteType: "fix",     note: "6/26(금) 최종 빌드 목표일",              url: "https://www.notion.so/37da45eaf6d380a38f00e9e724f75075" },
  { name: "Aqua Chain Rescue",         studio: "Makemake",  stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "부속합의서 추가 필요", iter: "cpi test", owner: "2bdd", noteType: "fix",     note: "6/30(화) 레벨 디자인 + 최종 프로토타입",url: "https://www.notion.so/375a45eaf6d380bb8e87fa7dc0718685" },
  { name: "Stack to Survive",          studio: "Dlite",     stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "cpi test", owner: "2bdd", noteType: "next",    note: "7/1(수) 테스트 진행 목표",               url: "https://www.notion.so/36ea45eaf6d38053ad48f3bac8a7709a" },
  { name: "Strategy Paths",            studio: "Zezo",      stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "부속합의서 추가 필요", iter: "cpi test", owner: "2bdd", noteType: "next",    note: "7월 4주 최종 빌드 공유",                 url: "https://www.notion.so/37ba45eaf6d3802f8dbaf034f2ff653e" },
  { name: "Clean it Up!",              studio: "Zezo",      stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "cpi test", owner: "2bdd", noteType: "fix",     note: "7월 2주 Final Build 공유",               url: "https://www.notion.so/36da45eaf6d380f8b970fac6b4ac0b17" },
  { name: "Werewolf Hero",             studio: "Zimo",      stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "파트너십 계약 검토중", iter: "cpi test", owner: "2bdd", noteType: "fix",     note: "7/7(화) 중간빌드 공유",                  url: "https://www.notion.so/37da45eaf6d38080ae06df401ed4e6b5" },
  { name: "Pin Jam",                   studio: "Pick6",     stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "부속합의서 추가 필요", iter: "cpi test", owner: "34fd", noteType: "next",    note: "7월 1주 테스트 진행 목표",               url: "https://www.notion.so/34ca45eaf6d3805da0fbf8542f86e507" },
  { name: "Weapon Clash: Shooting Duel",studio:"BOOBOO",   stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "파트너십 계약 완료",   iter: "cpi test", owner: "36cd", noteType: "fix",     note: "6/30(화) 폴리시, QA + 최종 딜리버리",   url: "https://www.notion.so/34ca45eaf6d380f79b42f5361cbe2160" },
  { name: "Block Stack - Line Blast",  studio: "Gameyogi",  stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "36cd", noteType: "fix",     note: "6/30 3차 빌드 (이펙트+2개 게임 모드)",   url: "https://www.notion.so/36ea45eaf6d380ff9759eb83d3820c31" },
  { name: "Plant Warriors",            studio: "Gameyogi",  stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "부속합의서 협의 완료", iter: "cpi test", owner: "36cd", noteType: "fix",     note: "7/3~7/5 1차 빌드 공유",                  url: "https://www.notion.so/37ba45eaf6d380098e56f857c90a4950" },
  { name: "Space Miner",               studio: "BOOBOO",    stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "부속합의서 추가 필요", iter: "cpi test", owner: "36cd", noteType: "fix",     note: "7월 1주차 중간 빌드 공유",               url: "https://www.notion.so/37aa45eaf6d3800a871bd469d2de4442" },
  { name: "Sand Box Sort",             studio: "Furtle",    stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "36cd", noteType: "next",    note: "7/12(일) 중간 빌드 공유",                url: "https://www.notion.so/375a45eaf6d3800c8b55e2ccace9d9c4" },
  { name: "Carve Jam",                 studio: "Furtle",    stage: "Stage 0 - Prototype", status: "DEV Iteration", platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "36cd", noteType: "next",    note: "7/12 중간 빌드 공유",                    url: "https://www.notion.so/384a45eaf6d38032b01bc6e131d0c911" },
  { name: "Balls Brawl",               studio: "Boomie",    stage: "Stage 0 - Prototype", status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "36cd", noteType: "next",    note: "7/13일 중간 빌드 공유",                  url: "https://www.notion.so/38ba45eaf6d380c1918ee3c298a950c8" },
  { name: "Lipstick Sort",             studio: "Boomie",    stage: "Stage 0 - Prototype", status: "In Preparation",platform: ["AOS"],       contract: "-",                    iter: "cpi test", owner: "36cd", noteType: "next",    note: "7/13일 중간 빌드 공유",                  url: "https://www.notion.so/38ba45eaf6d380aabe73fed36a66b5ef" },
  // Stage 0 - Ideation
  { name: "노노그램 신작",              studio: "Joy One Studio",stage:"Stage 0 - Ideation",status:"In Preparation",platform:["AOS"],        contract: "파트너십 계약 검토중", iter: "N/A",      owner: "2f4d", noteType: "next",    note: "7월 둘째주 신작 프로토타입 공유 예정",   url: "https://www.notion.so/388a45eaf6d3808cbafbd1d2704aaf10" },
  { name: "신작 검토 (아이데이션 중)",   studio: "Gapu",      stage: "Stage 0 - Ideation",  status:"In Preparation",platform:[],             contract: "파트너십 계약 검토중", iter: "N/A",      owner: "2f4d", noteType: "fix",     note: "7/2(목) GDD 공유 예정",                  url: "https://www.notion.so/38ba45eaf6d38007a4f6d6b59dfd2058" },
  { name: "신작 검토 (아이데이션 중)",   studio: "Wolves Interactive",stage:"Stage 0 - Ideation",status:"In Preparation",platform:[],         contract: "파트너십 계약 검토중", iter: "N/A",      owner: "2f4d", noteType: "fix",     note: "7/3(금) GDD 공유 예정",                  url: "https://www.notion.so/38aa45eaf6d3807cbb72e031ce41b8e1" },
  { name: "Crazy Rogue Bird",          studio: "Joly Ape",  stage: "Stage 0 - Ideation",  status:"In Preparation",platform:["AOS"],         contract: "-",                    iter: "N/A",      owner: "2bdd", noteType: "next",    note: "7월 1주 파트너십 논의 예정",             url: "https://www.notion.so/383a45eaf6d380169324c1f6ceea52a0" },
  { name: "신작 검토 (아이데이션 중)",   studio: "Yabu",      stage: "Stage 0 - Ideation",  status:"In Preparation",platform:["AOS"],         contract: "-",                    iter: "N/A",      owner: "2bdd", noteType: "next",    note: "7월 1주 GDD 공유 예정",                  url: "https://www.notion.so/38ba45eaf6d3803f9cf4de98be8bd00e" },
  { name: "신작 검토 (아이데이션 중)",   studio: "HyperPixel",stage: "Stage 0 - Ideation",  status:"In Preparation",platform:["AOS"],         contract: "-",                    iter: "N/A",      owner: "2bdd", noteType: "next",    note: "7월 2주 GDD 공유 예정",                  url: "https://www.notion.so/38fa45eaf6d380c6a7ead6cbacee1a3d" },
  { name: "Fluffu's Journey",          studio: "Unwind",    stage: "Stage 0 - Ideation",  status:"In Preparation",platform:["AOS"],         contract: "-",                    iter: "cpi test", owner: "34fd", noteType: "hold",    note: "자금/인력 부족으로 추가 개발 당장 어려움",url:"https://www.notion.so/375a45eaf6d3807f8accdc789a8e1840" },
  { name: "GDD 검토중",                studio: "IzyPlay",   stage: "Stage 0 - Ideation",  status:"In Preparation",platform:["AOS"],         contract: "-",                    iter: "N/A",      owner: "34fd", noteType: "ongoing", note: "06/26 sushi & beach 커뮤니케이션 시작",  url: "https://www.notion.so/37aa45eaf6d380dc9f75fa30a6a5e734" },
  // Drop
  { name: "Cat Drop",                  studio: "Minder",    stage: "Drop", status: "Drop & Archive", platform: ["AOS"], contract: "드롭",                iter: "cpi test", owner: "34fd", noteType: "done", note: "4/14 테스트 후 드롭",          url: "https://www.notion.so/329a45eaf6d380cb956cd5c08acb9aa7" },
  { name: "Arrow Escape: Stickman Fight",studio:"Inwave",   stage: "Drop", status: "Drop & Archive", platform: ["AOS"], contract: "드롭",                iter: "cpi test", owner: "34fd", noteType: "done", note: "4/15 테스트 후 드롭",          url: "https://www.notion.so/329a45eaf6d3808f9398d929c9c58081" },
  { name: "Dragon Jam: Girl Rescue",   studio: "Inwave",    stage: "Drop", status: "Drop & Archive", platform: ["AOS"], contract: "드롭",                iter: "cpi test", owner: "34fd", noteType: "done", note: "4/15 테스트 후 드롭",          url: "https://www.notion.so/329a45eaf6d380eea312c37d8336d582" },
  { name: "Stonica",                   studio: "Adeline",   stage: "Drop", status: "Drop & Archive", platform: ["AOS"], contract: "부속합의서 추가 필요",iter: "#1",       owner: "34fd", noteType: "done", note: "5/18 최종 협의 후 드롭",       url: "https://www.notion.so/345a45eaf6d380539754cb524a2e957f" },
  { name: "Sheep Jam",                 studio: "Crabby",    stage: "Drop", status: "Drop & Archive", platform: ["AOS"], contract: "파트너십 계약 검토중",iter: "cpi test", owner: "34fd", noteType: "done", note: "5/21 Crabby측 의견으로 최종 드롭",url:"https://www.notion.so/356a45eaf6d3809abe3cda2fb18199b6" },
  { name: "Slime Hole",                studio: "Makemake",  stage: "Drop", status: "Drop & Archive", platform: ["AOS"], contract: "파트너십 계약 완료",  iter: "cpi test", owner: "2bdd", noteType: "done", note: "5/26 테스트 종료 및 드롭",     url: "https://www.notion.so/33ea45eaf6d380bd8e27c8e87fdca79e" },
  { name: "Liquid Cat Puzzle",         studio: "Hala Games",stage: "Drop", status: "Drop & Archive", platform: ["AOS"], contract: "드롭",                iter: "cpi test", owner: "2bdd", noteType: "done", note: "드롭 완료",                    url: "https://www.notion.so/329a45eaf6d3808496f7e4c3ae6d0827" },
];

// ─── Utilities ─────────────────────────────────────────────────────────────

function parseNoteDates(note, year = 2026) {
  if (!note) return [];
  return [...note.matchAll(/(\d{1,2})\/(\d{1,2})/g)]
    .map(m => new Date(year, parseInt(m[1]) - 1, parseInt(m[2])));
}

function getWeekBounds() {
  const today = new Date();
  const dow = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 0);
  return { mon, sun };
}

function fmt(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const DOW_KR = ["일","월","화","수","목","금","토"];

// ─── Sub-components ────────────────────────────────────────────────────────

function OwnerDot({ owner, size = 18 }) {
  const own = OWNERS[owner] || { short: "?", color: "#56637a", label: "?" };
  return (
    <div title={own.label} style={{
      width: size, height: size, borderRadius: "50%", background: own.color, flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.44, fontWeight: 800, color: "#fff",
    }}>{own.short}</div>
  );
}

function StatusPill({ status }) {
  const si = STATUS_MAP[status] || STATUS_MAP["In Preparation"];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 600,
      color: si.stripe, background: si.stripe + "18", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 4, height: 4, borderRadius: "50%", background: "currentColor", flexShrink: 0, display: "inline-block" }} />
      {si.short}
    </span>
  );
}

function PlatChips({ platform }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {platform.map(pl => (
        <span key={pl} style={{
          fontSize: 9, padding: "1px 5px", borderRadius: 2, fontWeight: 700,
          background: pl === "iOS" ? "rgba(255,69,58,.12)" : "rgba(52,199,89,.12)",
          color: pl === "iOS" ? "#ef4444" : "#22c55e",
          border: `1px solid ${pl === "iOS" ? "rgba(255,69,58,.2)" : "rgba(52,199,89,.2)"}`,
        }}>{pl}</span>
      ))}
    </div>
  );
}

function SidePanel({ project: p, onClose }) {
  const [visible, setVisible] = useState(false);
  const si = STATUS_MAP[p.status] || STATUS_MAP["In Preparation"];
  const nt = NOTE_TAG[p.noteType] || NOTE_TAG.done;
  const own = OWNERS[p.owner] || { label: "?", color: "#56637a" };
  const stage = STAGES.find(s => s.key === p.stage);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const noteLines = p.note ? p.note.split("\n").filter(Boolean) : [];

  return (
    <>
      {/* backdrop */}
      <div onClick={handleClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
        zIndex: 200, opacity: visible ? 1 : 0, transition: "opacity .22s",
      }} />
      {/* panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 400,
        background: "var(--card)", borderLeft: "1px solid var(--card-border)",
        zIndex: 201, overflowY: "auto", display: "flex", flexDirection: "column",
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "transform .22s ease",
        boxShadow: "-12px 0 32px rgba(0,0,0,.15)",
      }}>
        {/* header */}
        <div style={{
          padding: "16px 20px 14px", borderBottom: "1px solid var(--card-border)",
          position: "sticky", top: 0, background: "var(--card)", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, justifyContent: "space-between" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", lineHeight: 1.3, marginBottom: 6 }}>{p.name}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {stage && <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--line)", padding: "2px 7px", borderRadius: 3 }}>{stage.label}</span>}
                <StatusPill status={p.status} />
              </div>
            </div>
            <button onClick={handleClose} style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: "var(--muted)", fontSize: 18, lineHeight: 1, padding: "2px 4px", flexShrink: 0,
            }}>✕</button>
          </div>
        </div>

        {/* body */}
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
          {/* top stripe accent */}
          <div style={{ height: 3, borderRadius: 2, background: si.stripe, marginBottom: -8 }} />

          {/* info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" }}>
            {[
              ["Studio", p.studio],
              ["Iteration", p.iter],
              ["Owner", own.label],
              ["Platform", p.platform.join(" · ") || "-"],
              ["Contract", p.contract === "-" ? "미계약" : p.contract],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--muted)", marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>

          <div style={{ height: 1, background: "var(--line)" }} />

          {/* Biz Notes */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: "var(--muted)", marginBottom: 8 }}>📝 Biz Notes</div>
            {noteLines.length === 0
              ? <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>업데이트 내용 없음</div>
              : noteLines.map((line, i) => {
                  const tagMatch = line.match(/^(예정|진행상황|진행중|테스트|픽스|종료|홀드|테스트 예정|테스트 진행중|진행)\s*/);
                  const tagTxt = tagMatch ? tagMatch[0].trim() : null;
                  const rest = tagTxt ? line.slice(tagMatch[0].length) : line;
                  const tagColor = tagTxt
                    ? (["예정","테스트 예정"].includes(tagTxt) ? "#60a5fa"
                      : ["진행상황","진행중","테스트 진행중","진행","테스트"].includes(tagTxt) ? "#4ade80"
                      : tagTxt === "픽스" ? "#fb923c"
                      : tagTxt === "홀드" ? "#f59e0b"
                      : "#56637a")
                    : null;
                  return (
                    <div key={i} style={{
                      fontSize: 12, color: "var(--text)", lineHeight: 1.6,
                      padding: "6px 10px", marginBottom: 4,
                      background: "var(--bg)", borderRadius: 4,
                      borderLeft: `3px solid ${tagColor || "var(--line)"}`,
                    }}>
                      {tagTxt && <span style={{ fontWeight: 700, color: tagColor, marginRight: 6 }}>{tagTxt}</span>}
                      {rest}
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--card-border)" }}>
          <a href={p.url} target="_blank" rel="noopener noreferrer" style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            padding: "9px 16px", borderRadius: 6,
            background: "var(--primary)", color: "#fff",
            textDecoration: "none", fontSize: 13, fontWeight: 600,
          }}>
            노션에서 열기 ↗
          </a>
        </div>
      </div>
    </>
  );
}

const STATUS_FILTER_LABEL = { action: "Action Needed", ua: "UA Testing", dev: "DEV Iteration" };
const STATUS_FILTER_COLOR = { action: "#ef4444", ua: "#4f9cf0", dev: "#22c55e" };

function WeeklySection({ items, totalCount, statusFilter, onSelect }) {
  const { mon, sun } = getWeekBounds();
  const rangeLabel = `${fmt(mon)}(${DOW_KR[mon.getDay()]}) ~ ${fmt(sun)}(${DOW_KR[sun.getDay()]})`;
  const isFiltered = statusFilter && statusFilter !== "all";

  // group by earliest date in note
  const grouped = useMemo(() => {
    const map = new Map();
    items.forEach(p => {
      const dates = parseNoteDates(p.note);
      const key = dates.length > 0
        ? `${dates[0].getMonth() + 1}/${dates[0].getDate()}(${DOW_KR[dates[0].getDay()]})`
        : "날짜 미정";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return [...map.entries()];
  }, [items]);

  return (
    <div style={{
      margin: "0 0 20px",
      padding: "16px 18px",
      background: "var(--card)",
      border: "1px solid var(--card-border)",
      borderRadius: "10px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 3, height: 18, borderRadius: 2, background: "#f59e0b", flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>이번 주 체크</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{rangeLabel}</span>
        {isFiltered && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8,
            background: STATUS_FILTER_COLOR[statusFilter] + "22",
            color: STATUS_FILTER_COLOR[statusFilter],
            border: `1px solid ${STATUS_FILTER_COLOR[statusFilter]}44`,
          }}>{STATUS_FILTER_LABEL[statusFilter]}</span>
        )}
        <span style={{
          marginLeft: "auto", fontSize: 11, fontWeight: 700,
          background: "#f59e0b22", color: "#f59e0b",
          border: "1px solid #f59e0b44",
          padding: "2px 10px", borderRadius: 10, fontVariantNumeric: "tabular-nums",
        }}>{items.length}{isFiltered ? ` / ${totalCount}` : ""}건</span>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 0" }}>이번 주 예정된 마감/업데이트 항목이 없습니다</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {grouped.map(([dateLabel, ps]) => (
            <div key={dateLabel}>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em",
                color: "#f59e0b", marginBottom: 6,
              }}>{dateLabel}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 6 }}>
                {ps.map((p, i) => {
                  const si = STATUS_MAP[p.status] || STATUS_MAP["In Preparation"];
                  const nt = NOTE_TAG[p.noteType] || NOTE_TAG.done;
                  const own = OWNERS[p.owner] || { short: "?", color: "#56637a" };
                  return (
                    <div key={i} onClick={() => onSelect(p)} style={{
                      display: "flex", gap: 10, alignItems: "center",
                      padding: "8px 12px", borderRadius: 6, cursor: "pointer",
                      background: "var(--bg)", border: "1px solid var(--line)",
                      borderLeft: `3px solid ${si.stripe}`,
                      transition: "background .1s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--hover, #f5f7fd)"}
                      onMouseLeave={e => e.currentTarget.style.background = "var(--bg)"}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%", background: own.color,
                        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 800, color: "#fff",
                      }}>{own.short}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          <span style={{ fontWeight: 700, color: nt.color, marginRight: 3 }}>{nt.txt}</span>
                          {p.note}
                        </div>
                      </div>
                      <StatusPill status={p.status} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectRow({ p, onSelect }) {
  const si = STATUS_MAP[p.status] || STATUS_MAP["In Preparation"];
  const nt = NOTE_TAG[p.noteType] || NOTE_TAG.done;

  return (
    <div
      onClick={() => onSelect(p)}
      style={{
        display: "grid",
        gridTemplateColumns: "3px minmax(180px,1fr) 90px 64px 20px minmax(80px,120px) minmax(140px,1fr) 20px",
        alignItems: "center", gap: "10px", padding: "7px 10px 7px 0",
        background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: "5px",
        cursor: "pointer", transition: "background .1s", color: "inherit", minWidth: "760px",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--hover, #f5f7fd)"}
      onMouseLeave={e => e.currentTarget.style.background = "var(--card)"}
    >
      <div style={{ alignSelf: "stretch", borderRadius: "4px 0 0 4px", background: si.stripe, minHeight: 32 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{p.studio} · {p.iter}</div>
      </div>
      <div><StatusPill status={p.status} /></div>
      <PlatChips platform={p.platform} />
      <OwnerDot owner={p.owner} />
      <div style={{ fontSize: 10, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {p.contract !== "-" ? p.contract : ""}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
        {p.note && <><span style={{ fontSize: 10, fontWeight: 700, color: nt.color, marginRight: 4 }}>{nt.txt}</span>{p.note}</>}
      </div>
      <div style={{ fontSize: 12, textAlign: "center", color: "var(--muted)", opacity: 0.4 }}>›</div>
    </div>
  );
}

// ─── KPI Cards ────────────────────────────────────────────────────────────

function KpiCard({ value, label, sub, color, onClick, active }) {
  return (
    <div onClick={onClick} style={{
      flex: "1 1 140px", minWidth: 120,
      padding: "14px 16px",
      background: active ? `${color}18` : "var(--card)",
      border: `1px solid ${active ? color + "55" : "var(--card-border)"}`,
      borderRadius: 8,
      cursor: onClick ? "pointer" : "default",
      transition: "all .15s",
      outline: active ? `2px solid ${color}33` : "none",
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = `${color}12`; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.background = active ? `${color}18` : "var(--card)"; }}
    >
      <div style={{
        fontSize: 28, fontWeight: 800, color, lineHeight: 1,
        fontVariantNumeric: "tabular-nums", marginBottom: 4,
      }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export default function ProjectDashboard() {
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDrop, setShowDrop] = useState(false);
  const [collapsed, setCollapsed] = useState(new Set());
  const [selected, setSelected] = useState(null);

  const toggleCollapse = (key) => setCollapsed(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const { mon, sun } = useMemo(() => getWeekBounds(), []);

  const weeklyItems = useMemo(() => {
    return PROJECTS.filter(p => {
      if (p.stage === "Drop") return false;
      const dates = parseNoteDates(p.note);
      return dates.some(d => d >= mon && d <= sun);
    }).sort((a, b) => {
      const da = parseNoteDates(a.note)[0] || new Date(9999, 0);
      const db = parseNoteDates(b.note)[0] || new Date(9999, 0);
      return da - db;
    });
  }, [mon, sun]);

  const visibleAll = useMemo(() => PROJECTS.filter(p => showDrop || p.stage !== "Drop"), [showDrop]);

  const matchesStatus = (p) => {
    if (statusFilter === "action") return p.status === "Action Needed";
    if (statusFilter === "ua")     return p.status === "UA testing";
    if (statusFilter === "dev")    return p.status === "DEV Iteration";
    return true;
  };

  const filtered = useMemo(() => visibleAll.filter(p => {
    if (ownerFilter !== "all" && p.owner !== ownerFilter) return false;
    return matchesStatus(p);
  }), [visibleAll, ownerFilter, statusFilter]);

  const filteredWeeklyItems = useMemo(() =>
    weeklyItems.filter(matchesStatus),
  [weeklyItems, statusFilter]);

  const counts = useMemo(() => ({
    action: visibleAll.filter(p => p.status === "Action Needed").length,
    ua:     visibleAll.filter(p => p.status === "UA testing").length,
    dev:    visibleAll.filter(p => p.status === "DEV Iteration").length,
    all:    visibleAll.length,
  }), [visibleAll]);

  const sep = { width: 1, height: 18, background: "var(--line)", flexShrink: 0 };

  return (
    <div style={{ padding: "0 0 60px" }}>
      {/* KPI cards */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "16px 0 16px" }}>
        <KpiCard
          value={weeklyItems.length}
          label="이번 주 체크"
          sub="6/29(월) ~ 7/5(일)"
          color="#f59e0b"
          onClick={() => {}}
        />
        <KpiCard
          value={counts.action}
          label="Action Needed"
          sub="즉시 확인 필요"
          color="#ef4444"
          onClick={() => setStatusFilter(s => s === "action" ? "all" : "action")}
          active={statusFilter === "action"}
        />
        <KpiCard
          value={counts.ua}
          label="UA Testing"
          sub="광고 테스트 진행 중"
          color="#4f9cf0"
          onClick={() => setStatusFilter(s => s === "ua" ? "all" : "ua")}
          active={statusFilter === "ua"}
        />
        <KpiCard
          value={counts.dev}
          label="DEV Iteration"
          sub="개발 이터레이션 중"
          color="#22c55e"
          onClick={() => setStatusFilter(s => s === "dev" ? "all" : "dev")}
          active={statusFilter === "dev"}
        />
        <KpiCard
          value={counts.all}
          label="전체 프로젝트"
          sub={`Stage 0~1 활성`}
          color="var(--muted)"
          onClick={() => setStatusFilter("all")}
          active={statusFilter === "all"}
        />
      </div>

      {/* weekly section */}
      <WeeklySection items={filteredWeeklyItems} totalCount={weeklyItems.length} statusFilter={statusFilter} onSelect={setSelected} />

      {/* filter bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        margin: "0 0 14px", padding: "10px 14px",
        background: "var(--card)", border: "1px solid var(--card-border)", borderRadius: 8,
      }}>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>Owner</span>
        {["all", "2bdd", "2f4d", "318d", "34fd", "36cd"].map(key => (
          <button key={key}
            onClick={() => setOwnerFilter(key)}
            style={{
              padding: "3px 9px", borderRadius: 4,
              border: `1px solid ${ownerFilter === key ? "var(--primary)" : "var(--card-border)"}`,
              background: ownerFilter === key ? "var(--primary)" : "transparent",
              color: ownerFilter === key ? "#fff" : "var(--muted)",
              cursor: "pointer", fontSize: 11, fontFamily: "inherit", transition: "all .12s",
            }}>
            {key === "all" ? "전체" : OWNERS[key].label}
          </button>
        ))}

        <div style={sep} />

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)", cursor: "pointer", userSelect: "none", marginLeft: "auto" }}
          onClick={() => setShowDrop(v => !v)}>
          <div style={{
            width: 26, height: 14, borderRadius: 7,
            background: showDrop ? "var(--primary)" : "var(--line)",
            position: "relative", flexShrink: 0, transition: "background .12s",
          }}>
            <div style={{
              position: "absolute", width: 10, height: 10, borderRadius: "50%",
              background: "#fff", top: 2, left: showDrop ? 14 : 2, transition: "left .12s",
            }} />
          </div>
          Drop 표시
        </label>
      </div>

      {/* legend */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 12, fontSize: 11, color: "var(--muted)" }}>
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em" }}>Owner</span>
        {Object.entries(OWNERS).map(([k, v]) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: v.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: "#fff" }}>{v.short}</span>
            {v.label}
          </span>
        ))}
        <div style={sep} />
        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em" }}>Biz Notes</span>
        {Object.entries(NOTE_TAG).filter(([k]) => k !== "done").map(([k, v]) => (
          <span key={k}><span style={{ fontWeight: 700, color: v.color, fontSize: 10 }}>{v.txt}</span> <span style={{ fontSize: 11 }}>{k}</span></span>
        ))}
      </div>

      {/* stage sections */}
      {STAGES.filter(stg => showDrop || stg.key !== "Drop").map(stg => {
        const items = filtered
          .filter(p => p.stage === stg.key)
          .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
        const isCollapsed = collapsed.has(stg.key);

        return (
          <div key={stg.key} style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px 4px", cursor: "pointer", userSelect: "none" }}
              onClick={() => toggleCollapse(stg.key)}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: stg.pip, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--muted)" }}>{stg.label}</span>
              <span style={{ fontSize: 10, color: "var(--muted)", background: "var(--bg)", border: "1px solid var(--line)", padding: "0 6px", borderRadius: 8, fontVariantNumeric: "tabular-nums" }}>{items.length}</span>
              <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 11, transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform .15s" }}>▾</span>
            </div>
            {!isCollapsed && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: 8, overflowX: "auto" }}>
                {items.length === 0
                  ? <div style={{ padding: 14, textAlign: "center", color: "var(--muted)", fontSize: 12, background: "var(--card)", border: "1px dashed var(--card-border)", borderRadius: 5 }}>이 필터 조건에 해당하는 프로젝트가 없습니다</div>
                  : items.map((p, i) => <ProjectRow key={`${p.name}-${i}`} p={p} onSelect={setSelected} />)
                }
              </div>
            )}
          </div>
        );
      })}

      {/* side panel */}
      {selected && <SidePanel project={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
