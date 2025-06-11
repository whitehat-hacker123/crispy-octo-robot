import express from "express";
import { google } from "googleapis";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import { exec } from "child_process";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

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
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 10px 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
      }
      button:hover {
        background-color: #0056b3;
      }
      button:hover::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: linear-gradient(
          45deg,
rgb(0, 47, 255),
rgb(0, 31, 185),
rgb(62, 2, 126),
rgb(25, 1, 82),
        );
        background-size: 400%;
        z-index: -1;
        border-radius: 6px;
        animation: glowing 20s linear infinite;
      }
      @keyframes glowing {
        0% { background-position: 0 0; }
        50% { background-position: 400% 0; }
        100% { background-position: 0 0; }
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
rgb(0, 65, 161) 0%,
rgb(5, 54, 126) 20%,
rgb(8, 0, 82) 40%,
          #000000 100%
        );
        background-size: 300% 300%;
        animation: gradientBG 10s ease infinite;
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
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 10px 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
      }
      button:hover {
        background-color: #0056b3;
      }
      button:hover::before {
        content: '';
        position: absolute;
        top: -2px;
        left: -2px;
        right: -2px;
        bottom: -2px;
        background: linear-gradient(
          45deg,
rgb(0, 47, 255),
rgb(0, 31, 185),
rgb(62, 2, 126),
rgb(25, 1, 82),
        );
        background-size: 400%;
        z-index: -1;
        border-radius: 6px;
        animation: glowing 20s linear infinite;
      }
      @keyframes glowing {
        0% { background-position: 0 0; }
        50% { background-position: 400% 0; }
        100% { background-position: 0 0; }
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
        chatHistory.innerHTML += \`
          <div class="message user-message">
            <p style="color: #007bff; font-weight: bold;">나:</p>
            <p style="color: #fff;">\${prompt}</p>
          </div>
        \`;
        
        try {
          const response = await fetch('/ai-reply', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: \`prompt=\${encodeURIComponent(prompt)}\`
          });
          
          const data = await response.text();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = data;
          
          // AI 응답 추가
          const aiResponse = tempDiv.querySelector('.ai-response').innerHTML;
          chatHistory.innerHTML += \`
            <div class="message ai-message">
              <p style="color:rgb(123, 153, 130); font-weight: bold;">AI:</p>
              <div class="ai-response" style="color: #fff;">\${aiResponse}</div>
            </div>
          \`;
          
          // 스크롤을 최신 메시지로 이동
          chatHistory.scrollTop = chatHistory.scrollHeight;
          promptInput.value = '';
        } catch (error) {
          console.error('Error:', error);
          chatHistory.innerHTML += \`
            <div style="color: #ff4444; margin-bottom: 15px;">
              오류가 발생했습니다. 다시 시도해주세요.
            </div>
          \`;
        }
      });
    </script>
  `);
});

async function getMailInfo(gmail, maxResults = 10, pageToken = null) {
  try {
    const result = await gmail.users.messages.list({
      userId: "me",
      maxResults,
      pageToken,
      q: "in:all"
    });

    if (!result.data.messages || result.data.messages.length === 0) {
      return { mailInfo: "읽을 메일이 없습니다.", nextPageToken: null };
    }

    let mailInfo = `최근 ${result.data.messages.length}개의 메일을 보여드립니다. 더 많은 메일을 보려면 "이전 메일 보여줘"라고 말씀해주세요.\n\n`;
    
    for (const message of result.data.messages) {
      const messageData = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full",
      });

      const headers = messageData.data.payload.headers;
      const subject = headers.find((h) => h.name === "Subject")?.value || "(제목 없음)";
      const from = headers.find((h) => h.name === "From")?.value || "(보낸 사람 없음)";
      const date = headers.find((h) => h.name === "Date")?.value || "";
      const to = headers.find((h) => h.name === "To")?.value || "";
      const labels = messageData.data.labelIds || [];
      
      let body = "";
      if (messageData.data.payload.parts) {
        body = messageData.data.payload.parts[0].body.data;
      } else if (messageData.data.payload.body.data) {
        body = messageData.data.payload.body.data;
      }
      
      if (body) {
        body = Buffer.from(body, 'base64').toString('utf-8');
      }

      mailInfo += `메일 ${result.data.messages.indexOf(message) + 1}:\n`;
      mailInfo += `제목: ${subject}\n`;
      mailInfo += `보낸 사람: ${from}\n`;
      mailInfo += `받는 사람: ${to}\n`;
      mailInfo += `날짜: ${date}\n`;
      mailInfo += `라벨: ${labels.join(', ')}\n`;
      mailInfo += `내용: ${body ? body.substring(0, 200) + '...' : '(내용 없음)'}\n\n`;
    }

    return {
      mailInfo,
      nextPageToken: result.data.nextPageToken
    };
  } catch (error) {
    console.error('메일 정보 가져오기 실패:', error);
    throw error;
  }
}

// AI 응답 처리
app.post("/ai-reply", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      res.send(`
        <div class="ai-response" style="background-color: #333; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>⚠️ 먼저 <a href="/" style="color: #007bff;">여기</a>를 클릭해서 구글 인증을 완료해 주세요.</p>
        </div>
      `);
      return;
    }

    const topicCheckResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: `다음 질문이 이메일이나 메일과 관련된 질문인지 판단해주세요. 
      이메일/메일 관련 질문이면 'true'를, 그렇지 않으면 'false'를 출력하세요.
      질문: ${prompt}`,
    });

    const isEmailRelated = topicCheckResponse.output_text.trim().toLowerCase() === 'true';

    let mailInfo = "";
    if (isEmailRelated) {
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      const { mailInfo: fetchedMailInfo, nextPageToken } = await getMailInfo(gmail);
      mailInfo = fetchedMailInfo;
      
      if (prompt.toLowerCase().includes('이전') || prompt.toLowerCase().includes('더 많은')) {
        if (nextPageToken) {
          const { mailInfo: additionalMailInfo } = await getMailInfo(gmail, 10, nextPageToken);
          mailInfo += "\n다음 10개의 메일입니다:\n\n" + additionalMailInfo;
        }
      }
    }

    // AI에게 전달할 프롬프트 구성
    const systemPrompt = `너는 이메일 에이전트야.

사용자의 요청이 이메일 관련이면 처리하고, 아니면 "이메일 관련 질문만 도와드릴 수 있어요"라고 답해.

이메일 관련 요청은 4가지다:

1. 요약  
2. 번역  
3. 삭제  
4. 검색

단어가 정확하지 않아도 유추해. "그 메일 번역해줘", "3번째 이후 보여줘" 같은 말도 처리해.

현재 메일 정보:
${mailInfo}

이제부터 사용자 요청을 이해하고, 행동해.

만약 사용자가 "이전 메일 보여줘" 또는 "더 많은 메일 보여줘"라고 요청하면, 
Gmail API를 사용하여 다음 10개의 메일을 추가로 가져와서 보여줘.`;

    // AI 응답 생성
    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: `${systemPrompt}\n\n사용자 질문: ${prompt}`,
    });

    const reply = response.output_text;

    res.send(`
      <div class="ai-response" style="background-color: #333; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="white-space: pre-wrap;">${reply}</p>
      </div>
    `);
  } catch (err) {
    console.error("AI 응답 실패:", err);
    res.status(500).send(`
      <div style="color: #ff0000; padding: 20px; border: 1px solid #ff0000; border-radius: 8px;">
        ❌ 오류 발생: ${err.message}
      </div>
    `);
  }
});

app.listen(port, () => {
  console.log(`🚀 서버 실행 중: http://localhost:${port}`);
  exec(`start http://localhost:${port}`);
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error('❌ 서버 에러:', err);
  res.status(500).send(`
    <div style="color: #ff0000; padding: 20px; border: 1px solid #ff0000; border-radius: 8px;">
      ❌ 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
    </div>
  `);
});

// 404 처리
app.use((req, res) => {
  res.status(404).send(`
    <div style="color: #ff0000; padding: 20px; border: 1px solid #ff0000; border-radius: 8px;">
      ❌ 요청하신 페이지를 찾을 수 없습니다.
    </div>
  `);
});
