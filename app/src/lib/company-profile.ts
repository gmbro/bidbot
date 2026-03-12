/**
 * 회사 프로필 설정
 * 
 * 초안 생성 시 AI 프롬프트에 자동으로 포함되는 회사 정보입니다.
 * 이 정보를 수정하면 생성되는 제안서에 즉시 반영됩니다.
 */

export const COMPANY_PROFILE = {
    companyName: '제논(Genon)',
    productName: 'GenOS',
    productDescription: `GenOS는 제논이 자체 개발한 기업용 생성형 AI 플랫폼입니다.

## 핵심 역량
- **노코드 서비스 빌더**: 비개발자도 GUI 기반으로 업무 목적에 맞춘 AI 에이전트를 빠르게 개발·배포 가능
- **LLMOps**: 멀티모달·LLM·임베딩·STT/TTS·VLM 등 다양한 모델 학습·서빙·평가·관리 통합 환경
- **AI Search (RAG)**: 자사 문서 인텔리전스(Document Intelligence) 기술 기반, 시맨틱 청킹·정밀 표 인식·메타데이터 추출로 정확도 향상
- **에이전트 플랫폼**: 태스크플로우/워크플로우 기반 AI 에이전트 설계·실행·관리
- **가드레일**: 개인정보 보호, 콘텐츠 필터링, AI 안전성 내장
- **IAM 보안**: 사용자 인증, 권한 관리, 접근 제어, 로그 모니터링

## GenOS 주요 애플리케이션
1. **GenMate** — 초안 작성, 문서 요약, 번역, 외부 검색 통합 AI 에이전트. 폐쇄망에서도 GPT-4 수준 성능, 4주 내 구축
2. **데이터 분석 에이전트** — 자연어 쿼리로 SQL 자동 생성, 시각화, 보고서 생성
3. **딥 리서치 에이전트** — MCP 기반 외부 DB/API 연동, 작업 계획 기반 체계적 리서치
4. **보고서 생성 에이전트** — 과거 문서 참고하여 목차·본문 자동 생성, 수정 가능
5. **코드 어시스턴트** — 실시간 인라인 코드 생성, 자동 완성, 리팩토링
6. **Actionable AI Agent** — Computer Use 기술 기반, 실제 시스템 조작 및 업무 자동화 (ERP, 그룹웨어 등)

## 제품 라인업
- **GenOS PRO**: 풀 커스터마이징, 인하우스 내재화
- **GenOS BASIC**: 기본 AI Agent 5종, 내장 프롬프트 템플릿
- **GenOS APP**: 서비스 빌더, 사전 구축 RAG 기반 검색

## GenCloud (자체 PaaS)
- On-Premise / Private Cloud / Public Cloud 모두 지원
- 상용 클라우드 대비 50% 비용 절감
- 멀티클라우드 아키텍처 (AWS, Azure, GCP 연계)

## 검증된 레퍼런스
- **금융**: 한국은행(금융 특화 LLM), 국민은행(AI Banker), 우리은행(RM 에이전트), 신한카드(LLM 기반 검색), 금융보안원(빅데이터 플랫폼), 롯데카드(검색 시스템), 하나금융(업무 AI), 현대해상(보험 특화 AI), 롯데손보(코드 어시스턴트)
- **공공**: KEIT(연구비 정산 고도화), 한국은행
- **에너지**: 한국동서발전(업무 AI 서비스 코미봇)
- **제조**: 국내 디스플레이 제조사(수율 분석 에이전트)

## 기술 차별화
- 할루시네이션 방지를 위한 문서 인텔리전스 기술
- MCP 기반 외부 시스템 연동
- 프록시 서버 및 AI 가드레일 보안 체계
- 역할 기반 권한 관리, 로깅, 보안 감사 추적`,

    contactInfo: {
        phone: '+82-2-2088-6035',
        email: 'hello@genon.ai',
        address: '서울시 강남구 남부순환로 2621 플래그원 13층',
        website: 'https://www.genon.ai',
    },
};

/**
 * 회사 프로필을 프롬프트용 텍스트로 변환
 */
export function getCompanyProfileText(): string {
    const { companyName, productName, productDescription, contactInfo } = COMPANY_PROFILE;
    return `
## 제안 회사 정보: ${companyName}
### 핵심 제품: ${productName}

${productDescription}

### 연락처
- 전화: ${contactInfo.phone}
- 이메일: ${contactInfo.email}
- 주소: ${contactInfo.address}
- 웹사이트: ${contactInfo.website}
`;
}
