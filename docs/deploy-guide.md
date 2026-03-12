# Vercel 배포 가이드

## 사전 준비
- GitHub 저장소에 코드가 push 되어 있어야 합니다
- [Vercel 계정](https://vercel.com) 필요 (GitHub 계정으로 무료 가입)

---

## 1단계: Git Push

```bash
cd /Users/gyoungmin.lee/Desktop/지원사업\ 프로젝트
git add .
git commit -m "feat: 조회시작일 선택, 최신순 정렬, AI 초안 작성 기능 추가"
git push origin main
```

## 2단계: Vercel 프로젝트 연결

1. [vercel.com](https://vercel.com) 접속 → **Add New Project**
2. GitHub 저장소 선택
3. **Root Directory**를 `app`으로 설정 (프로젝트가 `app/` 하위에 있으므로)
4. Framework Preset: **Next.js** (자동 감지됨)

## 3단계: 환경변수 설정

Vercel 대시보드 → **Settings** → **Environment Variables**에 아래 값들을 추가:

| 변수명 | 값 | 설명 |
| :--- | :--- | :--- |
| `DATA_GO_KR_API_KEY_ENCODED` | `.env.local`의 값 복사 | 나라장터 API 인코딩 키 |
| `DATA_GO_KR_API_KEY` | `.env.local`의 값 복사 | 나라장터 API 디코딩 키 |
| `DATA_GO_KR_BASE_URL` | `https://apis.data.go.kr/1230000/ao/PubDataOpnStdService` | API Base URL |
| `SLACK_BOT_TOKEN` | `.env.local`의 값 복사 | 슬랙 봇 토큰 |
| `SLACK_CHANNEL_ID` | `.env.local`의 값 복사 | 슬랙 채널/유저 ID |
| `SLACK_WEBHOOK_URL` | `.env.local`의 값 복사 | 슬랙 웹훅 URL |
| `GEMINI_API_KEY` | `.env.local`의 값 복사 | Gemini AI API 키 |

> [!CAUTION]
> `.env.local`은 절대 Git에 push하지 마세요! `.gitignore`에 포함되어 있는지 확인하세요.

## 4단계: 배포

1. 환경변수 설정 후 **Deploy** 클릭
2. 빌드 완료 후 `https://프로젝트명.vercel.app` 주소로 접속 가능

## 5단계: 이후 업데이트

```bash
git add .
git commit -m "변경 내용 설명"
git push origin main
# → Vercel이 자동으로 재배포합니다
```

---

## CLI로 배포하기 (선택)

```bash
# Vercel CLI 설치
npm i -g vercel

# 배포 (app 디렉토리에서)
cd app
vercel

# 프로덕션 배포
vercel --prod
```

> [!TIP]
> CLI 첫 실행 시 프로젝트 연결 및 Root Directory 설정을 안내받게 됩니다.
