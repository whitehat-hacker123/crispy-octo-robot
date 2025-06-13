import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import threeDHomeRouter from "./3d-home.js";

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// VIP 발신자 목록 (예시)
const VIP_SENDERS = [
    'ceo@company.com',
    'cto@company.com',
    'manager@company.com'
];

// 중요 키워드 목록 (예시)
const IMPORTANT_KEYWORDS = [
    '긴급', '요청', '중요', '즉시', 'ASAP',
    'urgent', 'important', 'request', 'immediate'
];

// 메일 우선순위 페이지
router.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>메일 우선순위</title>
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
                    max-width: 1200px;
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
                    padding: 20px;
                    margin: 10px 0;
                    border-radius: 8px;
                    transition: all 0.3s ease;
                }
                .mail-item:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                }
                .priority-score {
                    font-size: 1.2em;
                    font-weight: bold;
                    color: #26d0ce;
                }
                .score-details {
                    margin-top: 10px;
                    padding: 10px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }
                .score-item {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
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
                .filter-controls {
                    margin-bottom: 20px;
                    padding: 15px;
                    background: rgba(42, 42, 42, 0.8);
                    border-radius: 8px;
                }
                .filter-controls select {
                    padding: 8px;
                    margin-right: 10px;
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1 style="text-align: center;">🔢 메일 우선순위</h1>
                
                <div class="filter-controls">
                    <select id="timeFilter">
                        <option value="7">최근 7일</option>
                        <option value="30">최근 30일</option>
                        <option value="90">최근 90일</option>
                    </select>
                    <select id="sortOrder">
                        <option value="desc">높은 순</option>
                        <option value="asc">낮은 순</option>
                    </select>
                </div>

                <div class="mail-list">
                    <h2>우선순위 메일</h2>
                    <div id="mailList">
                        <div class="loading">메일을 불러오는 중...</div>
                    </div>
                </div>
            </div>

            <script>
                async function loadMails() {
                    try {
                        const timeFilter = document.getElementById('timeFilter').value;
                        const sortOrder = document.getElementById('sortOrder').value;
                        
                        const response = await fetch(\`/mail-priority/mails?days=\${timeFilter}&sort=\${sortOrder}\`);
                        const mails = await response.json();
                        
                        const mailList = document.getElementById('mailList');
                        mailList.innerHTML = '';
                        
                        mails.forEach(mail => {
                            const mailItem = document.createElement('div');
                            mailItem.className = 'mail-item';
                            
                            mailItem.innerHTML = \`
                                <div class="priority-score">우선순위 점수: \${Math.round(mail.priorityScore)}</div>
                                <h3>\${mail.subject}</h3>
                                <p>보낸 사람: \${mail.from}</p>
                                <p>날짜: \${mail.date}</p>
                                <div class="score-details">
                                    <div class="score-item">
                                        <span>키워드 중요도:</span>
                                        <span>\${Math.round(mail.scores.keywordScore * 100)}%</span>
                                    </div>
                                    <div class="score-item">
                                        <span>발신자 중요도:</span>
                                        <span>\${Math.round(mail.scores.senderScore * 100)}%</span>
                                    </div>
                                    <div class="score-item">
                                        <span>제목 중요도:</span>
                                        <span>\${Math.round(mail.scores.subjectScore * 100)}%</span>
                                    </div>
                                    <div class="score-item">
                                        <span>시간 중요도:</span>
                                        <span>\${Math.round(mail.scores.timeScore * 100)}%</span>
                                    </div>
                                </div>
                                <p><strong>AI 분석:</strong> \${mail.analysis}</p>
                            \`;

                            mailList.appendChild(mailItem);
                        });
                    } catch (error) {
                        console.error('Error:', error);
                        document.getElementById('mailList').innerHTML = 
                            '<div class="error">메일을 불러오는 중 오류가 발생했습니다.</div>';
                    }
                }

                // 필터 변경 시 메일 목록 새로고침
                document.getElementById('timeFilter').addEventListener('change', loadMails);
                document.getElementById('sortOrder').addEventListener('change', loadMails);

                // 페이지 로드 시 메일 목록 불러오기
                window.onload = loadMails;
            </script>
        </body>
        </html>
    `);
});

// 메일 우선순위 계산 함수
function calculatePriorityScore(mail) {
    let scores = {
        keywordScore: 0,
        senderScore: 0,
        subjectScore: 0,
        timeScore: 0
    };

    // 1. 키워드 중요도 (40%)
    const keywordMatches = IMPORTANT_KEYWORDS.filter(keyword => 
        mail.subject.toLowerCase().includes(keyword.toLowerCase()) ||
        mail.body.toLowerCase().includes(keyword.toLowerCase())
    );
    scores.keywordScore = Math.min(keywordMatches.length / 5, 1) * 0.4;

    // 2. 발신자 중요도 (30%)
    scores.senderScore = VIP_SENDERS.includes(mail.from.toLowerCase()) ? 0.3 : 0;

    // 3. 제목 중요도 (20%)
    if (mail.subject.toLowerCase().includes('긴급') || 
        mail.subject.toLowerCase().includes('요청')) {
        scores.subjectScore = 0.2;
    }

    // 4. 시간 중요도 (10%)
    const mailDate = new Date(mail.date);
    const now = new Date();
    const diffDays = Math.floor((now - mailDate) / (1000 * 60 * 60 * 24));
    scores.timeScore = diffDays === 0 ? 0.1 : 0;

    // 총점 계산
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    
    return {
        priorityScore: totalScore * 100,
        scores
    };
}

// 메일 목록과 우선순위 가져오기
router.get('/mails', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;
        const sortOrder = req.query.sort || 'desc';
        
        const gmail = google.gmail({ version: "v1", auth: req.app.locals.oauth2Client });
        
        // 최근 메일 가져오기
        const result = await gmail.users.messages.list({
            userId: "me",
            maxResults: 50,
            q: `in:all after:${days}d`
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

            // GPT를 사용하여 메일 중요도 분석
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "다음 메일의 중요도를 분석해주세요. 업무적 중요도, 긴급성, 처리 우선순위를 고려하여 0-1 사이의 점수로 평가해주세요."
                    },
                    {
                        role: "user",
                        content: `제목: ${subject}\n보낸 사람: ${from}\n내용: ${body}`
                    }
                ],
                temperature: 0.3,
            });

            const analysis = JSON.parse(completion.choices[0].message.content);
            
            // 우선순위 점수 계산
            const priorityResult = calculatePriorityScore({
                subject,
                from,
                date,
                body
            });

            return {
                subject,
                from,
                date,
                priorityScore: priorityResult.priorityScore,
                scores: priorityResult.scores,
                analysis: analysis.explanation || "분석 결과 없음"
            };
        }));

        // 우선순위 점수로 정렬
        mails.sort((a, b) => {
            return sortOrder === 'desc' 
                ? b.priorityScore - a.priorityScore 
                : a.priorityScore - b.priorityScore;
        });

        res.json(mails);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: '메일을 불러오는 중 오류가 발생했습니다.' });
    }
});

export default router;

const app = express();
app.use("/", threeDHomeRouter); 