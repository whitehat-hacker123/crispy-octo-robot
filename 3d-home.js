import express from 'express';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import path from 'path';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

router.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>3D 메일 에이전트</title>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
            <style>
                body {
                    margin: 0;
                    overflow: hidden;
                    background: #000;
                }
                #canvas {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }
                .menu {
                    position: fixed;
                    top: 20px;
                    left: 20px;
                    z-index: 100;
                    background: rgba(0, 0, 0, 0.8);
                    padding: 20px;
                    border-radius: 10px;
                    color: white;
                }
                .menu a {
                    display: block;
                    color: #26d0ce;
                    text-decoration: none;
                    margin: 10px 0;
                    padding: 10px;
                    border-radius: 5px;
                    transition: all 0.3s ease;
                }
                .menu a:hover {
                    background: rgba(38, 208, 206, 0.2);
                    transform: translateX(10px);
                }
                .stats {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 100;
                    background: rgba(0, 0, 0, 0.8);
                    padding: 20px;
                    border-radius: 10px;
                    color: white;
                }
                .loading {
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    color: #26d0ce;
                    font-size: 24px;
                    z-index: 1000;
                }
            </style>
        </head>
        <body>
            <div id="canvas"></div>
            <div class="menu">
                <h2>메일 에이전트</h2>
                <a href="/auto-reply">🤖 자동 응답</a>
                <a href="/keyword-extractor">🔑 키워드 추출</a>
                <a href="/ai-response-logger">📝 AI 응답 로그</a>
                <a href="/intent-detector">🔍 의도 분석</a>
                <a href="/mail-priority">🔢 우선순위</a>
            </div>
            <div class="stats">
                <h3>실시간 통계</h3>
                <div id="stats"></div>
            </div>
            <div class="loading">로딩 중...</div>

            <script>
                // 씬 설정
                const scene = new THREE.Scene();
                const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
                const renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setSize(window.innerWidth, window.innerHeight);
                document.getElementById('canvas').appendChild(renderer.domElement);

                // 조명 설정
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
                scene.add(ambientLight);

                const pointLight = new THREE.PointLight(0x26d0ce, 1);
                pointLight.position.set(10, 10, 10);
                scene.add(pointLight);

                // 메일 큐브 생성
                const mailCubes = [];
                const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
                const cubeMaterial = new THREE.MeshPhongMaterial({
                    color: 0x26d0ce,
                    transparent: true,
                    opacity: 0.8,
                    shininess: 100
                });

                // 메일 큐브 생성 함수
                function createMailCube(x, y) {
                    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
                    cube.position.set(x, y, z);
                    cube.userData = {
                        originalY: y,
                        speed: Math.random() * 0.02 + 0.01
                    };
                    scene.add(cube);
                    mailCubes.push(cube);
                }

                // 메일 큐브 배치
                for (let i = 0; i < 20; i++) {
                    const x = (Math.random() - 0.5) * 20;
                    const y = (Math.random() - 0.5) * 20;
                    const z = (Math.random() - 0.5) * 20;
                    createMailCube(x, y, z);
                }

                // 카메라 위치 설정
                camera.position.z = 15;

                // 마우스 컨트롤
                let isDragging = false;
                let previousMousePosition = {
                    x: 0,
                    y: 0
                };

                document.addEventListener('mousedown', (e) => {
                    isDragging = true;
                });

                document.addEventListener('mousemove', (e) => {
                    if (isDragging) {
                        const deltaMove = {
                            x: e.offsetX - previousMousePosition.x,
                            y: e.offsetY - previousMousePosition.y
                        };

                        mailCubes.forEach(cube => {
                            cube.rotation.y += deltaMove.x * 0.01;
                            cube.rotation.x += deltaMove.y * 0.01;
                        });
                    }

                    previousMousePosition = {
                        x: e.offsetX,
                        y: e.offsetY
                    };
                });

                document.addEventListener('mouseup', (e) => {
                    isDragging = false;
                });

                // 애니메이션
                function animate() {
                    requestAnimationFrame(animate);

                    // 메일 큐브 애니메이션
                    mailCubes.forEach(cube => {
                        // 부드러운 상하 움직임
                        cube.position.y = cube.userData.originalY + 
                            Math.sin(Date.now() * cube.userData.speed) * 0.5;
                    });

                    renderer.render(scene, camera);
                }

                // 창 크기 조절 대응
                window.addEventListener('resize', () => {
                    camera.aspect = window.innerWidth / window.innerHeight;
                    camera.updateProjectionMatrix();
                    renderer.setSize(window.innerWidth, window.innerHeight);
                });

                // 로딩 화면 제거
                setTimeout(() => {
                    document.querySelector('.loading').style.display = 'none';
                }, 2000);

                // 통계 업데이트
                async function updateStats() {
                    try {
                        const response = await fetch('/stats');
                        const stats = await response.json();
                        document.getElementById('stats').innerHTML = \`
                            <p>📧 총 메일: \${stats.totalMails}</p>
                            <p>🤖 자동 응답: \${stats.autoReplies}</p>
                            <p>🔑 키워드: \${stats.keywords}</p>
                            <p>⏰ 대기 중: \${stats.pending}</p>
                        \`;
                    } catch (error) {
                        console.error('Error:', error);
                    }
                }

                // 5초마다 통계 업데이트
                setInterval(updateStats, 5000);
                updateStats();

                animate();
            </script>
        </body>
        </html>
    `);
});

// 통계 API 엔드포인트
router.get('/stats', async (req, res) => {
    try {
        const gmail = google.gmail({ version: "v1", auth: req.app.locals.oauth2Client });
        
        // 총 메일 수
        const totalMails = await gmail.users.messages.list({
            userId: "me",
            maxResults: 1
        });

        // 자동 응답 수
        const autoReplies = await gmail.users.messages.list({
            userId: "me",
            maxResults: 1,
            q: "subject:Re:"
        });

        // 대기 중인 메일
        const pending = await gmail.users.messages.list({
            userId: "me",
            maxResults: 1,
            q: "is:unread"
        });

        res.json({
            totalMails: totalMails.data.resultSizeEstimate || 0,
            autoReplies: autoReplies.data.resultSizeEstimate || 0,
            keywords: Math.floor(Math.random() * 100), // 임시 데이터
            pending: pending.data.resultSizeEstimate || 0
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: '통계를 불러오는 중 오류가 발생했습니다.' });
    }
});

export default router; 