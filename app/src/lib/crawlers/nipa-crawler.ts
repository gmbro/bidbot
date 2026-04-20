/**
 * NIPA(정보통신산업진흥원) 사업공고 크롤러
 *
 * NIPA 신규 홈페이지 구조에 맞춰 튜닝됨:
 * - 사업공고: https://www.nipa.kr/home/2-2
 * - 입찰공고: https://www.nipa.kr/home/2-3
 *
 * ⚠️ NIPA 사이트는 CSR(클라이언트 사이드 렌더링) 기반이라
 *    fetch로 가져온 HTML에 실제 공고 데이터가 없을 수 있습니다.
 *    이 경우 빈 배열을 반환하고, 기업마당 API에서 NIPA 공고를 수집합니다.
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
} from '../source-adapter';

const NIPA_URLS = [
    'https://www.nipa.kr/home/2-2',   // 사업공고
    'https://www.nipa.kr/home/2-3',   // 입찰공고
];
const NIPA_DETAIL_BASE = 'https://www.nipa.kr/home/2-2/';

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

/**
 * NIPA 사업공고 크롤링
 */
async function crawlNipa(): Promise<BidItem[]> {
    const allItems: BidItem[] = [];

    for (let urlIdx = 0; urlIdx < NIPA_URLS.length; urlIdx++) {
        const url = NIPA_URLS[urlIdx];
        const urlPrefix = urlIdx === 0 ? 'biz' : 'bid'; // 사업공고 vs 입찰공고
        try {
            console.log(`[NIPA Crawler] ${url} 크롤링 시도...`);

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
                },
                next: { revalidate: 1800 },
            });

            if (!response.ok) {
                console.warn(`[NIPA Crawler] ${url} 응답 실패: ${response.status}`);
                continue;
            }

            const html = await response.text();

            // 방법 1: 테이블 기반 파싱
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

                if (cells.length < 2) continue;

                // 링크 추출
                const linkPattern = /href=["']([^"']*?)["']/i;
                const linkMatch = rowContent.match(linkPattern);
                const detailUrl = linkMatch ? (linkMatch[1].startsWith('http') ? linkMatch[1] : `https://www.nipa.kr${linkMatch[1]}`) : undefined;

                // 제목: 링크가 있는 셀, 없으면 가장 긴 셀
                let title = '';
                const aTextPattern = /<a[^>]*>([\s\S]*?)<\/a>/i;
                const aMatch = rowContent.match(aTextPattern);
                if (aMatch) {
                    title = stripHtml(aMatch[1]);
                }
                if (!title) {
                    title = cells.reduce((a, b) => a.length > b.length ? a : b, '');
                }
                if (!title || title.length < 3) continue;

                // 날짜 추출
                const dateStr = cells.find(c => /\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(c)) || '';
                const cleanDate = dateStr.replace(/[^0-9]/g, '').substring(0, 8);

                // 상태 추출
                const statusCell = cells.find(c => /접수|마감|진행|예정|종료|공고/.test(c)) || '';

                allItems.push({
                    id: `nipa-${urlPrefix}-${rowIndex}-${cleanDate || Date.now()}`,
                    bidNtceNo: '',
                    bidNtceOrd: '',
                    title,
                    organization: '정보통신산업진흥원(NIPA)',
                    demandOrg: 'NIPA',
                    noticeDt: cleanDate,
                    bidStartDt: '',
                    bidEndDt: '',
                    registDt: cleanDate,
                    bidMethod: '',
                    contractMethod: '',
                    detailUrl,
                    category: 'service',
                    isAiRelated: isAiRelated(title),
                    isPriority: isPriorityBid(title),
                    matchedKeywords: matchPriorityKeywords(title),
                    source: 'nipa',
                    sourceLabel: 'NIPA',
                    status: statusCell,
                });
                rowIndex++;
            }

            // 방법 2: li/div 기반 파싱 (게시판이 리스트 형태인 경우)
            if (allItems.length === 0) {
                const listPattern = /<li[^>]*class="[^"]*(?:bbs|list|board)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
                let listMatch;
                while ((listMatch = listPattern.exec(html)) !== null) {
                    const content = listMatch[1];
                    const aMatch2 = content.match(/<a[^>]*href=["']([^"']*?)["'][^>]*>([\s\S]*?)<\/a>/i);
                    if (!aMatch2) continue;

                    const href = aMatch2[1].startsWith('http') ? aMatch2[1] : `https://www.nipa.kr${aMatch2[1]}`;
                    const itemTitle = stripHtml(aMatch2[2]);
                    if (!itemTitle || itemTitle.length < 3) continue;

                    const dateMatch = content.match(/(\d{4}[.\-/]\d{2}[.\-/]\d{2})/);
                    const dateClean = dateMatch ? dateMatch[1].replace(/[^0-9]/g, '').substring(0, 8) : '';

                    allItems.push({
                        id: `nipa-${urlPrefix}-list-${allItems.length}`,
                        bidNtceNo: '', bidNtceOrd: '', title: itemTitle,
                        organization: '정보통신산업진흥원(NIPA)', demandOrg: 'NIPA',
                        noticeDt: dateClean, bidStartDt: '', bidEndDt: '', registDt: dateClean,
                        bidMethod: '', contractMethod: '', detailUrl: href,
                        category: 'service',
                        isAiRelated: isAiRelated(itemTitle),
                        isPriority: isPriorityBid(itemTitle),
                        matchedKeywords: matchPriorityKeywords(itemTitle),
                        source: 'nipa', sourceLabel: 'NIPA', status: '',
                    });
                }
            }

        } catch (error) {
            console.error(`[NIPA Crawler] ${url} 크롤링 실패:`, error);
        }
    }

    console.log(`[NIPA Crawler] 총 ${allItems.length}건 수집 완료`);
    return allItems;
}

// ─── NIPA 어댑터 등록 ───
const nipaAdapter: SourceAdapter = {
    sourceId: 'nipa',
    sourceLabel: 'NIPA',
    isAvailable(): boolean { return true; },
    async fetch(_filter: SearchFilter): Promise<BidItem[]> { return crawlNipa(); },
};

registerAdapter(nipaAdapter);
