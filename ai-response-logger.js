import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const router = express.Router();

// 로그 저장 디렉토리 설정
const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai_responses.json');

class ResponseLogger {
    constructor() {
        this.initializeLogs();
    }

    async initializeLogs() {
        try {
            await fs.mkdir(LOG_DIR, { recursive: true });
            try {
                await fs.access(LOG_FILE);
            } catch {
                await fs.writeFile(LOG_FILE, JSON.stringify([]));
            }
        } catch (error) {
            console.error('로그 초기화 중 오류:', error);
        }
    }

    async saveLog(logData) {
        try {
            const logs = JSON.parse(await fs.readFile(LOG_FILE, 'utf-8'));
            logs.unshift({
                ...logData,
                timestamp: new Date().toISOString()
            });
            await fs.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
            return true;
        } catch (error) {
            console.error('로그 저장 중 오류:', error);
            return false;
        }
    }

    async getLogs() {
        try {
            return JSON.parse(await fs.readFile(LOG_FILE, 'utf-8'));
        } catch (error) {
            console.error('로그 조회 중 오류:', error);
            return [];
        }
    }

    async searchLogs(query) {
        const logs = await this.getLogs();
        const searchTerm = query.toLowerCase();
        return logs.filter(log => 
            log.subject.toLowerCase().includes(searchTerm) ||
            log.from.toLowerCase().includes(searchTerm) ||
            log.originalContent.toLowerCase().includes(searchTerm) ||
            log.aiResponse.toLowerCase().includes(searchTerm)
        );
    }
}

const logger = new ResponseLogger();

// 로그 뷰어 페이지
router.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>AI 응답 내역 로그</title>
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
                .log-entry {
                    background: rgba(42, 42, 42, 0.8);
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    transition: all 0.3s ease;
                }
                .log-entry:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                }
                .log-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .log-time {
                    color: #26d0ce;
                    font-size: 0.9em;
                }
                .log-content {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }
                .log-section {
                    background: rgba(26, 26, 26, 0.8);
                    padding: 15px;
                    border-radius: 4px;
                }
                .log-section h3 {
                    color: #26d0ce;
                    margin-top: 0;
                }
                .filter-bar {
                    background: rgba(42, 42, 42, 0.8);
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    display: flex;
                    gap: 10px;
                }
                input[type="text"] {
                    background: rgba(26, 26, 26, 0.8);
                    border: 1px solid #444;
                    color: #fff;
                    padding: 8px 12px;
                    border-radius: 4px;
                    flex: 1;
                }
                button {
                    background: linear-gradient(90deg, #1a2980 0%, #26d0ce 100%);
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 15px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                button:hover {
                    background: linear-gradient(90deg, #26d0ce 0%, #1a2980 100%);
                }
                .no-logs {
                    text-align: center;
                    padding: 40px;
                    color: #666;
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
                <h1 style="text-align: center;">🧠 AI 응답 내역 로그</h1>
                
                <div class="filter-bar">
                    <input type="text" id="searchInput" placeholder="검색어를 입력하세요...">
                    <button onclick="searchLogs()">검색</button>
                </div>

                <div id="logContainer">
                    <div class="loading">로그를 불러오는 중...</div>
                </div>
            </div>

            <script>
                async function loadLogs() {
                    try {
                        const response = await fetch('/ai-response-logger/logs');
                        const logs = await response.json();
                        displayLogs(logs);
                    } catch (error) {
                        console.error('Error:', error);
                        document.getElementById('logContainer').innerHTML = 
                            '<div class="error">로그를 불러오는 중 오류가 발생했습니다.</div>';
                    }
                }

                async function searchLogs() {
                    const searchTerm = document.getElementById('searchInput').value;
                    try {
                        const response = await fetch('/ai-response-logger/search?q=' + encodeURIComponent(searchTerm));
                        const logs = await response.json();
                        displayLogs(logs);
                    } catch (error) {
                        console.error('Error:', error);
                        document.getElementById('logContainer').innerHTML = 
                            '<div class="error">검색 중 오류가 발생했습니다.</div>';
                    }
                }

                function displayLogs(logs) {
                    const container = document.getElementById('logContainer');
                    if (logs.length === 0) {
                        container.innerHTML = '<div class="no-logs">검색 결과가 없습니다.</div>';
                        return;
                    }

                    container.innerHTML = logs.map(log => \`
                        <div class="log-entry">
                            <div class="log-header">
                                <h3>\${log.subject}</h3>
                                <span class="log-time">\${new Date(log.timestamp).toLocaleString()}</span>
                            </div>
                            <div class="log-content">
                                <div class="log-section">
                                    <h3>📧 원본 메일</h3>
                                    <p><strong>보낸 사람:</strong> \${log.from}</p>
                                    <p><strong>제목:</strong> \${log.subject}</p>
                                    <p><strong>내용:</strong> \${log.originalContent}</p>
                                </div>
                                <div class="log-section">
                                    <h3>🤖 AI 응답</h3>
                                    <p><strong>응답 방식:</strong> \${log.responseType}</p>
                                    <p><strong>응답 내용:</strong> \${log.aiResponse}</p>
                                    <p><strong>키워드:</strong> \${log.keywords.join(', ')}</p>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                }

                // 페이지 로드 시 로그 불러오기
                window.onload = loadLogs;
            </script>
        </body>
        </html>
    `);
});

// 로그 조회 API
router.get('/logs', async (req, res) => {
    try {
        const logs = await logger.getLogs();
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: '로그를 불러오는 중 오류가 발생했습니다.' });
    }
});

// 로그 검색 API
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || '';
        const logs = await logger.searchLogs(query);
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: '검색 중 오류가 발생했습니다.' });
    }
});

// 로그 저장 API
router.post('/logs', express.json(), async (req, res) => {
    try {
        const success = await logger.saveLog(req.body);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(500).json({ error: '로그 저장 중 오류가 발생했습니다.' });
        }
    } catch (error) {
        res.status(500).json({ error: '로그 저장 중 오류가 발생했습니다.' });
    }
});

export default router; 