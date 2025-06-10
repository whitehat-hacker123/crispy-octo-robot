<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <h1>Gmail AI App</h1>
  <p>
    이 앱은 <strong>Google Gmail API</strong>와 <strong>OpenAI GPT-4</strong>를 사용하여
    Gmail 메일 조회, 전송, 그리고 AI와의 대화를 웹 인터페이스에서 할 수 있도록 구현된 Node.js 서버입니다.
  </p>

  <h2>주요 기능</h2>
  <ul>
    <li>Google OAuth2 인증을 통한 Gmail 접근 권한 획득</li>
    <li>최근 Gmail 메일 5개 조회 및 콘솔 출력</li>
    <li>웹 폼을 통해 메일 작성 및 전송</li>
    <li>AI 질문 폼과 OpenAI GPT-4 응답 기능 제공</li>
  </ul>

  <h2>설치 및 실행 방법</h2>
  <ol>
    <li>Node.js(16 이상) 설치</li>
    <li>레포지토리 클론 및 디렉토리 이동</li>
    <pre><code>git clone &lt;repo-url&gt;
cd &lt;repo-folder&gt;</code></pre>
    <li>필요한 패키지 설치</li>
    <pre><code>npm install</code></pre>
    <li><code>.env</code> 파일 생성 및 환경 변수 설정</li>
    <pre><code>CLIENT_ID=your-google-client-id
CLIENT_SECRET=your-google-client-secret
REDIRECT_URI=your-oauth-redirect-uri
OPENAI_API_KEY=your-openai-api-key</code></pre>
    <li>서버 실행</li>
    <pre><code>node index.js</code></pre>
  </ol>

  <h2>사용 방법</h2>
  <ul>
    <li>브라우저에서 <code>http://localhost:3000</code> 접속하면 구글 인증 페이지로 이동</li>
    <li>인증 후, 서버 콘솔에서 최근 메일 리스트 확인 가능</li>
    <li><code>/send</code> 경로에서 메일 전송 폼 사용 가능</li>
    <li><code>/ask-ai</code> 경로에서 AI에게 질문하고 답변 받기 가능</li>
  </ul>

  <h2>주의 사항</h2>
  <ul>
    <li>OAuth 인증 시 <code>REDIRECT_URI</code>는 반드시 Google Cloud Console에 등록된 URL과 일치해야 합니다.</li>
    <li>OpenAI API 사용 시 요금이 발생할 수 있으니 주의하세요.</li>
  </ul>

  <h2>라이선스</h2>
  <p>MIT License</p>

  <h2>문의</h2>
  <p>문제가 있거나 개선 사항이 있으면 연락 주세요.</p>
</body>
</html>
