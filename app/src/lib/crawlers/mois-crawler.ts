/**
 * 행정안전부(MOIS) 새소식·알립니다 크롤러
 *
 * 실제 확인된 URL:
 * - 알립니다(새소식): type013 게시판, bbsId=BBSMSTR_000000000006
 * - 훈령·예규·고시: type001, bbsId=BBSMSTR_000000000016
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
} from '../source-adapter';

const MOIS_URLS = [
    // 알립니다 (새소식) — 실제 확인된 게시판
    'https://www.mois.go.kr/frt/bbs/type013/commonSelectBoardList.do?bbsId=BBSMSTR_000000000006',
    // 훈령·예규·고시
    'https://www.mois.go.kr/frt/bbs/type001/commonSelectBoardList.do?bbsId=BBSMSTR_000000000016',
];

const MOIS_DETAIL_BASE = 'https://www.mois.go.kr/frt/bbs/type013/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000006&nttId=';

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * 행안부 공고 크롤링
 */
async function crawlMois(): Promise<BidItem[]> {
    const allItems: BidItem[] = [];

    for (const url of MOIS_URLS) {
        try {
            console.log(`[MOIS Crawler] ${url.substring(0, 80)}... 크롤링 시도`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                    'Accept-Language': 'ko-KR,ko;q=0.9',
                },
                next: { revalidate: 1800 },
            });

            if (!response.ok) {
                console.warn(`[MOIS Crawler] 응답 실패: ${response.status}`);
                continue;
            }

            const html = await response.text();

            // 행안부 table 기반 게시판 파싱
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

                // 링크에서 nttId 추출
                const linkPattern = /nttId=(\d+)/i;
                const linkMatch = rowContent.match(linkPattern);
                const nttId = linkMatch ? linkMatch[1] : '';

                // href 전체 추출
                const hrefPattern = /href=["']([^"']*nttId[^"']*)["']/i;
                const hrefMatch = rowContent.match(hrefPattern);
                const detailUrl = hrefMatch
                    ? (hrefMatch[1].startsWith('http') ? hrefMatch[1] : `https://www.mois.go.kr${hrefMatch[1]}`)
                    : (nttId ? `${MOIS_DETAIL_BASE}${nttId}` : undefined);

                // 제목 추출 (a 태그 안의 텍스트 우선)
                let title = '';
                const aPattern = /<a[^>]*>([\s\S]*?)<\/a>/i;
                const aMatch = rowContent.match(aPattern);
                if (aMatch) title = stripHtml(aMatch[1]);
                if (!title) title = cells[1] || cells[0] || '';
                if (!title || title.length < 5) continue;

                // 날짜 추출
                const dateStr = cells.find(c => /\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(c)) || '';
                const cleanDate = dateStr.replace(/[^0-9]/g, '').substring(0, 8);

                allItems.push({
                    id: `mois-${nttId || rowIndex}`,
                    bidNtceNo: '', bidNtceOrd: '',
                    title,
                    organization: '행정안전부',
                    demandOrg: '행정안전부',
                    noticeDt: cleanDate,
                    bidStartDt: '', bidEndDt: '',
                    registDt: cleanDate,
                    bidMethod: '', contractMethod: '',
                    detailUrl,
                    category: 'service',
                    isAiRelated: isAiRelated(title),
                    isPriority: isPriorityBid(title),
                    matchedKeywords: matchPriorityKeywords(title),
                    source: 'mois',
                    sourceLabel: '행안부',
                    status: '',
                });
                rowIndex++;
            }

        } catch (error) {
            console.error('[MOIS Crawler] 크롤링 실패:', error);
        }
    }

    console.log(`[MOIS Crawler] 총 ${allItems.length}건 수집 완료`);
    return allItems;
}

const moisAdapter: SourceAdapter = {
    sourceId: 'mois',
    sourceLabel: '행안부',
    isAvailable(): boolean { return true; },
    async fetch(_filter: SearchFilter): Promise<BidItem[]> { return crawlMois(); },
};

registerAdapter(moisAdapter);
