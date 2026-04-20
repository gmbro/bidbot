/**
 * 입찰공고 작성 팁 생성 API Route
 * 
 * POST /api/generate-draft
 * Body: { title, organization, demandOrg, bidMethod, contractMethod,
 *         estimatedPrice, bidEndDt }
 * 
 * 공고 정보를 읽고, 어떤 식으로 제안서를 작성하면 좋을지 팁을 생성합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCompanyProfileText } from '@/lib/company-profile';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

function isValidApiKey(key: string): boolean {
    if (!key || key.length < 10) return false;
    if (key.includes('여기에') || key.includes('입력') || key.includes('your')) return false;
    return true;
}

export const maxDuration = 30;

async function callGemini(prompt: string): Promise<string> {
    const modelName = 'gemini-2.5-flash';
    const maxRetries = 2;
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
                        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
                    }),
                }
            );
            if (res.ok) {
                const data = await res.json();
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) return text;
                lastError = 'AI가 텍스트를 생성하지 못했습니다.';
            } else if (res.status === 429 || res.status === 503) {
                lastError = '요청량이 많습니다. 잠시 후 재시도합니다.';
                await new Promise(r => setTimeout(r, 2000));
                continue;
            } else {
                const err = await res.json().catch(() => ({}));
                lastError = err.error?.message || `API 에러 ${res.status}`;
            }
        } catch (e) {
            lastError = e instanceof Error ? e.message : String(e);
        }
    }
    throw new Error(`AI 호출 실패: ${lastError}`);
}

function buildTipsPrompt(params: {
    title: string;
    organization: string;
    demandOrg: string;
    bidMethod: string;
    contractMethod: string;
    estimatedPrice: string;
    bidEndDt: string;
}): string {
    const { title, organization, demandOrg, bidMethod, contractMethod, estimatedPrice, bidEndDt } = params;

    return `당신은 대한민국 공공조달 입찰 제안서 컨설턴트입니다.
아래 입찰공고 정보를 분석하여, 이 공고에 제안서를 작성할 때 **핵심 전략과 팁**을 간결하게 안내해주세요.

## 공고 정보
- **공고명**: ${title}
- **공고기관**: ${organization || '미상'}
- **수요기관**: ${demandOrg || '미상'}
- **입찰방법**: ${bidMethod || '미상'}
- **계약방법**: ${contractMethod || '미상'}
- **추정가격**: ${estimatedPrice || '미정'}
- **입찰마감**: ${bidEndDt || '미정'}

## 작성 가이드

아래 항목들을 **마크다운 형식으로 간결하게** 작성해주세요:

### 📌 공고 핵심 분석
- 이 공고의 핵심 사업 내용이 무엇인지 2~3줄로 요약
- 발주기관이 원하는 핵심 니즈 추정

### 🎯 제안서 작성 전략
- 어떤 포인트를 강조해야 하는지 (3~5가지 핵심 포인트)
- 차별화할 수 있는 요소
- 피해야 할 흔한 실수

### 📝 추천 목차 구성
- 이 공고에 적합한 제안서 목차 구성안 (7~10개 항목)
- 각 항목별 핵심 작성 가이드 1줄씩

### ⚠️ 주의사항
- 입찰방법(${bidMethod || '미상'})에 따른 유의점
- 계약방법(${contractMethod || '미상'})에 따른 유의점
- 일정 관련 주의사항

### 💡 유사 공고 키워드
- 나라장터에서 비슷한 공고를 찾기 위한 검색 키워드 5개

## 작성 원칙
1. 실용적이고 바로 활용 가능한 팁 위주
2. 600~800자 내외로 간결하게
3. 마크다운 형식 (## 헤딩, 볼드, 리스트 활용)
4. 전문적이되 쉬운 표현 사용`;
}

export async function POST(request: NextRequest) {
    if (!isValidApiKey(GEMINI_API_KEY)) {
        return NextResponse.json(
            { success: false, error: 'Gemini API 키가 설정되지 않았습니다.' },
            { status: 400 }
        );
    }

    try {
        let title: string, organization: string, demandOrg: string,
            bidMethod: string, contractMethod: string, estimatedPrice: string, bidEndDt: string;

        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            title = (formData.get('title') as string) || '';
            organization = (formData.get('organization') as string) || '';
            demandOrg = (formData.get('demandOrg') as string) || '';
            bidMethod = (formData.get('bidMethod') as string) || '';
            contractMethod = (formData.get('contractMethod') as string) || '';
            estimatedPrice = (formData.get('estimatedPrice') as string) || '';
            bidEndDt = (formData.get('bidEndDt') as string) || '';
        } else {
            const body = await request.json();
            title = body.title || '';
            organization = body.organization || '';
            demandOrg = body.demandOrg || '';
            bidMethod = body.bidMethod || '';
            contractMethod = body.contractMethod || '';
            estimatedPrice = body.estimatedPrice || '';
            bidEndDt = body.bidEndDt || '';
        }

        if (!title) {
            return NextResponse.json({ success: false, error: '공고명이 필요합니다.' }, { status: 400 });
        }

        const prompt = buildTipsPrompt({
            title,
            organization: organization || '미상',
            demandOrg: demandOrg || '미상',
            bidMethod: bidMethod || '미상',
            contractMethod: contractMethod || '미상',
            estimatedPrice: estimatedPrice || '미정',
            bidEndDt: bidEndDt || '미정',
        });

        const draft = await callGemini(prompt);

        return NextResponse.json({
            success: true,
            draft,
            metadata: {
                title,
                generatedAt: new Date().toISOString(),
            },
        });

    } catch (error) {
        console.error('[API /api/generate-draft] Error:', error);
        const msg = error instanceof Error ? error.message : 'Unknown error';
        let userMessage = `작성 팁 생성에 실패했습니다: ${msg}`;
        if (msg.includes('429') || msg.includes('할당량')) {
            userMessage = '⏳ Gemini API 할당량 초과. 잠시 후 다시 시도해주세요.';
        }
        return NextResponse.json({ success: false, error: userMessage }, { status: 500 });
    }
}
