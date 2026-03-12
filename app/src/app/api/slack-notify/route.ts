/**
 * 슬랙 알림 API Route
 * 
 * POST /api/slack-notify
 * 
 * 스크린샷 예시 형식으로 알림을 보냅니다:
 * 
 * [메인 메시지]
 *   2026-03-04 신규 AI 관련 공고 5건 (용역 3, 물품 1, 공사 1)
 * 
 * [쓰레드 답글 1]
 *   1. 인공지능(AI) 기반 행정업무 자동화 시스템 구축 사업
 *      공고번호: 20260304001-00
 *      주관기관: 행정안전부
 *      수요기관: 행정안전부 디지털정부실
 *      접수기간: 2026-03-04 ~ 2026-03-18
 *      ...
 * 
 * [쓰레드 답글 2] ...
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllBids, formatDateForApi, formatDisplayDate, formatPrice, getBidDetailUrl, isPriorityBid, matchPriorityKeywords } from '@/lib/bid-api';
import { getSlackMode, postSlackMessage, postSlackWebhook } from '@/lib/slack';
import type { BidItem } from '@/types/bid';

const CATEGORY_LABELS: Record<string, string> = {
    service: '용역',
    construction: '공사',
    thing: '물품',
    etc: '기타',
};

/**
 * 메인 요약 메시지 생성
 * 예: "2026-03-04 신규 AI 관련 공고 5건 (용역 3, 물품 1, 공사 1)"
 */
function buildMainMessage(items: BidItem[], dateStr: string) {
    const priorityItems = items.filter(i => i.isPriority);
    const totalCount = items.length;
    const priorityCount = priorityItems.length;

    // 카테고리별 카운트
    const catCounts: Record<string, number> = {};
    items.forEach(item => {
        const label = CATEGORY_LABELS[item.category] || item.category;
        catCounts[label] = (catCounts[label] || 0) + 1;
    });
    const catSummary = Object.entries(catCounts)
        .map(([label, count]) => `${label} ${count}`)
        .join(', ');

    if (totalCount === 0) {
        return {
            text: `📭 ${dateStr} 등록된 AI 관련 입찰공고가 없습니다. 공고가 없는 날은 메시지가 안 올립니다.`,
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `📭 *${dateStr}* 등록된 AI 관련 입찰공고가 없습니다.\n공고가 없는 날은 메시지가 안 올립니다.`,
                    },
                },
            ],
        };
    }

    const headerEmoji = priorityCount > 0 ? '🚨' : '📋';
    const headerText = `${dateStr} 신규 공고 ${totalCount}건 (${catSummary})`;

    const blocks: any[] = [
        {
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: `${headerEmoji} *${headerText}*`,
            },
        },
    ];

    // 우선순위 공고가 있으면 강조
    if (priorityCount > 0) {
        const keywordSet = new Set<string>();
        priorityItems.forEach(i => i.matchedKeywords.forEach(k => keywordSet.add(k)));
        const keywordsStr = Array.from(keywordSet).map(k => `\`${k}\``).join(' ');

        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: `🔴 우선 키워드 매칭 *${priorityCount}건* (${keywordsStr}) — 아래 쓰레드에서 확인하세요`,
                },
            ],
        });
    } else {
        blocks.push({
            type: 'context',
            elements: [
                {
                    type: 'mrkdwn',
                    text: '아래 쓰레드에서 개별 공고를 확인하세요',
                },
            ],
        });
    }

    return { text: headerText, blocks };
}

/**
 * 개별 공고 쓰레드 메시지 생성
 * 스크린샷의 상세 형식을 따름
 */
function buildThreadMessage(item: BidItem, index: number) {
    const detailUrl = item.detailUrl || getBidDetailUrl(item.bidNtceNo, item.bidNtceOrd);
    const categoryLabel = CATEGORY_LABELS[item.category] || item.category;
    const priorityMarker = item.isPriority ? '🔴 ' : '';
    const keywordTags = item.matchedKeywords.length > 0
        ? `  [${item.matchedKeywords.join(', ')}]`
        : '';

    // 접수기간 포맷
    const period = item.bidStartDt && item.bidEndDt
        ? `${formatDisplayDate(item.bidStartDt)} ~ ${formatDisplayDate(item.bidEndDt)}`
        : '-';

    const lines = [
        `${priorityMarker}*${index}. ${item.title}*${keywordTags}`,
        '',
        `>📌 *공고번호:* ${item.bidNtceNo}-${item.bidNtceOrd}`,
        `>🏛️ *주관기관:* ${item.organization || '-'}`,
        `>🏢 *수요기관:* ${item.demandOrg || '-'}`,
        `>📅 *접수기간:* ${period}`,
        `>📋 *입찰방법:* ${item.bidMethod || '-'}`,
        `>📝 *계약방법:* ${item.contractMethod || '-'}`,
        `>📂 *구분:* ${categoryLabel}`,
    ];

    if (item.estimatedPrice) {
        lines.push(`>💰 *추정가격:* ${formatPrice(item.estimatedPrice)}`);
    }

    return {
        text: `${index}. ${item.title}`,
        blocks: [
            {
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: lines.join('\n'),
                },
            },
            {
                type: 'actions',
                elements: [
                    {
                        type: 'button',
                        text: { type: 'plain_text', text: '📄 공고 바로가기', emoji: true },
                        url: detailUrl,
                        action_id: `view_detail_${item.bidNtceNo}`,
                    },
                    {
                        type: 'button',
                        text: { type: 'plain_text', text: '✍️ 신청서 초안 작성', emoji: true },
                        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/generate-proposal?bidNo=${item.bidNtceNo}&bidOrd=${item.bidNtceOrd}`,
                        action_id: `draft_proposal_${item.bidNtceNo}`,
                    },
                ],
            },
        ],
    };
}

/**
 * Webhook용 단일 메시지 (쓰레드 미지원 시 폴백)
 */
function buildWebhookFallback(items: BidItem[], dateStr: string) {
    const catCounts: Record<string, number> = {};
    items.forEach(item => {
        const label = CATEGORY_LABELS[item.category] || item.category;
        catCounts[label] = (catCounts[label] || 0) + 1;
    });
    const catSummary = Object.entries(catCounts)
        .map(([l, c]) => `${l} ${c}`)
        .join(', ');

    const headerText = `📋 ${dateStr} 신규 공고 ${items.length}건 (${catSummary})`;

    const blocks: any[] = [
        {
            type: 'section',
            text: { type: 'mrkdwn', text: `*${headerText}*` },
        },
        { type: 'divider' },
    ];

    items.forEach((item, idx) => {
        const detailUrl = item.detailUrl || getBidDetailUrl(item.bidNtceNo, item.bidNtceOrd);
        const priorityMarker = item.isPriority ? '🔴 ' : '';
        const period = item.bidStartDt && item.bidEndDt
            ? `${formatDisplayDate(item.bidStartDt)} ~ ${formatDisplayDate(item.bidEndDt)}`
            : '-';

        blocks.push({
            type: 'section',
            text: {
                type: 'mrkdwn',
                text: [
                    `${priorityMarker}*${idx + 1}. <${detailUrl}|${item.title}>*`,
                    `📌 ${item.organization} → ${item.demandOrg}`,
                    `📅 접수기간: ${period}`,
                    item.estimatedPrice ? `💰 추정가격: ${formatPrice(item.estimatedPrice)}` : '',
                ].filter(Boolean).join('\n'),
            },
        });
    });

    blocks.push(
        { type: 'divider' },
        {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: '🔗 <https://www.g2b.go.kr|나라장터 바로가기> | data.go.kr API 기반 자동 알림' }],
        },
    );

    return { text: headerText, blocks };
}

export async function POST(request: NextRequest) {
    try {
        const mode = getSlackMode();

        if (mode === 'none') {
            return NextResponse.json(
                {
                    success: false,
                    error: '슬랙 설정이 되어있지 않습니다. .env.local에 SLACK_BOT_TOKEN+SLACK_CHANNEL_ID 또는 SLACK_WEBHOOK_URL을 설정하세요.',
                    guide: {
                        botMode: 'SLACK_BOT_TOKEN + SLACK_CHANNEL_ID (쓰레드 지원, 권장)',
                        webhookMode: 'SLACK_WEBHOOK_URL (간단, 쓰레드 미지원)',
                    },
                },
                { status: 400 },
            );
        }

        // 어제 날짜
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const startDate = formatDateForApi(yesterday, false);
        const endDate = formatDateForApi(yesterday, true);
        const dateStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

        console.log(`[Slack Notify] ${dateStr} 공고 조회 중... (mode: ${mode})`);

        // 전체 공고 조회 → AI 관련만 필터
        const { items: allItems } = await fetchAllBids(startDate, endDate, 1, 999);
        const aiItems = allItems.filter(i => i.isAiRelated);
        const priorityItems = aiItems.filter(i => i.isPriority);

        console.log(`[Slack Notify] 전체 ${allItems.length}건, AI 관련 ${aiItems.length}건, 우선순위 ${priorityItems.length}건`);

        // 공고가 없으면 알림 안 보냄 (스크린샷처럼)
        if (aiItems.length === 0) {
            return NextResponse.json({
                success: true,
                message: `${dateStr} AI 관련 공고가 없어 알림을 보내지 않았습니다.`,
                itemCount: 0,
            });
        }

        // 우선순위 공고를 앞쪽으로 정렬
        const sortedItems = [
            ...aiItems.filter(i => i.isPriority),
            ...aiItems.filter(i => !i.isPriority),
        ];

        if (mode === 'bot') {
            // ─── Bot Token 모드: 메인 메시지 + 쓰레드 답글 ───
            const mainMsg = buildMainMessage(sortedItems, dateStr);
            const mainTs = await postSlackMessage(mainMsg.text, mainMsg.blocks);

            if (!mainTs) {
                throw new Error('메인 메시지 전송 후 thread_ts를 받지 못했습니다.');
            }

            // 각 공고를 쓰레드 답글로 전송
            let sentCount = 0;
            for (let i = 0; i < sortedItems.length; i++) {
                const threadMsg = buildThreadMessage(sortedItems[i], i + 1);
                await postSlackMessage(threadMsg.text, threadMsg.blocks, mainTs);
                sentCount++;

                // Rate limit 방지 (Slack API: 1msg/sec 권장)
                if (i < sortedItems.length - 1) {
                    await new Promise(r => setTimeout(r, 1200));
                }
            }

            return NextResponse.json({
                success: true,
                mode: 'bot',
                message: `${dateStr} AI 관련 공고 ${sentCount}건을 슬랙 쓰레드로 전송했습니다.`,
                itemCount: sentCount,
                priorityCount: priorityItems.length,
                items: sortedItems.map(i => ({
                    title: i.title,
                    org: i.organization,
                    isPriority: i.isPriority,
                    matchedKeywords: i.matchedKeywords,
                })),
            });

        } else {
            // ─── Webhook 모드: 단일 메시지 ───
            const msg = buildWebhookFallback(sortedItems, dateStr);
            await postSlackWebhook(msg.text, msg.blocks);

            return NextResponse.json({
                success: true,
                mode: 'webhook',
                message: `${dateStr} AI 관련 공고 ${sortedItems.length}건을 슬랙에 전송했습니다.`,
                itemCount: sortedItems.length,
                priorityCount: priorityItems.length,
            });
        }

    } catch (error) {
        console.error('[Slack Notify Error]', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 },
        );
    }
}
