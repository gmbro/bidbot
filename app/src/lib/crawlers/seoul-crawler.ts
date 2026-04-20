/**
 * 서울AI플랫폼(seoulai.saif.or.kr) 크롤러
 *
 * 크롤링 대상:
 * - AI 정책 뉴스: /hmpg/bpst/bpstListPage.do
 * - 협업 라운지 (프로젝트 모집): /hmpg/cmmg/czmg/czmgListPage.do
 * - 공지사항: /hmpg/main/main.do (메인에서 추출)
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
} from '../source-adapter';

const SEOUL_BASE = 'https://seoulai.saif.or.kr';
const SEOUL_URLS = [
    `${SEOUL_BASE}/hmpg/bpst/bpstListPage.do`,        // AI 정책
    `${SEOUL_BASE}/hmpg/cmmg/czmg/czmgListPage.do`,   // 협업 라운지 (프로젝트 모집)
    `${SEOUL_BASE}/hmpg/main/main.do`,                  // 메인 페이지 (공지, 협업)
];

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function crawlSeoulAI(): Promise<BidItem[]> {
    const allItems: BidItem[] = [];
    const seenTitles = new Set<string>(); // 중복 방지

    for (let urlIdx = 0; urlIdx < SEOUL_URLS.length; urlIdx++) {
        const url = SEOUL_URLS[urlIdx];
        const prefix = ['policy', 'collab', 'main'][urlIdx];

        try {
            console.log(`[Seoul AI Crawler] ${url.substring(0, 60)}... 크롤링 시도`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'ko-KR,ko;q=0.9',
                },
                signal: AbortSignal.timeout(5000),
                next: { revalidate: 1800 },
            });

            if (!response.ok) {
                console.warn(`[Seoul AI Crawler] 응답 실패: ${response.status}`);
                continue;
            }

            const html = await response.text();
            let itemIndex = 0;

            // 패턴 1: 테이블 행 기반 파싱
            const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            let rowMatch;
            while ((rowMatch = rowPattern.exec(html)) !== null) {
                const rowContent = rowMatch[1];
                if (rowContent.includes('<th')) continue;

                const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                const cells: string[] = [];
                let tdMatch;
                while ((tdMatch = tdPattern.exec(rowContent)) !== null) {
                    cells.push(stripHtml(tdMatch[1]));
                }
                if (cells.length < 2) continue;

                let title = '';
                const aPattern = /<a[^>]*>([\s\S]*?)<\/a>/i;
                const aMatch = rowContent.match(aPattern);
                if (aMatch) title = stripHtml(aMatch[1]);
                if (!title) title = cells.reduce((a, b) => a.length > b.length ? a : b, '');
                if (!title || title.length < 5 || seenTitles.has(title)) continue;
                seenTitles.add(title);

                const hrefMatch = rowContent.match(/href=["']([^"']*?)["']/i);
                let detailUrl: string | undefined;
                if (hrefMatch && !hrefMatch[1].startsWith('javascript')) {
                    detailUrl = hrefMatch[1].startsWith('http') ? hrefMatch[1] : `${SEOUL_BASE}${hrefMatch[1]}`;
                }

                const dateStr = cells.find(c => /\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(c)) || '';
                const cleanDate = dateStr.replace(/[^0-9]/g, '').substring(0, 8);

                const statusCell = cells.find(c => /모집|마감|진행|접수|종료/.test(c)) || '';

                allItems.push({
                    id: `seoul-${prefix}-${itemIndex}`,
                    bidNtceNo: '', bidNtceOrd: '',
                    title,
                    organization: '서울AI재단',
                    demandOrg: '서울AI플랫폼',
                    noticeDt: cleanDate,
                    bidStartDt: '', bidEndDt: '',
                    registDt: cleanDate,
                    bidMethod: '', contractMethod: '',
                    detailUrl,
                    category: 'service',
                    isAiRelated: true, // 서울AI플랫폼은 전부 AI 관련
                    isPriority: isPriorityBid(title),
                    matchedKeywords: matchPriorityKeywords(title),
                    source: 'seoul',
                    sourceLabel: '서울AI',
                    status: statusCell,
                });
                itemIndex++;
            }

            // 패턴 2: li 아이템 기반 파싱 (협업 라운지, 메인 페이지)
            const liPatterns = [
                // 협업 라운지 프로젝트 제목
                /프로젝트 협업[\s\S]*?(?:<[^>]*>)*\s*([\p{L}\p{N}\[\]\(\)'"·\-\s]{5,})/giu,
                // 전문가 섭외
                /전문가 섭외[\s\S]*?(?:<[^>]*>)*\s*([\p{L}\p{N}\[\]\(\)'"·\-\s]{5,})/giu,
                // AI 정책 뉴스 제목 (a 태그 안)
                /<a[^>]*href=["']([^"']*(?:View|view|detail)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
            ];

            for (const pattern of liPatterns) {
                let match;
                while ((match = pattern.exec(html)) !== null) {
                    let title = '';
                    let detailUrl: string | undefined;

                    if (match[2]) {
                        // a 태그 패턴
                        title = stripHtml(match[2]);
                        const href = match[1];
                        if (href && !href.startsWith('javascript')) {
                            detailUrl = href.startsWith('http') ? href : `${SEOUL_BASE}${href}`;
                        }
                    } else {
                        title = stripHtml(match[1]);
                    }

                    if (!title || title.length < 5 || seenTitles.has(title)) continue;
                    seenTitles.add(title);

                    // 날짜 추출
                    const dateContext = html.substring(Math.max(0, match.index - 100), match.index + match[0].length + 200);
                    const dateMatch = dateContext.match(/(\d{4})[.\-/](\d{2})[.\-/](\d{2})/);
                    const cleanDate = dateMatch ? `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}` : '';

                    // 모집마감 여부 확인
                    const nearbyText = html.substring(match.index, Math.min(html.length, match.index + match[0].length + 300));
                    const isClosed = /모집마감/.test(nearbyText);

                    allItems.push({
                        id: `seoul-${prefix}-li-${itemIndex}`,
                        bidNtceNo: '', bidNtceOrd: '',
                        title,
                        organization: '서울AI재단',
                        demandOrg: '서울AI플랫폼',
                        noticeDt: cleanDate,
                        bidStartDt: '', bidEndDt: '',
                        registDt: cleanDate,
                        bidMethod: '', contractMethod: '',
                        detailUrl,
                        category: 'service',
                        isAiRelated: true,
                        isPriority: isPriorityBid(title),
                        matchedKeywords: matchPriorityKeywords(title),
                        source: 'seoul',
                        sourceLabel: '서울AI',
                        status: isClosed ? '마감' : '모집중',
                    });
                    itemIndex++;
                }
            }

        } catch (error) {
            console.error(`[Seoul AI Crawler] 크롤링 실패:`, error);
        }
    }

    console.log(`[Seoul AI Crawler] 총 ${allItems.length}건 수집 완료`);
    return allItems;
}

const seoulAdapter: SourceAdapter = {
    sourceId: 'seoul',
    sourceLabel: '서울AI',
    isAvailable(): boolean { return true; },
    async fetch(_filter: SearchFilter): Promise<BidItem[]> { return crawlSeoulAI(); },
};

registerAdapter(seoulAdapter);
