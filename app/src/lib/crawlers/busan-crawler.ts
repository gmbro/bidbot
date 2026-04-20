/**
 * 부산 Big-데이터웨이브(data.busan.go.kr) 크롤러
 *
 * 크롤링 대상:
 * - 공지사항: /bdip/board/notice.do
 * - 공공데이터 목록: /bdip/opendata/dataSet.do
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
} from '../source-adapter';

const BUSAN_BASE = 'https://data.busan.go.kr';
const BUSAN_URLS = [
    `${BUSAN_BASE}/bdip/board/notice.do?bbs=BBSMSTR_000000000001sLfEakyobO`,  // 공지사항
    `${BUSAN_BASE}/bdip/opendata/dataSet.do`,  // 데이터 카탈로그
];

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function crawlBusan(): Promise<BidItem[]> {
    const allItems: BidItem[] = [];
    const seenTitles = new Set<string>();

    for (let urlIdx = 0; urlIdx < BUSAN_URLS.length; urlIdx++) {
        const url = BUSAN_URLS[urlIdx];
        const prefix = urlIdx === 0 ? 'notice' : 'data';

        try {
            console.log(`[Busan Crawler] ${url.substring(0, 60)}... 크롤링 시도`);

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
                console.warn(`[Busan Crawler] 응답 실패: ${response.status}`);
                continue;
            }

            const html = await response.text();

            // 에러 페이지 감지
            if (html.includes('Error page') || html.includes('페이지를 찾을 수 없습니다')) {
                console.warn(`[Busan Crawler] 에러 페이지 감지`);
                continue;
            }

            let rowIndex = 0;

            // 테이블 행 파싱
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
                    detailUrl = hrefMatch[1].startsWith('http') ? hrefMatch[1] : `${BUSAN_BASE}${hrefMatch[1]}`;
                }

                const dateStr = cells.find(c => /\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(c)) || '';
                const cleanDate = dateStr.replace(/[^0-9]/g, '').substring(0, 8);

                allItems.push({
                    id: `busan-${prefix}-${rowIndex}`,
                    bidNtceNo: '', bidNtceOrd: '',
                    title,
                    organization: '부산광역시 빅데이터웨이브',
                    demandOrg: '부산광역시',
                    noticeDt: cleanDate,
                    bidStartDt: '', bidEndDt: '',
                    registDt: cleanDate,
                    bidMethod: '', contractMethod: '',
                    detailUrl,
                    category: 'service',
                    isAiRelated: isAiRelated(title),
                    isPriority: isPriorityBid(title),
                    matchedKeywords: matchPriorityKeywords(title),
                    source: 'busan',
                    sourceLabel: '부산시',
                    status: '',
                });
                rowIndex++;
            }

            // li/div 리스트 기반 파싱 (데이터셋 카드)
            const cardPattern = /<div[^>]*class="[^"]*(?:data|card|item|list)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
            let cardMatch;
            while ((cardMatch = cardPattern.exec(html)) !== null) {
                const content = cardMatch[1];
                const aMatch2 = content.match(/<a[^>]*href=["']([^"']*?)["'][^>]*>([\s\S]*?)<\/a>/i);
                if (!aMatch2) continue;

                const href = aMatch2[1].startsWith('http') ? aMatch2[1] : `${BUSAN_BASE}${aMatch2[1]}`;
                const cardTitle = stripHtml(aMatch2[2]);
                if (!cardTitle || cardTitle.length < 3 || seenTitles.has(cardTitle)) continue;
                seenTitles.add(cardTitle);

                const dateMatch = content.match(/(\d{4}[.\-/]\d{2}[.\-/]\d{2})/);
                const dateClean = dateMatch ? dateMatch[1].replace(/[^0-9]/g, '').substring(0, 8) : '';

                allItems.push({
                    id: `busan-${prefix}-card-${rowIndex}`,
                    bidNtceNo: '', bidNtceOrd: '',
                    title: cardTitle,
                    organization: '부산광역시 빅데이터웨이브',
                    demandOrg: '부산광역시',
                    noticeDt: dateClean,
                    bidStartDt: '', bidEndDt: '',
                    registDt: dateClean,
                    bidMethod: '', contractMethod: '',
                    detailUrl: href,
                    category: 'service',
                    isAiRelated: isAiRelated(cardTitle),
                    isPriority: isPriorityBid(cardTitle),
                    matchedKeywords: matchPriorityKeywords(cardTitle),
                    source: 'busan',
                    sourceLabel: '부산시',
                    status: '',
                });
                rowIndex++;
            }

        } catch (error) {
            console.error(`[Busan Crawler] 크롤링 실패:`, error);
        }
    }

    console.log(`[Busan Crawler] 총 ${allItems.length}건 수집 완료`);
    return allItems;
}

const busanAdapter: SourceAdapter = {
    sourceId: 'busan',
    sourceLabel: '부산시',
    isAvailable(): boolean { return true; },
    async fetch(_filter: SearchFilter): Promise<BidItem[]> { return crawlBusan(); },
};

registerAdapter(busanAdapter);
