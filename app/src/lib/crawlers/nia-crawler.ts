/**
 * NIA(한국지능정보사회진흥원) 사업공고 크롤러
 *
 * NIA 홈페이지 게시판 URL:
 * - 사업공고: https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=65772
 * - 입찰공고: https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=65774
 *
 * ⚠️ NIA 사이트도 CSR 기반일 수 있어 빈 결과를 반환할 수 있습니다.
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
} from '../source-adapter';

const NIA_URLS = [
    'https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=65772',  // 사업공고
    'https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=65774',  // 입찰공고
];

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

async function crawlNia(): Promise<BidItem[]> {
    const allItems: BidItem[] = [];

    for (const url of NIA_URLS) {
        try {
            console.log(`[NIA Crawler] ${url.substring(0, 80)} 크롤링 시도...`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'ko-KR,ko;q=0.9',
                },
                next: { revalidate: 1800 },
            });

            if (!response.ok) {
                console.warn(`[NIA Crawler] 응답 실패: ${response.status}`);
                continue;
            }

            const html = await response.text();

            // 테이블 파싱
            const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            let rowMatch;
            let rowIndex = 0;

            while ((rowMatch = rowPattern.exec(html)) !== null) {
                const rowContent = rowMatch[1];
                if (rowContent.includes('<th')) continue;

                const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
                const cells: string[] = [];
                let tdMatch;
                while ((tdMatch = tdPattern.exec(rowContent)) !== null) {
                    cells.push(stripHtml(tdMatch[1]));
                }

                if (cells.length < 3) continue;

                // bcIdx 링크 추출
                const linkPattern = /bcIdx=(\d+)/i;
                const linkMatch = rowContent.match(linkPattern);
                const bcIdx = linkMatch ? linkMatch[1] : '';

                // href 전체 추출
                const hrefPattern = /href=["']([^"']*?)["']/i;
                const hrefMatch = rowContent.match(hrefPattern);
                let detailUrl: string | undefined;
                if (hrefMatch) {
                    detailUrl = hrefMatch[1].startsWith('http')
                        ? hrefMatch[1]
                        : `https://www.nia.or.kr${hrefMatch[1]}`;
                } else if (bcIdx) {
                    detailUrl = `https://www.nia.or.kr/site/nia_kor/ex/bbs/View.do?cbIdx=65772&bcIdx=${bcIdx}`;
                }

                // 제목
                let title = '';
                const aPattern = /<a[^>]*>([\s\S]*?)<\/a>/i;
                const aMatch = rowContent.match(aPattern);
                if (aMatch) title = stripHtml(aMatch[1]);
                if (!title) title = cells[1] || cells[0] || '';
                if (!title || title.length < 5) continue;

                // 날짜
                const dateStr = cells.find(c => /\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(c)) || '';
                const cleanDate = dateStr.replace(/[^0-9]/g, '').substring(0, 8);

                // 상태
                const statusCell = cells.find(c => /접수|마감|진행|종료|공고/.test(c)) || '';

                allItems.push({
                    id: `nia-${bcIdx || rowIndex}`,
                    bidNtceNo: '', bidNtceOrd: '',
                    title,
                    organization: '한국지능정보사회진흥원(NIA)',
                    demandOrg: 'NIA',
                    noticeDt: cleanDate,
                    bidStartDt: '', bidEndDt: '',
                    registDt: cleanDate,
                    bidMethod: '', contractMethod: '',
                    detailUrl,
                    category: 'service',
                    isAiRelated: isAiRelated(title),
                    isPriority: isPriorityBid(title),
                    matchedKeywords: matchPriorityKeywords(title),
                    source: 'nia',
                    sourceLabel: 'NIA',
                    status: statusCell,
                });
                rowIndex++;
            }

        } catch (error) {
            console.error('[NIA Crawler] 크롤링 실패:', error);
        }
    }

    console.log(`[NIA Crawler] 총 ${allItems.length}건 수집 완료`);
    return allItems;
}

const niaAdapter: SourceAdapter = {
    sourceId: 'nia',
    sourceLabel: 'NIA',
    isAvailable(): boolean { return true; },
    async fetch(_filter: SearchFilter): Promise<BidItem[]> { return crawlNia(); },
};

registerAdapter(niaAdapter);
