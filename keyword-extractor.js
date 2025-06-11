import express from 'express';
import { google } from 'googleapis';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 키워드 추출 페이지
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
        max-width: 1000px;
        margin: 20px auto;
        padding: 20px;
      }
      .mail-list {
        background: rgba(42, 42, 42, 0.8);
        padding: 20px;
        border-radius: 8px;
        margin-bottom: 20px;
      }
      .mail-item {
        background: rgba(26, 26, 26, 0.8);
        padding: 15px;
        margin: 10px 0;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.3s ease;
      }
      .mail-item:hover {
        transform: translateX(5px);
        background: rgba(38, 208, 206, 0.1);
      }
      .keyword-container {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 10px;
      }
      .keyword {
        background: linear-gradient(90deg, #1a2980 0%, #26d0ce 100%);
        padding: 5px 10px;
        border-radius: 15px;
        font-size: 0.9em;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      .keyword-score {
        background: rgba(255, 255, 255, 0.2);
        padding: 2px 6px;
        border-radius: 10px;
        font-size: 0.8em;
      }
      .loading {
        text-align: center;
        padding: 20px;
        color: #26d0ce;
      }
      .error {
        color: #ff4444;
        padding: 10px;
        background: rgba(255, 68, 68, 0.1);
        border-radius: 4px;
        margin: 10px 0;
      }
    </style>
    <div class="container">
      <h1 style="text-align: center;">메일 키워드 분석</h1>
      
      <div class="mail-list">
        <h2>최근 메일</h2>
        <div id="mailList">
          <div class="loading">메일을 불러오는 중...</div>
        </div>
      </div>
    </div>

    <script>
      async function loadMails() {
        try {
          const response = await fetch('/keyword-extractor/mails');
          const mails = await response.json();
          
          const mailList = document.getElementById('mailList');
          mailList.innerHTML = '';
          
          mails.forEach(mail => {
            const keywords = Array.isArray(mail.keywords) ? mail.keywords : [];
            const mailItem = document.createElement('div');
            mailItem.className = 'mail-item';
            
            let keywordsHtml = '';
            keywords.forEach(keyword => {
              keywordsHtml += '<div class="keyword">' + keyword.text + 
                '<span class="keyword-score">' + keyword.score + '%</span></div>';
            });

            mailItem.innerHTML = 
              '<h3>' + mail.subject + '</h3>' +
              '<p>보낸 사람: ' + mail.from + '</p>' +
              '<p>날짜: ' + mail.date + '</p>' +
              '<div class="keyword-container">' + keywordsHtml + '</div>';

            mailList.appendChild(mailItem);
          });
        } catch (error) {
          console.error('Error:', error);
          document.getElementById('mailList').innerHTML = 
            '<div class="error">메일을 불러오는 중 오류가 발생했습니다.</div>';
        }
      }

      // 페이지 로드 시 메일 목록 불러오기
      window.onload = loadMails;
    </script>
  `);
});

// 메일 목록과 키워드 가져오기
router.get('/mails', async (req, res) => {
  try {
    const gmail = google.gmail({ version: "v1", auth: req.app.locals.oauth2Client });
    
    // 최근 10개의 메일 가져오기
    const result = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
      q: "in:all"
    });

    if (!result.data.messages) {
      return res.json([]);
    }

    const mails = await Promise.all(result.data.messages.map(async (message) => {
      const messageData = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full",
      });

      const headers = messageData.data.payload.headers;
      const subject = headers.find((h) => h.name === "Subject")?.value || "(제목 없음)";
      const from = headers.find((h) => h.name === "From")?.value || "(보낸 사람 없음)";
      const date = headers.find((h) => h.name === "Date")?.value || "";
      
      let body = "";
      if (messageData.data.payload.parts) {
        const textPart = messageData.data.payload.parts.find(part => 
          part.mimeType === "text/plain" || part.mimeType === "text/html"
        );
        if (textPart && textPart.body.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      } else if (messageData.data.payload.body && messageData.data.payload.body.data) {
        body = Buffer.from(messageData.data.payload.body.data, 'base64').toString('utf-8');
      }

      // GPT를 사용하여 키워드 추출
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "다음 메일에서 중요한 키워드와 주제를 추출해주세요. 각 키워드의 중요도를 0-100 사이의 점수로 평가해주세요."
          },
          {
            role: "user",
            content: `제목: ${subject}\n보낸 사람: ${from}\n내용: ${body}`
          }
        ],
        temperature: 0.3,
        maxTokens: 150
      });

      const keywords = JSON.parse(completion.choices[0].message.content);

      return {
        subject,
        from,
        date,
        keywords
      };
    }));

    res.json(mails);
  } catch (error) {
    console.error("메일 목록 가져오기 실패:", error);
    res.status(500).json({ error: error.message });
  }
});

// 키워드 추출 함수
async function extractKeywords(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{
          role: "system",
          content: "다음 텍스트에서 가장 중요한 5개의 키워드를 추출하고, 각 키워드의 중요도를 0-100 사이의 점수로 평가해주세요. 응답은 JSON 형식으로 해주세요: {\"keywords\": [{\"text\": \"키워드1\", \"score\": 90}, ...]}"
        }, {
          role: "user",
          content: text
        }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      // 토큰 한도 초과 에러 체크
      if (error.error?.code === 'insufficient_quota' || error.error?.message?.includes('quota')) {
        console.log('GPT API 토큰 한도 초과, 기본 텍스트 분석 사용');
        return extractKeywordsBasic(text);
      }
      throw new Error(error.error?.message || 'GPT API 호출 실패');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const result = JSON.parse(content);
    return result.keywords;
  } catch (error) {
    console.error('GPT API 호출 실패:', error);
    console.log('기본 텍스트 분석으로 전환');
    return extractKeywordsBasic(text);
  }
}

// 기본 텍스트 분석을 통한 키워드 추출 함수
function extractKeywordsBasic(text) {
  // 불용어 목록
  const stopWords = ['이', '그', '저', '것', '수', '등', '및', '또는', '그리고', '하지만', '그래서', '때문에', '위해', '대해', '관련', '의', '가', '을', '를', '에', '로', '으로', '와', '과', '은', '는', '이런', '저런', '그런', '이러한', '저러한', '그러한', '이런', '저런', '그런', '이것', '저것', '그것', '이런', '저런', '그런', '이러한', '저러한', '그러한', '이런', '저런', '그런', '이것', '저것', '그것'];
  
  // 텍스트 전처리
  text = text.toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 단어 분리 및 빈도수 계산
  const words = text.split(' ');
  const wordFreq = {};
  
  words.forEach(word => {
    if (word.length > 1 && !stopWords.includes(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  // 빈도수에 따른 점수 계산 (0-100)
  const maxFreq = Math.max(...Object.values(wordFreq));
  const keywords = Object.entries(wordFreq)
    .map(([text, freq]) => ({
      text,
      score: Math.round((freq / maxFreq) * 100)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // 상위 5개 키워드만 반환

  return keywords;
}

export default router; 