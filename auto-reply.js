import express from 'express';
import { google } from 'googleapis';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 자동 응답 설정 저장
let autoReplySettings = {
  mode: 'confirm', // 'auto' or 'confirm'
  responseStyle: '',
  keywords: '',
  excludeKeywords: ''
};

// 자동 응답 설정 페이지
router.get('/', (req, res) => {
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
      let selectedMode = '${autoReplySettings.mode}';
      
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
          const response = await fetch('/auto-reply/settings', {
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

      // 초기 설정 로드
      window.onload = async () => {
        try {
          const response = await fetch('/auto-reply/settings');
          const settings = await response.json();
          
          document.getElementById('responseStyle').value = settings.responseStyle || '';
          document.getElementById('keywords').value = settings.keywords || '';
          document.getElementById('excludeKeywords').value = settings.excludeKeywords || '';
          
          selectMode(settings.mode);
        } catch (error) {
          console.error('Error loading settings:', error);
        }
      };
    </script>
  `);
});

// 설정 저장
router.post('/settings', express.json(), (req, res) => {
  autoReplySettings = { ...autoReplySettings, ...req.body };
  res.json({ success: true });
});

// 설정 조회
router.get('/settings', (req, res) => {
  res.json(autoReplySettings);
});

// 자동 응답 처리
router.post('/process', express.json(), async (req, res) => {
  const { messageId, mode } = req.body;
  
  try {
    const gmail = google.gmail({ version: "v1", auth: req.app.locals.oauth2Client });
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
        
        응답 스타일: ${autoReplySettings.responseStyle}
        주요 키워드: ${autoReplySettings.keywords}
        제외할 키워드: ${autoReplySettings.excludeKeywords}
        
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

export default router; 