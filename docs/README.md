# 나라장터 AI 공고 모니터

## 프로젝트 개요

나라장터(g2b.go.kr)의 입찰공고 중 **AI 관련 지원사업**을 자동으로 모니터링하고, 슬랙(Slack)으로 알림을 보내주는 시스템입니다.

### 핵심 기능

1. **실시간 공고 조회**: data.go.kr 공식 API를 통해 입찰공고 데이터를 조회합니다.
2. **AI 관련 필터링**: 공고 제목에서 AI 관련 키워드를 감지하여 자동 분류합니다.
3. **🔴 우선순위 자동 알림**: 특정 키워드(생성형, AI, 자동화, 에이전트 등)가 포함된 공고를 자동 알림합니다.
4. **대시보드 UI**: 공고를 시각적으로 확인할 수 있는 웹 대시보드를 제공합니다.
5. **슬랙 쓰레드 알림**: 요약 메시지 + 개별 공고를 쓰레드 답글로 전송합니다.

### 향후 계획
- 🧠 AI 에이전트를 통한 '우리에게 적합한 공고 추천' 기능
- 📝 유저 피드백 기반 추천 고도화
- 📅 지원 확정 시 캘린더 등록
- 📄 지원서 초안 자동 작성 (HWP)

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| Frontend/Backend | **Next.js 16** (App Router, TypeScript) |
| API | **data.go.kr** (조달청 나라장터 입찰공고정보서비스) |
| 배포 | **Vercel** |
| 알림 | **Slack Web API** (Bot Token, 쓰레드 지원) 또는 Webhook |

---

## 프로젝트 구조

```
app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── bids/route.ts          # 입찰공고 조회 API
│   │   │   └── slack-notify/route.ts  # 슬랙 알림 전송 API
│   │   ├── globals.css                # 글로벌 스타일 (다크 테마)
│   │   ├── layout.tsx                 # 루트 레이아웃
│   │   └── page.tsx                   # 메인 대시보드 페이지
│   ├── lib/
│   │   ├── bid-api.ts                 # data.go.kr API 호출 유틸리티
│   │   └── slack.ts                   # Slack API 유틸리티
│   └── types/
│       └── bid.ts                     # TypeScript 타입 정의
├── .env.local                         # 환경 변수 (API 키, 슬랙 설정)
├── package.json
└── ...
```

---

## 설정 방법

### 1. 환경 변수 설정

`app/.env.local` 파일에 설정합니다:

```env
# data.go.kr API 키 (디코딩 키 사용)
DATA_GO_KR_API_KEY=your_decoding_api_key_here

# API Base URL (기본값 설정됨)
DATA_GO_KR_BASE_URL=https://apis.data.go.kr/1230000/ad/BidPublicInfoService

# ── Slack 설정 (둘 중 하나 선택) ──

# 방법 1: Bot Token (쓰레드 지원 — 권장)
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_CHANNEL_ID=C0XXXXXXX

# 방법 2: Incoming Webhook (간단, 쓰레드 미지원)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/xxx/xxx
```

### 2. data.go.kr API 키 발급

1. [data.go.kr](https://www.data.go.kr)에 회원가입
2. '조달청_나라장터 입찰공고정보서비스' 검색
3. 활용신청 → **디코딩 키**를 `.env.local`에 설정
4. ⚠️ 신청 후 **1~2시간** 후에 API 키가 활성화됩니다

### 3. 슬랙 설정

#### 방법 1: Bot Token (권장 — 쓰레드 지원)

1. [Slack API](https://api.slack.com/apps) → **Create New App** → From Scratch
2. **OAuth & Permissions** → Bot Token Scopes에 추가:
   - `chat:write` — 메시지 전송
   - `chat:write.public` — 공개 채널에 초대 없이 전송
3. **Install to Workspace** → **Bot User OAuth Token** 복사
4. `.env.local`에 설정:
   - `SLACK_BOT_TOKEN=xoxb-복사한-토큰`
   - `SLACK_CHANNEL_ID=채널ID` (채널 우클릭 → 채널 세부 정보 → 하단에서 확인)

#### 방법 2: Webhook (간단)

1. [Slack API](https://api.slack.com/apps) → Create New App
2. **Incoming Webhooks** 활성화 → Add New Webhook to Workspace
3. `.env.local`에 `SLACK_WEBHOOK_URL=복사한-URL` 설정

### 4. 로컬 실행

```bash
cd app
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속

---

## 슬랙 알림 구조

### Bot Token 모드 (쓰레드)

스크린샷의 형태처럼 **메인 메시지 + 쓰레드 답글**로 전송됩니다:

```
[메인 메시지 — 채널에 표시]
🚨 2026-03-04 신규 공고 5건 (용역 3, 물품 1, 공사 1)
🔴 우선 키워드 매칭 3건 (`생성형` `AI` `자동화`) — 아래 쓰레드에서 확인하세요

  [쓰레드 답글 1]
  🔴 1. 인공지능(AI) 기반 행정업무 자동화 시스템 구축 사업  [AI, 자동화]
  >공고번호: 20260304001-00
  >주관기관: 행정안전부
  >수요기관: 행정안전부 디지털정부실
  >접수기간: 2026.03.04 ~ 2026.03.18
  >입찰방법: 제한경쟁
  >계약방법: 협상에의한계약
  >추정가격: 25.0억원
  >출처: 나라장터

  [쓰레드 답글 2] ...
```

### Webhook 모드 (단일 메시지)

하나의 메시지에 모든 공고가 포함됩니다.

---

## 키워드 시스템

### 🔴 우선순위 키워드 (자동 알림 트리거)

이 키워드가 포함된 공고는 자동으로 슬랙 알림이 발생합니다:

> **생성형**, **AI**, **A.I**, **인공지능**, **자동화**, **에이전트**, **Agent**, **LLM**, **GPT**, **ChatGPT**

### 🟡 일반 AI 키워드 (대시보드 필터링)

대시보드에서 'AI 관련' 필터에 사용되는 추가 키워드:

> 머신러닝, 딥러닝, 자연어처리, NLP, 챗봇, 빅데이터, 데이터분석,
> 자율주행, 로봇, 컴퓨터비전, 영상분석, 음성인식, 지능형, 스마트,
> 클라우드, IoT, RPA, 디지털전환, XR, VR, AR, 메타버스, 블록체인 등

---

## API 엔드포인트

### `GET /api/bids`

입찰공고 목록을 조회합니다.

**파라미터:**

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| startDate | string | 오늘 | 조회 시작일 (YYYYMMDD) |
| endDate | string | 오늘 | 조회 종료일 (YYYYMMDD) |
| category | string | all | 구분 (all/service/construction/thing/etc) |
| aiOnly | boolean | false | AI 관련 공고만 필터링 |
| keyword | string | - | 키워드 검색 (공고명, 기관명) |
| page | number | 1 | 페이지 번호 |
| pageSize | number | 20 | 페이지당 항목 수 |

### `POST /api/slack-notify`

어제 등록된 AI 관련 공고를 슬랙에 전송합니다.

**응답 예시:**

```json
{
  "success": true,
  "mode": "bot",
  "message": "2026-03-04 AI 관련 공고 5건을 슬랙 쓰레드로 전송했습니다.",
  "itemCount": 5,
  "priorityCount": 3,
  "items": [
    { "title": "...", "org": "...", "isPriority": true, "matchedKeywords": ["AI", "자동화"] }
  ]
}
```

---

## 데모 모드

API 키가 아직 활성화되지 않은 경우, **데모 데이터**로 UI를 확인할 수 있습니다.
데모 모드에서는 상단에 노란색 배너가 표시됩니다.
