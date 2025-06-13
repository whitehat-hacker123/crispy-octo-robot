import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// 의도 분석 페이지
router.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>메일 의도 분석</title>
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
                .intent-badge {
                    display: inline-block;
                    padding: 5px 10px;
                    border-radius: 15px;
                    font-size: 0.9em;
                    margin: 5px;
                }
                .intent-business {
                    background: linear-gradient(90deg, #1a2980 0%, #26d0ce 100%);
                }
                .intent-spam {
                    background: linear-gradient(90deg, #ff416c 0%, #ff4b2b 100%);
                }
                .intent-ad {
                    background: linear-gradient(90deg, #f7971e 0%, #ffd200 100%);
                }
                .intent-other {
                    background: linear-gradient(90deg, #7f7fd5 0%, #86a8e7 100%);
                }
                .confidence-bar {
                    width: 100%;
                    height: 6px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                    margin-top: 5px;
                }
                .confidence-level {
                    height: 100%;
                    border-radius: 3px;
                    background: linear-gradient(90deg, #1a2980 0%, #26d0ce 100%);
                    transition: width 0.3s ease;
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
        </head>
        <body>
            <div class="container">
                <h1 style="text-align: center;">🔍 메일 의도 분석</h1>
                
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
                        const response = await fetch('/intent-detector/mails');
                        const mails = await response.json();
                        
                        const mailList = document.getElementById('mailList');
                        mailList.innerHTML = '';
                        
                        mails.forEach(mail => {
                            const mailItem = document.createElement('div');
                            mailItem.className = 'mail-item';
                            
                            let intentBadges = '';
                            mail.intents.forEach(intent => {
                                intentBadges += \`
                                    <div class="intent-badge intent-\${intent.type.toLowerCase()}">
                                        \${intent.type} (\${Math.round(intent.confidence * 100)}%)
                                        <div class="confidence-bar">
                                            <div class="confidence-level" style="width: \${intent.confidence * 100}%"></div>
                                        </div>
                                    </div>
                                \`;
                            });

                            mailItem.innerHTML = \`
                                <h3>\${mail.subject}</h3>
                                <p>보낸 사람: \${mail.from}</p>
                                <p>날짜: \${mail.date}</p>
                                <div>\${intentBadges}</div>
                                <p><strong>분석 결과:</strong> \${mail.analysis}</p>
                            \`;

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
        </body>
        </html>
    `);
});

// 메일 목록과 의도 분석 가져오기
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

            // GPT를 사용하여 의도 분석
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: "다음 메일의 의도를 분석해주세요. 각 의도 유형(업무, 스팸, 광고, 기타)에 대한 신뢰도를 0-1 사이의 값으로 제공해주세요."
                    },
                    {
                        role: "user",
                        content: `제목: ${subject}\n보낸 사람: ${from}\n내용: ${body}`
                    }
                ],
                temperature: 0.3,
            });

            const analysis = JSON.parse(completion.choices[0].message.content);
            
            return {
                subject,
                from,
                date,
                intents: [
                    { type: "업무", confidence: analysis.business || 0 },
                    { type: "스팸", confidence: analysis.spam || 0 },
                    { type: "광고", confidence: analysis.ad || 0 },
                    { type: "기타", confidence: analysis.other || 0 }
                ],
                analysis: analysis.explanation || "분석 결과 없음"
            };
        }));

        res.json(mails);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: '메일을 불러오는 중 오류가 발생했습니다.' });
    }
});

export default router; 