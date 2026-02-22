// server.js — 오늘의 운세 로컬 테스트 서버
// 실행: node server.js
// 접속: http://localhost:3000

const http = require("http");
const fs = require("fs");
const path = require("path");

// ─── API 키 여기에 입력 ──────────────────────────────────
const ANTHROPIC_API_KEY = "process.env.ANTHROPIC_API_KEY";
// https://console.anthropic.com 에서 발급
// ────────────────────────────────────────────────────────

const PORT = 3000;

const SYSTEM_PROMPT = `너는 전국 직장인을 위한 멘탈 보호 서비스야.
    매일 직장인의 현실을 찌르되, 마지막엔 살짝 위로가 남는 문장을 만들어.

    문장 구조:
    - 첫 문장: 현실 팩폭. 짧고 직격탄.
    - 두 번째 문장: 근데 사실 대단하다는 반전. 또는 위로. 또는 쓴웃음 나오는 마무리.
    - 전체 2~3문장. 너무 길면 김샘.

    말투:
    - 친한 친구가 놀리듯 말 거는 스타일
    - ~야 ~해 ~지? ~잖아 ~다 자연스럽게 섞기
    - ㅋ 은 진짜 웃긴 상황에만 가끔. 남발 금지
    - AI 같은 말투 절대 금지. 사람이 카톡으로 보내는 말투.

    이런 문장을 참고해:
    알람 울리자마자 한숨부터 나왔지? 그래도 일어나긴 했네. 네 의지박약도 생존 앞에서는 얌전해진다.
    점심 뭐 먹을지 고민하는 시간이 오늘 하루 중 제일 진지했다. 그래도 그 고민할 여유는 있네. 아직 안 망했어.
    월급 들어오는 날만 회사가 살짝 예뻐 보이지? 인간은 참 단순하다. 너도 포함이야.
    이번 프로젝트만 끝나면… 그 말 몇 번째야? 그래도 끝까지 붙들고 있는 네가 제일 독하다.
    회의에서 말은 많았는데 결론은 없었지. 근데 넌 거기 앉아 있었어. 그게 월급 값이다.
    퇴근하고 싶어서 하루 종일 버텼지? 그 버틴 시간이 네 커리어다. 화려하진 않아도 꾸준히 쌓이고 있어.

    출력 규칙:
    - 문장만 출력. 오늘의 운세: 같은 접두어 없이.
    - 따옴표 없이.
    - 그 외 아무것도 쓰지 마.`;

const THEMES = [
  "출근하기 싫은 월요일 아침",
  "회의가 너무 많은 하루",
  "퇴근하고 싶은 오후",
  "하기 싫은 보고서",
  "야근이 예고된 저녁",
  "월급날 전날의 통장",
  "상사 눈치 보는 하루",
  "점심 먹고 쏟아지는 졸음",
  "아무것도 하기 싫은 날",
  "퇴사 생각이 드는 순간",
  "주말이 너무 짧은 월요일",
  "일은 많고 의욕은 없는 날",
  "칼퇴를 꿈꾸는 직장인",
  "커피로 버티는 오전"
];

function getTodaysTheme() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  return THEMES[dayOfYear % THEMES.length];
}

function passesModeration(sentence) {
  if (sentence.length < 15 || sentence.length > 250) return false;
  //if (!sentence.startsWith("오늘의 운세:")) return false;
  const forbidden = [/\n/, /["'"]/];
  return !forbidden.some((p) => p.test(sentence));
}

async function generateSentence(theme) {
  const body = JSON.stringify({
    model: "claude-opus-4-6",
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `오늘의 테마: "${theme}". 오늘의 운세 문장을 만들어줘.`
    }]
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body
  });

  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text.trim();
}

// ─── 서버 ────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // HTML 서빙
  if (url.pathname === "/" || url.pathname === "/index.html") {
    try {
      const file = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(file);
    } catch {
      res.writeHead(404); res.end("index.html을 같은 폴더에 넣어주세요.");
    }
    return;
  }

  // AI 문장 생성
  if (url.pathname === "/api/generate") {
    if (ANTHROPIC_API_KEY === "여기에-API-키-입력") {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "API 키를 server.js 4번째 줄에 입력해주세요." }));
      return;
    }

    const theme = url.searchParams.get("theme") || getTodaysTheme();
    console.log(`\n테마: "${theme}" 생성 중...`);

    const FALLBACK = [
      "니 통장잔고 열어봐. 그게 오늘 출근 이유야.",
      "출근 전부터 퇴근 생각했지ㅋ 그게 벌써 몇 년째야.",
      "오늘만 버티면 된다고 했는데, 어제도 그 말 했어.",
      "퇴근 5분 전에 카톡 올 거 알면서 왜 기대해.",
    ];

    let sentence = null;
    let source = "ai";

    for (let i = 1; i <= 3; i++) {
      try {
        const candidate = await generateSentence(theme);
        console.log(`  시도 ${i}: "${candidate}"`);
        if (passesModeration(candidate)) {
          sentence = candidate;
          console.log(`  ✅ 통과`);
          break;
        } else {
          console.log(`  ❌ 검수 실패, 재시도`);
        }
      } catch (err) {
        console.error(`  오류:`, err.message);
      }
    }

    if (!sentence) {
      sentence = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
      source = "fallback";
      console.log(`  → fallback: "${sentence}"`);
    }

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ sentence, theme, source }));
    return;
  }

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  오늘의 운세 — 로컬 서버`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  if (ANTHROPIC_API_KEY === "여기에-API-키-입력") {
    console.log(`\n  ⚠️  API 키 미설정`);
    console.log(`  server.js 4번째 줄에 키를 입력하세요`);
    console.log(`  → https://console.anthropic.com\n`);
  } else {
    console.log(`\n  ✅ 준비 완료\n`);
  }
});
