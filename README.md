# Crispy Octo Robot 🐙

AI 기반 이메일 관리 및 대화 시스템

## 주요 기능

- Gmail 연동을 통한 이메일 관리
- AI와의 자연스러운 대화
- 실시간 이메일 알림
- 모던한 UI/UX 디자인
- 보안 기능 (Helmet, Rate Limiting)
- 메모리 최적화

## 설치 방법

1. 저장소 클론
```bash
git clone https://github.com/whitehat-hacker123/crispy-octo-robot.git
cd crispy-octo-robot
```

2. 의존성 설치
```bash
npm install
```

3. 환경 변수 설정
`.env` 파일을 생성하고 다음 변수들을 설정하세요:
```
OPENAI_API_KEY=your_openai_api_key
CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
REDIRECT_URI=your_redirect_uri
```

4. 서버 실행
```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## 사용 방법

1. 브라우저에서 `http://localhost:3000` 접속
2. Gmail 계정 인증
3. AI와 대화하거나 이메일 관리 시작

## 보안 기능

- Helmet을 통한 보안 헤더 설정
- Rate Limiting을 통한 요청 제한
- 환경 변수 검증
- 에러 처리 및 로깅

## 기술 스택

- Node.js
- Express
- OpenAI API
- Google Gmail API
- HTML/CSS/JavaScript
- Helmet (보안)
- Express Rate Limit (요청 제한)

## 라이선스

MIT License

## ㅅㅂ

- 더이상 안합니다
- Lua 스크립트 공부해야해서 
