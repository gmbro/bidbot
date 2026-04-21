/**
 * 행정안전부(MOIS) 새소식 크롤러
 *
 * 실제 HTML 구조:
 * <a href="..?bbsId=BBSMSTR_000000000006&nttId=125058"
 *    onclick="javascript:fn_egov_inqire_notice('125058', 'BBSMSTR_000000000006'); return false;">
 *    제14회 범정부 공공데이터·AI 활용 창업경진대회 통합공고
 * </a>
 *
 * → href에서 nttId 추출 + <a> 내부 텍스트에서 제목 추출
 *
 * AI/디지털 검색 URL만 사용하여 관련 공고만 수집합니다.
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
} from '../source-adapter';

// AI/디지털 관련 검색 URL만 사용
const MOIS_URLS = [
    {
        url: 'https://www.mois.go.kr/frt/bbs/type013/commonSelectBoardList.do?bbsId=BBSMSTR_000000000006&searchCnd=0&searchWrd=AI',
        bbsId: 'BBSMSTR_000000000006',
    },
    {
        url: 'https://www.mois.go.kr/frt/bbs/type013/commonSelectBoardList.do?bbsId=BBSMSTR_000000000006&searchCnd=0&searchWrd=%EB%94%94%EC%A7%80%ED%84%B8',
        bbsId: 'BBSMSTR_000000000006',
    },
    {
        url: 'https://www.mois.go.kr/frt/bbs/type013/commonSelectBoardList.do?bbsId=BBSMSTR_000000000006&searchCnd=0&searchWrd=%ED%81%B4%EB%9D%BC%EC%9A%B0%EB%93%9C',
        bbsId: 'BBSMSTR_000000000006',
    },
];

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

async function crawlMois(): Promise<BidItem[]> {
    const allItems: BidItem[] = [];
    const seen = new Set<string>();

    for (const { url, bbsId } of MOIS_URLS) {
        try {
            console.log(`[MOIS Crawler] ${url.substring(0, 100)}...`);

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

            // 패턴 1: fn_egov_inqire_notice 링크에서 nttId + 제목 추출
            // <a href="...nttId=125058" onclick="fn_egov_inqire_notice(...)">제목텍스트\n</a>
            const linkPattern = /nttId=(\d+)[^>]*onclick="[^"]*fn_egov_inqire_notice[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
            let linkMatch;

            while ((linkMatch = linkPattern.exec(html)) !== null) {
                const nttId = linkMatch[1];
                if (seen.has(nttId)) continue;
                seen.add(nttId);

                const title = stripHtml(linkMatch[2]);
                if (!title || title.length < 5) continue;

                const detailUrl = `https://www.mois.go.kr/frt/bbs/type013/commonSelectBoardArticle.do?bbsId=${bbsId}&nttId=${nttId}`;

                allItems.push({
                    id: `mois-${nttId}`,
                    bidNtceNo: '', bidNtceOrd: '',
                    title,
                    organization: '행정안전부',
                    demandOrg: '행정안전부',
                    noticeDt: '',
                    bidStartDt: '', bidEndDt: '',
                    registDt: '',
                    bidMethod: '', contractMethod: '',
                    detailUrl,
                    category: 'service',
                    isAiRelated: true, // AI/디지털 검색 결과이므로 관련성 보장
                    isPriority: isPriorityBid(title),
                    matchedKeywords: matchPriorityKeywords(title),
                    source: 'mois',
                    sourceLabel: '행안부',
                    status: '',
                });
            }

            // 패턴 2: 날짜 추출 (테이블 행 내 날짜)
            // <td ...>2026.04.18</td> 패턴
            const datePattern = /(\d{4})[.\-/](\d{2})[.\-/](\d{2})/g;
            const dates: string[] = [];
            let dateMatch;
            while ((dateMatch = datePattern.exec(html)) !== null) {
                const d = `${dateMatch[1]}${dateMatch[2]}${dateMatch[3]}`;
                if (d.startsWith('202')) dates.push(d);
            }
            // 날짜를 아이템에 매칭 (순서대로)
            let dateIdx = 0;
            for (const item of allItems) {
                if (!item.noticeDt && dateIdx < dates.length) {
                    item.noticeDt = dates[dateIdx];
                    item.registDt = dates[dateIdx];
                    dateIdx++;
                }
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
