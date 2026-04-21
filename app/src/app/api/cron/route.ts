/**
 * 자동 슬랙 알림 Cron Job
 *
 * Vercel Cron에 의해 주기적으로 호출됩니다.
 * 모든 소스에서 공고를 수집하고, AI/클라우드/생성형AI 키워드에
 * 매칭되는 공고가 있으면 자동으로 슬랙으로 알려줍니다.
 *
 * vercel.json에서 스케줄 설정:
 * { "crons": [{ "path": "/api/cron", "schedule": "0 9,14,18 * * 1-5" }] }
 * → 평일 09:00, 14:00, 18:00 KST에 실행
 */

import { NextRequest, NextResponse } from 'next/server';
import '@/lib/bid-api';
import '@/lib/bizinfo-api';
import '@/lib/crawlers/nipa-crawler';
import '@/lib/crawlers/nia-crawler';
import '@/lib/crawlers/mois-crawler';
import '@/lib/crawlers/seoul-crawler';
import { fetchFromAllSources } from '@/lib/source-adapter';
import { getSlackMode, postSlackMessage, postSlackWebhook } from '@/lib/slack';
import type { BidItem } from '@/types/bid';

// 자동 알림 대상 키워드
const AUTO_ALERT_KEYWORDS = ['AI', '인공지능', '생성형AI', '생성형 AI', '클라우드', 'cloud', 'SaaS', 'IaaS', 'PaaS'];

function matchesAlertKeywords(title: string): string[] {
    const text = title.toLowerCase();
    return AUTO_ALERT_KEYWORDS.filter(kw => text.includes(kw.toLowerCase()));
}

function formatDate(d: Date): string {
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
    // Vercel Cron 인증
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        const mode = getSlackMode();
        if (mode === 'none') {
            return NextResponse.json({ success: false, error: '슬랙 미설정' }, { status: 400 });
        }

        const now = new Date();
        const today = formatDate(now);
        const threeMonthsLater = formatDate(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000));
        const dateLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:00`;

        console.log(`[Cron] ${dateLabel} 자동 알림 시작`);

        // 모든 소스에서 공고 수집
        const { items: allItems, sourceStats, errors } = await fetchFromAllSources({
            startDate: today,
            endDate: threeMonthsLater,
            category: 'all',
            aiOnly: false,
            keyword: '',
            page: 1,
            pageSize: 999,
            sources: [],
        });

        // 모집 중 필터 (마감일 >= 오늘)
        const activeItems = allItems.filter(item => {
            if (!item.bidEndDt) return true;
            const endDt = item.bidEndDt.replace(/[^0-9]/g, '').substring(0, 8);
            if (!endDt || endDt.length < 8) return true;
            return endDt >= today;
        });

        // AI/클라우드 키워드 매칭 필터
        const alertItems = activeItems.filter(item => {
            const matched = matchesAlertKeywords(item.title);
            if (matched.length > 0) {
                item.matchedKeywords = matched;
                item.isPriority = true;
                return true;
            }
            return false;
        });

        // 중복 제거
        const seen = new Set<string>();
        const uniqueItems = alertItems.filter(item => {
            const key = item.title.trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        console.log(`[Cron] 전체 ${allItems.length}건 → 모집중 ${activeItems.length}건 → 키워드 매칭 ${uniqueItems.length}건`);

        if (uniqueItems.length === 0) {
            return NextResponse.json({
                success: true,
                message: `${dateLabel} 새로운 AI/클라우드 공고 없음`,
                stats: sourceStats,
            });
        }

        // 슬랙 메시지 구성
        const headerText = `📡 ${dateLabel} AI·클라우드 공고 ${uniqueItems.length}건 감지`;
        const sourceList = Object.entries(sourceStats)
            .filter(([, count]) => count > 0)
            .map(([src, count]) => `${src}: ${count}건`)
            .join(', ');

        if (mode === 'bot') {
            // 메인 메시지
            const mainBlocks = [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `🚨 *${headerText}*\n수집 현황: ${sourceList}`,
                    },
                },
            ];

            const mainTs = await postSlackMessage(headerText, mainBlocks);

            // 쓰레드로 개별 공고 전송
            let sentCount = 0;
            for (const item of uniqueItems.slice(0, 30)) {
                const keywords = item.matchedKeywords.map(k => `\`${k}\``).join(' ');
                const endDt = item.bidEndDt
                    ? item.bidEndDt.replace(/[^0-9]/g, '').substring(0, 8)
                    : '';
                const deadline = endDt.length >= 8
                    ? `${endDt.slice(0, 4)}.${endDt.slice(4, 6)}.${endDt.slice(6, 8)}`
                    : '미정';
                const url = item.detailUrl || '#';

                const threadBlocks = [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: [
                                `🔴 *<${url}|${item.title}>*`,
                                `> 🏛️ ${item.organization || '미정'} | 📅 마감: ${deadline}`,
                                `> 🏷️ ${keywords} | 📌 ${item.sourceLabel || item.source}`,
                                item.estimatedPrice ? `> 💰 ${Number(item.estimatedPrice) >= 100000000 ? `${Math.floor(Number(item.estimatedPrice) / 100000000)}억원` : `${Math.floor(Number(item.estimatedPrice) / 10000).toLocaleString()}만원`}` : '',
                            ].filter(Boolean).join('\n'),
                        },
                    },
                ];

                await postSlackMessage(item.title, threadBlocks, mainTs || undefined);
                sentCount++;

                // Rate limit
                if (sentCount < uniqueItems.length) {
                    await new Promise(r => setTimeout(r, 1200));
                }
            }

            return NextResponse.json({
                success: true,
                message: `${dateLabel} ${sentCount}건 슬랙 전송 완료`,
                itemCount: sentCount,
                stats: sourceStats,
            });

        } else {
            // Webhook 모드
            const itemList = uniqueItems.slice(0, 20).map((item, i) => {
                const keywords = item.matchedKeywords.join(', ');
                const url = item.detailUrl || '#';
                return `${i + 1}. <${url}|${item.title}> [${keywords}] - ${item.sourceLabel || item.source}`;
            }).join('\n');

            const blocks = [
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: `🚨 *${headerText}*\n수집: ${sourceList}` },
                },
                { type: 'divider' },
                {
                    type: 'section',
                    text: { type: 'mrkdwn', text: itemList },
                },
            ];

            await postSlackWebhook(headerText, blocks);

            return NextResponse.json({
                success: true,
                message: `${dateLabel} ${uniqueItems.length}건 슬랙 전송`,
                itemCount: uniqueItems.length,
            });
        }

    } catch (error) {
        console.error('[Cron Error]', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
