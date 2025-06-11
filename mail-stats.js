import express from 'express';
import { google } from 'googleapis';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 메일 통계 페이지
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>메일 통계 대시보드</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-top: 20px;
        }
        .stat-card {
          background: rgba(42, 42, 42, 0.8);
          padding: 20px;
          border-radius: 8px;
          backdrop-filter: blur(10px);
          border: 1px solid rgba(38, 208, 206, 0.2);
          box-shadow: 0 0 20px rgba(38, 208, 206, 0.1);
        }
        .stat-card:hover {
          border-color: rgba(38, 208, 206, 0.5);
          box-shadow: 0 0 30px rgba(38, 208, 206, 0.2);
        }
        .stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
        }
        .stat-title {
          font-size: 1.2em;
          color: #26d0ce;
          margin: 0;
        }
        .stat-value {
          font-size: 2em;
          font-weight: bold;
          color: #fff;
          text-shadow: 0 0 10px rgba(38, 208, 206, 0.5);
        }
        .chart-container {
          position: relative;
          height: 300px;
          margin-top: 20px;
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
        .neon-text {
          text-shadow: 0 0 5px #26d0ce,
                       0 0 10px #26d0ce,
                       0 0 20px #26d0ce;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1 class="neon-text" style="text-align: center;">AI 메일 통계 대시보드</h1>
        
        <div class="dashboard-grid">
          <div class="stat-card">
            <div class="stat-header">
              <h2 class="stat-title">총 메일 수</h2>
            </div>
            <div class="stat-value" id="totalEmails">-</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-header">
              <h2 class="stat-title">평균 응답 시간</h2>
            </div>
            <div class="stat-value" id="avgResponseTime">-</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-header">
              <h2 class="stat-title">시간대별 메일 분포</h2>
            </div>
            <div class="chart-container">
              <canvas id="timeDistributionChart"></canvas>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-header">
              <h2 class="stat-title">주제별 분류</h2>
            </div>
            <div class="chart-container">
              <canvas id="topicDistributionChart"></canvas>
            </div>
          </div>
        </div>
      </div>

      <script>
        // 차트 스타일 설정
        Chart.defaults.color = '#fff';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
        
        // 네온 그라데이션 생성 함수
        function createNeonGradient(ctx, chartArea) {
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(38, 208, 206, 0)');
          gradient.addColorStop(0.5, 'rgba(38, 208, 206, 0.5)');
          gradient.addColorStop(1, 'rgba(38, 208, 206, 0)');
          return gradient;
        }

        // 시간대별 분포 차트
        const timeCtx = document.getElementById('timeDistributionChart').getContext('2d');
        const timeChart = new Chart(timeCtx, {
          type: 'line',
          data: {
            labels: [],
            datasets: [{
              label: '메일 수',
              data: [],
              borderColor: '#26d0ce',
              backgroundColor: function(context) {
                const chart = context.chart;
                const {ctx, chartArea} = chart;
                return createNeonGradient(ctx, chartArea);
              },
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#26d0ce',
              pointBorderColor: '#fff',
              pointHoverRadius: 8,
              pointHoverBackgroundColor: '#26d0ce',
              pointHoverBorderColor: '#fff',
              pointHoverBorderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                display: false
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              },
              x: {
                grid: {
                  color: 'rgba(255, 255, 255, 0.1)'
                }
              }
            }
          }
        });

        // 주제별 분류 차트
        const topicCtx = document.getElementById('topicDistributionChart').getContext('2d');
        const topicChart = new Chart(topicCtx, {
          type: 'doughnut',
          data: {
            labels: [],
            datasets: [{
              data: [],
              backgroundColor: [
                'rgba(38, 208, 206, 0.8)',
                'rgba(26, 41, 128, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 206, 86, 0.8)'
              ],
              borderColor: 'rgba(255, 255, 255, 0.1)',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  color: '#fff',
                  font: {
                    size: 12
                  }
                }
              }
            }
          }
        });

        // 통계 데이터 로드
        async function loadStats() {
          try {
            const response = await fetch('/mail-stats/data');
            const stats = await response.json();
            
            // 기본 통계 업데이트
            document.getElementById('totalEmails').textContent = stats.totalEmails;
            document.getElementById('avgResponseTime').textContent = stats.avgResponseTime;
            
            // 시간대별 분포 차트 업데이트
            timeChart.data.labels = stats.timeDistribution.labels;
            timeChart.data.datasets[0].data = stats.timeDistribution.data;
            timeChart.update();
            
            // 주제별 분류 차트 업데이트
            topicChart.data.labels = stats.topicDistribution.labels;
            topicChart.data.datasets[0].data = stats.topicDistribution.data;
            topicChart.update();
          } catch (error) {
            console.error('Error:', error);
            document.querySelector('.container').innerHTML += 
              '<div class="error">통계 데이터를 불러오는 중 오류가 발생했습니다.</div>';
          }
        }

        // 페이지 로드 시 통계 데이터 불러오기
        window.onload = loadStats;
      </script>
    </body>
    </html>
  `);
});

// 통계 데이터 API
router.get('/data', async (req, res) => {
  try {
    const gmail = google.gmail({ version: "v1", auth: req.app.locals.oauth2Client });
    
    // 최근 100개의 메일 가져오기
    const result = await gmail.users.messages.list({
      userId: "me",
      maxResults: 100,
      q: "in:all"
    });

    if (!result.data.messages) {
      return res.json({
        totalEmails: 0,
        avgResponseTime: "0분",
        timeDistribution: { labels: [], data: [] },
        topicDistribution: { labels: [], data: [] }
      });
    }

    const messages = await Promise.all(result.data.messages.map(async (message) => {
      const messageData = await gmail.users.messages.get({
        userId: "me",
        id: message.id,
        format: "full",
      });

      const headers = messageData.data.payload.headers;
      const subject = headers.find((h) => h.name === "Subject")?.value || "";
      const from = headers.find((h) => h.name === "From")?.value || "";
      const date = headers.find((h) => h.name === "Date")?.value || "";
      
      let body = "";
      if (messageData.data.payload.parts) {
        // 멀티파트 메시지 처리
        const textPart = messageData.data.payload.parts.find(part => 
          part.mimeType === "text/plain" || part.mimeType === "text/html"
        );
        if (textPart && textPart.body.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      } else if (messageData.data.payload.body && messageData.data.payload.body.data) {
        // 단일 파트 메시지 처리
        body = Buffer.from(messageData.data.payload.body.data, 'base64').toString('utf-8');
      }

      return {
        subject,
        from,
        date: new Date(date),
        body
      };
    }));

    // 시간대별 분포 계산
    const timeDistribution = Array(24).fill(0);
    messages.forEach(message => {
      const hour = message.date.getHours();
      timeDistribution[hour]++;
    });

    // 주제 분석 함수
    const topicDistribution = await analyzeTopics(messages);

    // 응답 시간 계산 (간단한 예시)
    const avgResponseTime = "15분"; // 실제로는 메일 스레드 분석 필요

    res.json({
      totalEmails: messages.length,
      avgResponseTime,
      timeDistribution: {
        labels: Array.from({length: 24}, (_, i) => i + "시"),
        data: timeDistribution
      },
      topicDistribution: {
        labels: topicDistribution.map(topic => topic.name),
        data: topicDistribution.map(topic => topic.percentage)
      }
    });
  } catch (error) {
    console.error("통계 데이터 생성 실패:", error);
    res.status(500).json({ error: error.message });
  }
});

// 주제 분석 함수
async function analyzeTopics(mails) {
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
          content: "다음 메일 목록을 분석하여 주요 주제와 각 주제의 비율을 계산해주세요. 응답은 JSON 형식으로 해주세요: {\"topics\": [{\"name\": \"주제1\", \"percentage\": 30}, ...]}"
        }, {
          role: "user",
          content: JSON.stringify(mails)
        }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const error = await response.json();
      // 토큰 한도 초과 에러 체크
      if (error.error?.code === 'insufficient_quota' || error.error?.message?.includes('quota')) {
        console.log('GPT API 토큰 한도 초과, 기본 텍스트 분석 사용');
        return analyzeTopicsBasic(mails);
      }
      throw new Error(error.error?.message || 'GPT API 호출 실패');
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const result = JSON.parse(content);
    return result.topics;
  } catch (error) {
    console.error('GPT API 호출 실패:', error);
    console.log('기본 텍스트 분석으로 전환');
    return analyzeTopicsBasic(mails);
  }
}

// 기본 텍스트 분석을 통한 주제 분석 함수
function analyzeTopicsBasic(mails) {
  const topicKeywords = {
    '업무': ['회의', '보고서', '프로젝트', '업무', '일정', '회사', '부서'],
    '개인': ['개인', '사생활', '취미', '여가', '가족'],
    '공지사항': ['공지', '안내', '알림', '공고', '발표'],
    '마케팅': ['홍보', '마케팅', '광고', '캠페인', '판매'],
    '기타': []
  };

  const topicCounts = {};
  Object.keys(topicKeywords).forEach(topic => {
    topicCounts[topic] = 0;
  });

  mails.forEach(mail => {
    const text = (mail.subject + ' ' + mail.body).toLowerCase();
    let matched = false;

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
        topicCounts[topic]++;
        matched = true;
        break;
      }
    }

    if (!matched) {
      topicCounts['기타']++;
    }
  });

  const total = Object.values(topicCounts).reduce((a, b) => a + b, 0);
  const topics = Object.entries(topicCounts)
    .map(([name, count]) => ({
      name,
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return topics;
}

export default router; 