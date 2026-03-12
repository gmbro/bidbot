/**
 * 제안서 초안 생성 API Route (고도화 버전)
 * 
 * POST /api/generate-draft
 * Body: { title, organization, demandOrg, bidMethod, contractMethod, estimatedPrice, bidEndDt, rfpContext?, templateType? }
 * 
 * Gemini AI를 사용하여 입찰공고 기반 제안서 초안을 생성합니다.
 * - rfpContext: 사용자가 붙여넣은 RFP/요구사항/평가기준 텍스트
 * - templateType: 제안서 양식 유형 (technical | business | simple)
 */

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

function isValidApiKey(key: string): boolean {
    if (!key || key.length < 10) return false;
    if (key.includes('여기에') || key.includes('입력') || key.includes('your')) return false;
    return true;
}

// 사용 가능한 모델 자동 감지
async function findAvailableModel(): Promise<string> {
    try {
        const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
        );
        if (!res.ok) {
            console.error('[generate-draft] Failed to list models:', res.status);
            return 'gemini-2.0-flash';
        }
        const data = await res.json();
        const models = data.models || [];

        const preferred = [
            'gemini-2.5-pro',
            'gemini-2.5-flash',
            'gemini-2.0-pro',
            'gemini-2.0-flash',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            'gemini-pro',
        ];

        const available = models
            .filter((m: { supportedGenerationMethods?: string[] }) =>
                m.supportedGenerationMethods?.includes('generateContent')
            )
            .map((m: { name: string }) => m.name.replace('models/', ''));

        console.log('[generate-draft] Available models:', available.join(', '));

        for (const pref of preferred) {
            const match = available.find((name: string) => name.startsWith(pref));
            if (match) return match;
        }

        return available[0] || 'gemini-2.0-flash';
    } catch (e) {
        console.error('[generate-draft] Error listing models:', e);
        return 'gemini-2.0-flash';
    }
}

// Gemini API 호출 (재시도 포함)
async function callGemini(prompt: string): Promise<string> {
    const modelName = await findAvailableModel();
    console.log(`[generate-draft] Using model: ${modelName}`);

    const maxRetries = 3;
    let lastError = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 8192,
                    },
                }),
            });

            if (res.ok) {
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                    console.log(`[generate-draft] Success on attempt ${attempt}`);
                    return text;
                }
                lastError = 'AI가 텍스트를 생성하지 못했습니다.';
            } else if (res.status === 429) {
                console.log(`[generate-draft] Rate limited (attempt ${attempt}/${maxRetries}), waiting...`);
                lastError = '할당량 초과로 재시도 중입니다.';
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                continue;
            } else {
                const errorData = await res.json().catch(() => ({}));
                lastError = errorData.error?.message || `API 에러 ${res.status}`;
                console.error(`[generate-draft] API error (attempt ${attempt}):`, lastError);
            }
        } catch (e) {
            lastError = e instanceof Error ? e.message : String(e);
            console.error(`[generate-draft] Fetch error (attempt ${attempt}):`, lastError);
        }
    }

    throw new Error(`Gemini API 호출 실패 (${modelName}): ${lastError}`);
}

// ─── 양식별 프롬프트 생성 ───

type TemplateType = 'technical' | 'business' | 'simple';

function buildPrompt(params: {
    title: string;
    organization: string;
    demandOrg: string;
    bidMethod: string;
    contractMethod: string;
    estimatedPrice: string;
    bidEndDt: string;
    rfpContext: string;
    templateType: TemplateType;
}): string {
    const { title, organization, demandOrg, bidMethod, contractMethod, estimatedPrice, bidEndDt, rfpContext, templateType } = params;

    const bidInfo = `
## 공고 정보
- **공고명**: ${title}
- **공고기관**: ${organization || '미상'}
- **수요기관**: ${demandOrg || '미상'}
- **입찰방법**: ${bidMethod || '미상'}
- **계약방법**: ${contractMethod || '미상'}
- **추정가격**: ${estimatedPrice || '미정'}
- **입찰마감**: ${bidEndDt || '미정'}`;

    const rfpSection = rfpContext
        ? `
## 제안요청서(RFP) / 과업내용 / 평가기준
아래는 사용자가 제공한 공고 세부 정보입니다. 이 내용을 **최우선으로 반영**하여 초안을 작성하세요.

\`\`\`
${rfpContext}
\`\`\`

⚠️ 위 내용에 평가항목이나 배점 기준이 있다면, 각 평가항목에 맞춰 해당 섹션의 내용을 구성하세요.
⚠️ 과업 내용이나 요구사항이 있다면, 수행 방안에 구체적으로 반영하세요.
`
        : `
## 참고
제안요청서(RFP) 원문은 제공되지 않았습니다. 공고명에서 사업의 핵심 내용을 추론하여 작성하세요.
`;

    const templateSections = getTemplateSections(templateType);

    return `당신은 대한민국 공공조달 입찰 제안서 작성 전문가입니다.
수십 건의 정부 입찰에 참여한 경험을 가진 제안서 컨설턴트로서,
아래 입찰공고 정보를 바탕으로 **${getTemplateLabel(templateType)}** 초안을 작성해주세요.

${bidInfo}
${rfpSection}

## 작성 요청사항
다음 섹션별로 제안서 초안을 작성해주세요. 각 섹션은 마크다운 형식으로 작성합니다.

${templateSections}

## 작성 원칙
1. 공고명과 제안요청서 내용에서 사업의 핵심을 정확히 파악하여 **맞춤형으로 작성**
2. 일반적이고 추상적인 내용이 아닌 **구체적이고 실행 가능한 내용** 작성
3. 전문적이고 신뢰감 있는 톤 유지
4. 마크다운 형식 사용 (헤딩, 볼드, 리스트, 표 적극 활용)
5. 각 섹션 제목은 ## 헤딩으로 작성
6. ${rfpContext ? '제공된 RFP/평가기준에 맞춰 내용의 비중을 조절하세요' : '공고명에서 핵심 키워드를 추출하여 사업 범위를 추정하세요'}`;
}

function getTemplateLabel(type: TemplateType): string {
    switch (type) {
        case 'technical': return '기술제안서';
        case 'business': return '사업계획서';
        case 'simple': return '간이제안서';
        default: return '기술제안서';
    }
}

function getTemplateSections(type: TemplateType): string {
    switch (type) {
        case 'technical':
            return `
### 📋 기술제안서 양식 (총 6개 섹션)

1. **사업 이해 및 분석** (300~400자)
   - 사업 배경 및 필요성
   - 발주기관의 핵심 니즈 분석
   - 현황 진단 및 문제점 도출

2. **기술 접근 방법론** (400~600자)
   - 적용 기술 스택 및 아키텍처
   - 핵심 기술 요소 설명
   - 기술적 차별화 포인트
   - 품질 확보 방안

3. **수행 방안** (500~700자)
   - 단계별 수행 계획 (WBS 기반)
   - 각 단계별 주요 산출물
   - 요구사항 추적 및 검증 방안
   - 위험 관리 방안

4. **추진 일정** (표 형식)
   - 주요 단계별 상세 일정표 (마크다운 표)
   - 마일스톤 및 주요 체크포인트

5. **투입 인력 및 조직** (300~400자)
   - 프로젝트 조직 구성(PM, PL, 개발자, QA 등)
   - 핵심 인력 자격 요건
   - 인력 투입 계획

6. **기대 효과 및 유지보수** (300~400자)
   - 정량적 기대 효과 (수치화)
   - 정성적 기대 효과
   - 유지보수 및 기술 지원 계획
   - 향후 확장 방안`;

        case 'business':
            return `
### 📊 사업계획서 양식 (총 6개 섹션)

1. **사업 개요** (300~400자)
   - 사업 배경 및 목적
   - 사업 범위 및 기간
   - 기대 성과

2. **시장 분석 및 사업 타당성** (400~500자)
   - 관련 시장 동향
   - 벤치마킹 사례
   - 사업 타당성 근거

3. **추진 전략** (400~600자)
   - 핵심 추진 전략
   - 차별화 전략
   - 이해관계자 관리 방안

4. **세부 실행 계획** (500~700자)
   - 단계별 실행 방안
   - 주요 활동 및 산출물
   - 성과 관리 방안 (KPI)

5. **예산 및 일정 계획** (표 형식)
   - 항목별 예산 배분 (마크다운 표)
   - 추진 일정표

6. **기대 효과 및 성과 지표** (300~400자)
   - 정량적 성과 목표
   - 정성적 기대 효과
   - ROI 분석
   - 사후 관리 계획`;

        case 'simple':
            return `
### 📝 간이제안서 양식 (총 4개 섹션)

1. **사업 이해** (200~300자)
   - 사업 목적 및 배경 요약
   - 발주기관 니즈 파악

2. **수행 방안** (300~500자)
   - 핵심 수행 내용
   - 주요 방법론
   - 차별화 포인트

3. **추진 일정 및 인력** (표 형식 + 200자)
   - 간단 일정표 (마크다운 표)
   - 투입 인력 구성

4. **기대 효과** (200~300자)
   - 주요 기대 효과
   - 성과 관리 방안`;

        default:
            return getTemplateSections('technical');
    }
}

export async function POST(request: NextRequest) {
    if (!isValidApiKey(GEMINI_API_KEY)) {
        const hint = GEMINI_API_KEY ? `현재 값: "${GEMINI_API_KEY.slice(0, 6)}..."` : '값이 비어있음';
        return NextResponse.json(
            { success: false, error: `Gemini API 키가 올바르지 않습니다 (${hint}). .env.local을 확인하고 서버를 재시작해주세요.` },
            { status: 400 }
        );
    }

    try {
        const body = await request.json();
        const {
            title,
            organization,
            demandOrg,
            bidMethod,
            contractMethod,
            estimatedPrice,
            bidEndDt,
            rfpContext = '',
            templateType = 'technical',
        } = body;

        if (!title) {
            return NextResponse.json({ success: false, error: '공고명이 필요합니다.' }, { status: 400 });
        }

        const validTypes: TemplateType[] = ['technical', 'business', 'simple'];
        const safeTemplateType = validTypes.includes(templateType) ? templateType : 'technical';

        const prompt = buildPrompt({
            title,
            organization: organization || '미상',
            demandOrg: demandOrg || '미상',
            bidMethod: bidMethod || '미상',
            contractMethod: contractMethod || '미상',
            estimatedPrice: estimatedPrice || '미정',
            bidEndDt: bidEndDt || '미정',
            rfpContext: rfpContext.trim().slice(0, 10000), // 최대 10000자
            templateType: safeTemplateType,
        });

        const draft = await callGemini(prompt);

        return NextResponse.json({
            success: true,
            draft,
            metadata: {
                title,
                templateType: safeTemplateType,
                hasRfpContext: !!rfpContext.trim(),
                generatedAt: new Date().toISOString(),
            },
        });

    } catch (error) {
        console.error('[API /api/generate-draft] Error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';

        let userMessage = `초안 생성에 실패했습니다: ${msg}`;
        if (msg.includes('429') || msg.includes('quota') || msg.includes('할당량')) {
            userMessage = '⏳ Gemini API 무료 할당량이 아직 활성화되지 않았습니다. 새 API 키는 활성화에 최대 5분이 소요될 수 있습니다. 잠시 후 다시 시도해주세요.';
        }

        return NextResponse.json(
            { success: false, error: userMessage },
            { status: 500 }
        );
    }
}
