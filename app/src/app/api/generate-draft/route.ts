/**
 * 제안서 초안 생성 API Route
 * 
 * POST /api/generate-draft
 * Body: { title, organization, demandOrg, bidMethod, contractMethod, estimatedPrice, bidEndDt }
 * 
 * Gemini AI를 사용하여 입찰공고 기반 제안서 초안을 생성합니다.
 * 사용 가능한 모델을 자동으로 감지하고, 429 에러 시 재시도합니다.
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
            return 'gemini-2.0-flash'; // 기본값
        }
        const data = await res.json();
        const models = data.models || [];

        // generateContent를 지원하는 모델 중 최고 성능 순으로 정렬
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

        // 선호 모델이 없으면 첫 번째 사용 가능한 모델
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
                        maxOutputTokens: 4096,
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
                // 할당량 초과 — 잠시 후 재시도
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
        const { title, organization, demandOrg, bidMethod, contractMethod, estimatedPrice, bidEndDt } = body;

        if (!title) {
            return NextResponse.json({ success: false, error: '공고명이 필요합니다.' }, { status: 400 });
        }

        const prompt = `당신은 대한민국 공공조달 입찰 제안서 작성 전문가입니다.
아래 입찰공고 정보를 바탕으로 제안서 초안을 작성해주세요.

## 공고 정보
- **공고명**: ${title}
- **공고기관**: ${organization || '미상'}
- **수요기관**: ${demandOrg || '미상'}
- **입찰방법**: ${bidMethod || '미상'}
- **계약방법**: ${contractMethod || '미상'}
- **추정가격**: ${estimatedPrice || '미정'}
- **입찰마감**: ${bidEndDt || '미정'}

## 작성 요청사항
다음 섹션별로 제안서 초안을 작성해주세요. 각 섹션은 마크다운 형식으로 작성합니다.

1. **사업 이해** (200-300자)
   - 본 사업의 배경과 목적을 분석
   - 발주기관의 니즈 파악

2. **추진 전략** (300-400자)
   - 사업 수행의 핵심 전략
   - 차별화 포인트

3. **수행 방안** (400-500자)
   - 단계별 수행 계획
   - 주요 수행 내용 및 방법론

4. **추진 일정** (표 형식)
   - 주요 단계별 일정 (표)

5. **기대 효과** (200-300자)
   - 정량적/정성적 기대 효과

6. **수행 조직** (200자)
   - 투입 인력 구성 제안

⚠️ 주의사항:
- 공고명에서 사업의 핵심 내용을 파악하여 구체적으로 작성
- 일반적인 내용이 아닌, 해당 공고에 맞춤화된 내용 작성
- 전문적이고 신뢰감 있는 톤 유지
- 마크다운 형식 사용`;

        const draft = await callGemini(prompt);

        return NextResponse.json({
            success: true,
            draft,
            metadata: { title, generatedAt: new Date().toISOString() },
        });

    } catch (error) {
        console.error('[API /api/generate-draft] Error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';

        // 사용자 친화적 에러 메시지
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
