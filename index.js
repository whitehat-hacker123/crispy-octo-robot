import express from "express";
import { google } from "googleapis";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import { exec } from "child_process";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import autoReplyRouter from './auto-reply.js';
import keywordExtractorRouter from './keyword-extractor.js';
import mailStatsRouter from './mail-stats.js';
import aiResponseLogger from './ai-response-logger.js';

dotenv.config();

// 환경 변수 검증
const requiredEnvVars = ['OPENAI_API_KEY', 'CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ 누락된 환경 변수:', missingEnvVars.join(', '));
  process.exit(1);
}

const app = express();
const port = 3000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// OAuth2 클라이언트를 app.locals에 저장
app.locals.oauth2Client = oauth2Client;

app.use(bodyParser.urlencoded({ extended: true }));

// 보안 미들웨어 설정
app.use(helmet());

// 요청 제한 설정
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100 // IP당 최대 요청 수
});
app.use(limiter);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ],
});

// 기본 홈
app.get("/", (req, res) => {
  res.redirect(authUrl);
});

// Gmail 인증 콜백
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  res.send("✅ 인증 완료! 콘솔에서 메일 리스트 확인해 주세요");

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  
  // 처음에는 10개만 가져오기
  const initialResult = await gmail.users.messages.list({
    userId: "me",
    maxResults: 10,
    q: "in:all"
  });

  console.log("\x1b[40m%s\x1b[0m", " "); // 검은 배경
  console.log("\x1b[40m\x1b[37m%s\x1b[0m", "📨 최근 메일 리스트:"); // 흰색 텍스트

  let mailInfo = "";
  if (initialResult.data.messages && initialResult.data.messages.length > 0) {
    // 메일 개수 표시
    console.log("\x1b[40m\x1b[37m%s\x1b[0m", `최근 10개의 메일을 보여드립니다. 더 많은 메일을 보려면 "이전 메일 보여줘"라고 말씀해주세요.`);
    
    for (let i = 0; i < initialResult.data.messages.length; i++) {
      const message = await gmail.users.messages.get({
        userId: "me",
        id: initialResult.data.messages[i].id,
        format: "full",
      });

      const headers = message.data.payload.headers;
      const subject = headers.find((h) => h.name === "Subject")?.value || "(제목 없음)";
      const from = headers.find((h) => h.name === "From")?.value || "(보낸 사람 없음)";
      const date = headers.find((h) => h.name === "Date")?.value || "";
      const to = headers.find((h) => h.name === "To")?.value || "";
      const labels = message.data.labelIds || [];
      
      let body = "";
      if (message.data.payload.parts) {
        body = message.data.payload.parts[0].body.data;
      } else if (message.data.payload.body.data) {
        body = message.data.payload.body.data;
      }
      
      if (body) {
        body = Buffer.from(body, 'base64').toString('utf-8');
      }

      console.log("\x1b[40m\x1b[37m%s\x1b[0m", `📬 [${i + 1}] 제목: ${subject}`);
      console.log("\x1b[40m\x1b[37m%s\x1b[0m", `     👤 보낸 사람: ${from}`);
      console.log("\x1b[40m\x1b[37m%s\x1b[0m", `     ✉️ 요약: ${body ? body.substring(0, 200) + '...' : '(내용 없음)'}\n`);

      mailInfo += `메일 ${i + 1}:\n`;
      mailInfo += `제목: ${subject}\n`;
      mailInfo += `보낸 사람: ${from}\n`;
      mailInfo += `받는 사람: ${to}\n`;
      mailInfo += `날짜: ${date}\n`;
      mailInfo += `라벨: ${labels.join(', ')}\n`;
      mailInfo += `내용: ${body ? body.substring(0, 200) + '...' : '(내용 없음)'}\n\n`;
    }
  } else {
    console.log("\x1b[40m\x1b[37m%s\x1b[0m", "📭 읽을 메일이 없습니다.");
  }
  console.log("\x1b[40m%s\x1b[0m", " "); // 검은 배경
});

// 메일 작성 폼
app.get("/send", (req, res) => {
  res.send(`
    <style>
      body {
        background-color: #121212;
        color: #fff;
        font-family: Arial, sans-serif;
        margin: 20px;
      }
      input, textarea {
        background-color: #2a2a2a;
        color: #fff;
        border: 1px solid #444;
        border-radius: 4px;
        padding: 8px;
        margin: 5px 0;
      }
      button {
        background: linear-gradient(90deg, #1a2980 0%, #26d0ce 100%);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 10px 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        box-shadow: 0 0 8px 0 #26d0ce80;
        font-weight: bold;
        letter-spacing: 1px;
      }
      button:hover {
        background: linear-gradient(90deg, #26d0ce 0%, #1a2980 100%);
        box-shadow: 0 0 16px 2px #26d0cecc;
      }
    </style>
    <h1>✉️ 메일 보내기</h1>
    <form action="/send" method="POST">
      <label>받는 사람 이메일: <input type="email" name="to" required /></label><br><br>
      <label>제목: <input type="text" name="subject" required /></label><br><br>
      <label>내용:<br><textarea name="body" rows="8" cols="40" required></textarea></label><br><br>
      <button type="submit">보내기</button>
    </form>
  `);
});

// 메일 전송 처리
app.post("/send", async (req, res) => {
  const { to, subject, body } = req.body;
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const encodedMessage = Buffer.from(
    `To: ${to}\r\n` + `Subject: ${subject}\r\n\r\n` + `${body}`
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });
    res.send("✅ 메일 전송 완료!");
  } catch (err) {
    console.error("❌ 메일 전송 실패:", err);
    res.send("❌ 메일 전송 중 오류 발생");
  }
});

// AI 질문 폼
app.get("/ask-ai", (req, res) => {
  res.send(`
    <style>
      body {
        margin: 0;
        padding: 0;
        min-height: 100vh;
        background: linear-gradient(
          135deg,
          #0a192f 0%,
          #0a192f 20%,
          #000000 40%,
          #000000 100%
        );
        background-size: 400% 400%;
        animation: gradientBG 15s ease infinite;
        color: #fff;
        font-family: Arial, sans-serif;
      }
      @keyframes gradientBG {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      input, textarea {
        background-color: rgba(42, 42, 42, 0.8);
        color: #fff;
        border: 1px solid #444;
        border-radius: 4px;
        padding: 8px;
        margin: 5px 0;
      }
      button {
        background: linear-gradient(90deg, #1a2980 0%, #26d0ce 100%);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 10px 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
        box-shadow: 0 0 8px 0 #26d0ce80;
        font-weight: bold;
        letter-spacing: 1px;
      }
      button:hover {
        background: linear-gradient(90deg, #26d0ce 0%, #1a2980 100%);
        box-shadow: 0 0 16px 2px #26d0cecc;
      }
      #chat-container {
        max-width: 800px;
        margin: 20px auto;
        padding: 20px;
      }
      #chat-history {
        height: 400px;
        overflow-y: auto;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 20px;
        margin-bottom: 20px;
        background-color: rgba(26, 26, 26, 0.8);
        border-radius: 8px;
        backdrop-filter: blur(10px);
      }
      .message {
        margin-bottom: 15px;
        padding: 10px;
        border-radius: 8px;
      }
      .user-message {
        background-color: rgba(0, 123, 255, 0.1);
      }
      .ai-message {
        background-color: rgba(123, 153, 130, 0.1);
      }
    </style>
    <div id="chat-container">
      <h1 style="text-align: center; margin-bottom: 30px;">AI와 대화하기</h1>
      <div id="chat-history">
        <p style="color: #888;">AI와 대화를 시작해보세요!</p>
      </div>
      <form id="chat-form" action="/ai-reply" method="POST" style="display: flex; gap: 10px;">
        <input type="text" name="prompt" placeholder="질문을 입력하세요..." style="flex-grow: 1; padding: 10px;" required />
        <button type="submit">전송</button>
      </form>
    </div>
    <script>
      const chatHistory = document.getElementById('chat-history');
      const chatForm = document.getElementById('chat-form');
      const promptInput = chatForm.querySelector('input[name="prompt"]');

      chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const prompt = promptInput.value;
        
        // 사용자 메시지 추가
        chatHistory.innerHTML += '<div class="message user-message">' +
          '<p style="color: #007bff; font-weight: bold;">나:</p>' +
          '<p style="color: #fff;">' + prompt + '</p>' +
        '</div>';
        
        try {
          const response = await fetch('/ai-reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'prompt=' + encodeURIComponent(prompt)
          });
          
          const data = await response.text();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data;
          
          // AI 응답 추가
          const aiResponse = tempDiv.querySelector('.ai-response').innerHTML;
          chatHistory.innerHTML += '<div class="message ai-message">' +
            '<p style="color:rgb(123, 153, 130); font-weight: bold;">AI:</p>' +
            '<div class="ai-response" style="color: #fff;">' + aiResponse + '</div>' +
          '</div>';
          
          // 스크롤을 최신 메시지로 이동
          chatHistory.scrollTop = chatHistory.scrollHeight;
          promptInput.value = '';
        } catch (error) {
          console.error('Error:', error);
          chatHistory.innerHTML += '<div style="color: #ff4444; margin-bottom: 15px;">오류가 발생했습니다. 다시 시도해주세요.</div>';
        }
      });
    </script>
  `);
});

// 자동 응답 설정 페이지
app.get("/auto-reply", (req, res) => {
  res.send(`
    <style>
      body {
        margin: 0;
        padding: 0;
        min-height: 100vh;
        background: linear-gradient(
          135deg,
          #0a192f 0%,
          #0a192f 20%,
          #000000 40%,
          #000000 100%
        );
        background-size: 400% 400%;
        animation: gradientBG 15s ease infinite;
        color: #fff;
        font-family: Arial, sans-serif;
      }
      @keyframes gradientBG {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .container {
        max-width: 800px;
        margin: 20px auto;
        padding: 20px;
      }
      .mode-selector {
        display: flex;
        gap: 20px;
        margin-bottom: 30px;
      }
      .mode-card {
        flex: 1;
        background: rgba(42, 42, 42, 0.8);
        padding: 20px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .mode-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
      }
      .mode-card.selected {
        border: 2px solid #26d0ce;
      }
      .settings {
        background: rgba(42, 42, 42, 0.8);
        padding: 20px;
        border-radius: 8px;
        margin-top: 20px;
      }
      input[type="text"], textarea {
        width: 100%;
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid #444;
        color: #fff;
        padding: 10px;
        margin: 5px 0;
        border-radius: 4px;
      }
      button {
        background: linear-gradient(90deg, #1a2980 0%, #26d0ce 100%);
        color: white;
        border: none;
        border-radius: 4px;
        padding: 10px 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 10px;
      }
      button:hover {
        background: linear-gradient(90deg, #26d0ce 0%, #1a2980 100%);
      }
    </style>
    <div class="container">
      <h1 style="text-align: center;">자동 응답 설정</h1>
      
      <div class="mode-selector">
        <div class="mode-card" onclick="selectMode('auto')">
          <h3>자동 모드</h3>
          <p>GPT가 자동으로 메일을 분석하고 응답합니다.</p>
        </div>
        <div class="mode-card" onclick="selectMode('confirm')">
          <h3>확인 모드</h3>
          <p>GPT가 응답을 생성하고 사용자 확인 후 전송합니다.</p>
        </div>
      </div>

      <div class="settings">
        <h3>응답 설정</h3>
        <div>
          <label>응답 스타일:</label>
          <input type="text" id="responseStyle" placeholder="예: 공식적, 친근한, 전문적인">
        </div>
        <div>
          <label>주요 키워드:</label>
          <input type="text" id="keywords" placeholder="예: 회의, 프로젝트, 긴급">
        </div>
        <div>
          <label>제외할 키워드:</label>
          <input type="text" id="excludeKeywords" placeholder="예: 스팸, 광고">
        </div>
        <button onclick="saveSettings()">설정 저장</button>
      </div>
    </div>

    <script>
      let selectedMode = 'confirm';
      
      function selectMode(mode) {
        selectedMode = mode;
        document.querySelectorAll('.mode-card').forEach(card => {
          card.classList.remove('selected');
        });
        event.currentTarget.classList.add('selected');
      }

      async function saveSettings() {
        const settings = {
          mode: selectedMode,
          responseStyle: document.getElementById('responseStyle').value,
          keywords: document.getElementById('keywords').value,
          excludeKeywords: document.getElementById('excludeKeywords').value
        };

        try {
          const response = await fetch('/save-auto-reply-settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(settings)
          });

          if (response.ok) {
            alert('설정이 저장되었습니다!');
          } else {
            alert('설정 저장 중 오류가 발생했습니다.');
          }
        } catch (error) {
          console.error('Error:', error);
          alert('설정 저장 중 오류가 발생했습니다.');
        }
      }
    </script>
  `);
});

// 자동 응답 설정 저장
app.post("/save-auto-reply-settings", express.json(), (req, res) => {
  const settings = req.body;
  // TODO: 설정을 데이터베이스나 파일에 저장
  res.json({ success: true });
});

// 자동 응답 처리
app.post("/process-auto-reply", express.json(), async (req, res) => {
  const { messageId, mode } = req.body;
  
  try {
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    const message = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = message.data.payload.headers;
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const from = headers.find((h) => h.name === "From")?.value || "";
    
    let body = "";
    if (message.data.payload.parts) {
      body = message.data.payload.parts[0].body.data;
    } else if (message.data.payload.body.data) {
      body = message.data.payload.body.data;
    }
    
    if (body) {
      body = Buffer.from(body, 'base64').toString('utf-8');
    }

    // GPT를 사용하여 응답 생성
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: `다음 메일에 대한 적절한 응답을 작성해주세요:
        제목: ${subject}
        보낸 사람: ${from}
        내용: ${body}
        
        응답은 공식적이고 전문적인 톤으로 작성해주세요.`,
    });

    const replyContent = response.output_text;

    if (mode === 'auto') {
      // 자동 모드: 바로 응답 전송
      const encodedMessage = Buffer.from(
        `To: ${from}\r\n` +
        `Subject: Re: ${subject}\r\n\r\n` +
        `${replyContent}`
      ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });

      res.json({ success: true, message: "자동 응답이 전송되었습니다." });
    } else {
      // 확인 모드: 응답 내용 반환
      res.json({
        success: true,
        replyContent,
        originalMessage: {
          subject,
          from,
          body
        }
      });
    }
  } catch (error) {
    console.error("자동 응답 처리 실패:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 자동 응답 라우터 추가
app.use('/auto-reply', autoReplyRouter);

// 키워드 추출 라우터 추가
app.use('/keyword-extractor', keywordExtractorRouter);

// 메일 통계 라우터 추가
app.use('/mail-stats', mailStatsRouter);

// AI 응답 로거 라우터 추가
app.use('/ai-response-logger', aiResponseLogger);

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
  exec(`start http://localhost:${port}`);
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error('❌ 서버 에러:', err);
  res.status(500).send(
    '<div style="color: #ff0000; padding: 20px; border: 1px solid #ff0000; border-radius: 8px;">' +
      '❌ 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' +
    '</div>'
  );
  next();
});

// 404 처리
app.use((req, res, next) => {
  res.status(404).send(
    '<div style="color: #ff0000; padding: 20px; border: 1px solid #ff0000; border-radius: 8px;">' +
      '❌ 요청하신 페이지를 찾을 수 없습니다.' +
    '</div>'
  );
  next();
});
