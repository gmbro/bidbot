# 📡 공공사업 통합 모니터링 AI

공공기관의 AI·클라우드·플랫폼 관련 사업 공고를 실시간으로 통합 모니터링하는 시스템입니다.

## 🔗 Live Demo

**[bidbot.vercel.app](https://bidbot.vercel.app)**

## 핵심 기능

- **실시간 통합 수집**: 나라장터(G2B), 기업마당, NIPA, 행안부, 서울AI 등 5개 소스에서 공고 자동 수집
- **AI 키워드 매칭**: 클라우드, AI, 생성형AI, 플랫폼 등 키워드 기반 자동 필터링 및 유사도 점수 정렬
- **공고 중 필터**: 마감된 공고 자동 제외, 현재 모집 중인 공고만 표시
- **중복 제거**: 동일 제목 공고 자동 병합
- **슬랙 알림**: 우선순위 공고 자동 슬랙 전송
- **AI 제안서 작성 팁**: Gemini API 기반 입찰 제안서 작성 가이드 생성

## 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend/Backend** | Next.js 16, TypeScript |
| **Styling** | CSS Variables, 반응형 디자인 |
| **API** | data.go.kr (나라장터), bizinfo.go.kr (기업마당) |
| **크롤러** | NIPA, 행안부, 서울AI (Server-side HTML 파싱) |
| **AI** | Google Gemini API |
| **배포** | Vercel |

## 데이터 소스

| 소스 | 방식 | 설명 |
|------|------|------|
| 🏛️ 나라장터 (G2B) | REST API | 조달청 입찰공고 (오늘~1개월 후) |
| 🏢 기업마당 | REST API | 중소벤처기업부 지원사업 공고 |
| 🖥️ NIPA | 크롤링 | 정보통신산업진흥원 사업/입찰 공고 |
| 🏛️ 행안부 | 크롤링 | 행정안전부 디지털정부 공고 |
| 🗼 서울AI | 크롤링 | 서울AI플랫폼 정책 뉴스/협업 |

## 로컬 실행

```bash
cd app
npm install
cp .env.example .env.local  # API 키 설정
npm run dev
```

## 환경 변수

```
DATA_GO_KR_API_KEY_ENCODED=   # 나라장터 API 인코딩 키
BIZINFO_API_KEY=               # 기업마당 API 키
GEMINI_API_KEY=                # Google Gemini API 키
SLACK_WEBHOOK_URL=             # 슬랙 Webhook URL (선택)
```

## 배포

Vercel에 자동 배포됩니다. GitHub에 push하면 바로 반영됩니다.

```bash
git add -A
git commit -m "feat: 공공사업 통합 모니터링 AI"
git push origin main
```

## 라이선스

MIT
