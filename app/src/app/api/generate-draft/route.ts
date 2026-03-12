/**
 * 제안서 초안 생성 API Route (v3 — 통합 초안)
 * 
 * POST /api/generate-draft
 * Body: { title, organization, demandOrg, bidMethod, contractMethod,
 *         estimatedPrice, bidEndDt, rfpContext?, additionalNotes? }
 * 
 * 양식 선택 없이 기술 + 사업 통합 제안서를 자동 생성합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyProfileText } from '@/lib/company-profile';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

function isValidApiKey(key: string): boolean {
    if (!key || key.length < 10) return false;
    if (key.includes('여기에') || key.includes('입력') || key.includes('your')) return false;
    return true;
}

async function findAvailableModel(): Promise<string> {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
        );
        if (!res.ok) return 'gemini-2.0-flash';
        const data = await res.json();
        const models = data.models || [];
        const preferred = [
            'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-pro',
            'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash',
        ];
        const available = models
            .filter((m: { supportedGenerationMethods?: string[] }) =>
                m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: { name: string }) => m.name.replace('models/', ''));
        for (const pref of preferred) {
            const match = available.find((name: string) => name.startsWith(pref));
            if (match) return match;
        }
        return available[0] || 'gemini-2.0-flash';
    } catch {
        return 'gemini-2.0-flash';
    }
}

async function callGemini(prompt: string): Promise<string> {
    const modelName = await findAvailableModel();
    console.log(`[generate-draft] Using model: ${modelName}`);
    const maxRetries = 3;
    let lastError = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
                    }),
                }
            );
            if (res.ok) {
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) return text;
                lastError = 'AI가 텍스트를 생성하지 못했습니다.';
            } else if (res.status === 429) {
                lastError = '할당량 초과';
                await new Promise(r => setTimeout(r, 2000 * attempt));
                continue;
            } else {
                const err = await res.json().catch(() => ({}));
                lastError = err.error?.message || `API 에러 ${res.status}`;
            }
        } catch (e) {
            lastError = e instanceof Error ? e.message : String(e);
        }
    }
    throw new Error(`Gemini API 호출 실패: ${lastError}`);
}

// ─── 통합 프롬프트 ───

function buildPrompt(params: {
    title: string;
    organization: string;
    demandOrg: string;
    bidMethod: string;
    contractMethod: string;
    estimatedPrice: string;
    bidEndDt: string;
    rfpContext: string;
    additionalNotes: string;
}): string {
    const { title, organization, demandOrg, bidMethod, contractMethod,
        estimatedPrice, bidEndDt, rfpContext, additionalNotes } = params;

    const companyProfile = getCompanyProfileText();

    const rfpSection = rfpContext
        ? `
## 제안요청서(RFP) / 과업내용 / 평가기준
아래는 공고의 세부 정보입니다. 이 내용을 **최우선으로 반영**하여 초안을 작성하세요.

\`\`\`
${rfpContext}
\`\`\`

⚠️ 평가항목이나 배점이 있다면 각 항목에 맞춰 내용을 구성하세요.
⚠️ 과업 내용이나 요구사항을 수행 방안에 구체적으로 반영하세요.
`
        : `
## 참고
제안요청서(RFP) 원문이 제공되지 않았습니다. 공고명에서 핵심 내용을 추론하여 작성하세요.
`;

    const additionalSection = additionalNotes
        ? `
## 추가 요청사항
사용자가 아래와 같은 추가 지시를 했습니다. 반드시 반영하세요:
\`\`\`
${additionalNotes}
\`\`\`
`
        : '';

    return `당신은 대한민국 공공조달 입찰 제안서 작성 전문가입니다.
수십 건의 정부 입찰에 참여한 경험을 가진 제안서 컨설턴트로서,
아래 입찰공고 정보와 **제안 회사의 제품·역량 정보**를 바탕으로
**기술 역량 + 사업 수행 계획을 통합한 제안서** 초안을 작성해주세요.

## 공고 정보
- **공고명**: ${title}
- **공고기관**: ${organization || '미상'}
- **수요기관**: ${demandOrg || '미상'}
- **입찰방법**: ${bidMethod || '미상'}
- **계약방법**: ${contractMethod || '미상'}
- **추정가격**: ${estimatedPrice || '미정'}
- **입찰마감**: ${bidEndDt || '미정'}

${rfpSection}
${companyProfile}
${additionalSection}

## 작성할 섹션 (기술 + 사업 통합 제안서)

다음 섹션 구조에 맞춰 작성해주세요:

### Part 1. 사업 이해 및 분석 (400~500자)
- 사업 배경 및 필요성
- 발주기관 핵심 니즈 분석
- 현황 진단 및 문제점 도출
- 사업 목표 정의

### Part 2. 기술 접근 방법론 (500~700자)
- 적용 기술 스택 및 아키텍처 (GenOS 플랫폼 기반)
- 핵심 기술 요소 상세 설명
- 기술적 차별화 포인트
- 품질 확보 방안

### Part 3. 수행 방안 (600~800자)
- 단계별 수행 계획 (WBS 기반)
- 각 단계별 주요 산출물
- 요구사항 추적 및 검증 방안
- 위험 관리 방안

### Part 4. 추진 일정 (표 형식)
- 주요 단계별 상세 일정표 (마크다운 표)
- 마일스톤 및 주요 체크포인트

### Part 5. 투입 인력 및 조직 (400~500자)
- 프로젝트 조직 구성 (PM, PL, 개발자, 인프라, QA 등)
- 핵심 인력 자격 요건
- 제논의 관련 경험 및 역량

### Part 6. 사업 타당성 및 기대 효과 (400~500자)
- 기술적 기대 효과 (성능, 효율성)
- 비즈니스 기대 효과 (비용 절감, ROI)
- 정량적 성과 목표 (수치화)
- 유사 레퍼런스 성과 근거

### Part 7. 유지보수 및 확장 계획 (300~400자)
- 운영 안정화 및 기술 지원 계획
- 교육 및 기술 이전 방안
- 향후 확장 및 고도화 로드맵

## 작성 원칙
1. 공고명과 RFP에서 사업 핵심을 정확히 파악하여 **맞춤형으로 작성**
2. **구체적이고 실행 가능한 내용** 작성 (추상적 표현 금지)
3. **제논의 GenOS 플랫폼 역량과 레퍼런스**를 자연스럽게 제안서 전반에 반영
4. 전문적이고 신뢰감 있는 톤 유지
5. 마크다운 형식 (## 헤딩, 볼드, 리스트, 표 적극 활용)
6. 투입 인력은 제논의 실제 역량 기반으로 구성
7. 기대효과는 GenOS 레퍼런스를 근거로 구체적 수치 제시
8. ${rfpContext ? '제공된 RFP/평가기준에 맞춰 내용의 비중을 조절' : '공고명에서 핵심 키워드를 추출하여 사업 범위를 추정'}`;
}

export async function POST(request: NextRequest) {
    if (!isValidApiKey(GEMINI_API_KEY)) {
        return NextResponse.json(
            { success: false, error: 'Gemini API 키가 올바르지 않습니다. .env.local을 확인하세요.' },
            { status: 400 }
        );
    }

    try {
        const body = await request.json();
        const {
            title, organization, demandOrg, bidMethod, contractMethod,
            estimatedPrice, bidEndDt,
            rfpContext = '',
            additionalNotes = '',
        } = body;

        if (!title) {
            return NextResponse.json({ success: false, error: '공고명이 필요합니다.' }, { status: 400 });
        }

        const prompt = buildPrompt({
            title,
            organization: organization || '미상',
            demandOrg: demandOrg || '미상',
            bidMethod: bidMethod || '미상',
            contractMethod: contractMethod || '미상',
            estimatedPrice: estimatedPrice || '미정',
            bidEndDt: bidEndDt || '미정',
            rfpContext: rfpContext.trim().slice(0, 10000),
            additionalNotes: additionalNotes.trim().slice(0, 3000),
        });

        const draft = await callGemini(prompt);

        return NextResponse.json({
            success: true,
            draft,
            metadata: {
                title,
                hasRfpContext: !!rfpContext.trim(),
                hasAdditionalNotes: !!additionalNotes.trim(),
                generatedAt: new Date().toISOString(),
            },
        });

    } catch (error) {
        console.error('[API /api/generate-draft] Error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        let userMessage = `초안 생성에 실패했습니다: ${msg}`;
        if (msg.includes('429') || msg.includes('할당량')) {
            userMessage = '⏳ Gemini API 할당량 초과. 잠시 후 다시 시도해주세요.';
        }
        return NextResponse.json({ success: false, error: userMessage }, { status: 500 });
    }
}
