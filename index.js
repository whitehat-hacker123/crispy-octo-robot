import express from "express";
import { google } from "googleapis";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import { exec } from "child_process";

dotenv.config();

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
      }
      button:hover {
        background-color: #0056b3;
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
      }
      button:hover {
        background-color: #0056b3;
      }
    </style>
    <h1>AI와 대화하기</h1>
    <div id="chat-container" style="max-width: 800px; margin: 20px auto;">
      <div id="chat-history" style="height: 400px; overflow-y: auto; border: 1px solid #444; padding: 20px; margin-bottom: 20px; background-color: #1a1a1a; color: #fff;">
        <p style="color: #888;">AI와 대화를 시작해보세요!</p>
      </div>
      <form id="chat-form" action="/ai-reply" method="POST" style="display: flex; gap: 10px;">
        <input type="text" name="prompt" placeholder="질문을 입력하세요..." style="flex-grow: 1; padding: 10px; background-color: #2a2a2a; color: #fff; border: 1px solid #444; border-radius: 4px;" required />
        <button type="submit" style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">전송</button>
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
          <div style="margin-bottom: 15px;">
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
            <div style="margin-bottom: 15px;">
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

// AI 응답 처리
app.post("/ai-reply", async (req, res) => {
  try {
    const { prompt } = req.body;

    // 인증 여부 확인
    if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
      res.send(`
        <div class="ai-response" style="background-color: #333; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p>⚠️ 먼저 <a href="/" style="color: #007bff;">여기</a>를 클릭해서 구글 인증을 완료해 주세요.</p>
        </div>
      `);
      return;
    }

    // 먼저 질문이 이메일 관련인지 AI가 판단
    const topicCheckResponse = await openai.responses.create({
      model: "gpt-4o-mini",
      input: `다음 질문이 이메일이나 메일과 관련된 질문인지 판단해주세요. 
      이메일/메일 관련 질문이면 'true'를, 그렇지 않으면 'false'를 출력하세요.
      질문: ${prompt}`,
    });

    const isEmailRelated = topicCheckResponse.output_text.trim().toLowerCase() === 'true';

    let mailInfo = "";
    if (isEmailRelated) {
      // Gmail API를 통한 메일 정보 가져오기
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });
      
      // 처음에는 10개만 가져오기
      const initialResult = await gmail.users.messages.list({
        userId: "me",
        maxResults: 10,
        q: "in:all"
      });

      if (initialResult.data.messages && initialResult.data.messages.length > 0) {
        // 메일 개수 표시
        mailInfo += `최근 10개의 메일을 보여드립니다. 더 많은 메일을 보려면 "이전 메일 보여줘"라고 말씀해주세요.\n\n`;
        
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

          mailInfo += `메일 ${i + 1}:\n`;
          mailInfo += `제목: ${subject}\n`;
          mailInfo += `보낸 사람: ${from}\n`;
          mailInfo += `받는 사람: ${to}\n`;
          mailInfo += `날짜: ${date}\n`;
          mailInfo += `라벨: ${labels.join(', ')}\n`;
          mailInfo += `내용: ${body ? body.substring(0, 200) + '...' : '(내용 없음)'}\n\n`;
        }
      } else {
        mailInfo = "읽을 메일이 없습니다.";
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

    // 이전 메일 요청인 경우 추가 메일 가져오기
    if (prompt.toLowerCase().includes('이전') || prompt.toLowerCase().includes('더 많은')) {
      const nextPageToken = initialResult.data.nextPageToken;
      if (nextPageToken) {
        const nextResult = await gmail.users.messages.list({
          userId: "me",
          maxResults: 10,
          pageToken: nextPageToken,
          q: "in:all"
        });

        if (nextResult.data.messages && nextResult.data.messages.length > 0) {
          let additionalMailInfo = "\n다음 10개의 메일입니다:\n\n";
          
          for (let i = 0; i < nextResult.data.messages.length; i++) {
            const message = await gmail.users.messages.get({
              userId: "me",
              id: nextResult.data.messages[i].id,
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

            additionalMailInfo += `메일 ${i + 1}:\n`;
            additionalMailInfo += `제목: ${subject}\n`;
            additionalMailInfo += `보낸 사람: ${from}\n`;
            additionalMailInfo += `받는 사람: ${to}\n`;
            additionalMailInfo += `날짜: ${date}\n`;
            additionalMailInfo += `라벨: ${labels.join(', ')}\n`;
            additionalMailInfo += `내용: ${body ? body.substring(0, 200) + '...' : '(내용 없음)'}\n\n`;
          }

          // AI에게 추가 메일 정보 전달
          const additionalResponse = await openai.responses.create({
            model: "gpt-4o-mini",
            input: `${systemPrompt}\n\n추가 메일 정보:\n${additionalMailInfo}\n\n사용자 질문: ${prompt}`,
          });

          res.send(`
            <div class="ai-response" style="background-color: #333; color: #fff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="white-space: pre-wrap;">${additionalResponse.output_text}</p>
            </div>
          `);
          return;
        }
      }
    }

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
