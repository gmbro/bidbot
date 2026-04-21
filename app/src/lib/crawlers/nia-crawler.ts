/**
 * NIA(한국지능정보사회진흥원) 입찰공고 크롤러
 *
 * 작동 확인된 URL:
 * - 입찰공고: https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=78336
 * - 사업공고: https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=65772 (봇 차단)
 *
 * cbIdx=78336은 서버사이드 렌더링이 되어 직접 크롤링 가능합니다.
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
} from '../source-adapter';

const NIA_URL = 'https://www.nia.or.kr/site/nia_kor/ex/bbs/List.do?cbIdx=78336';

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

async function crawlNia(): Promise<BidItem[]> {
    const allItems: BidItem[] = [];

    try {
        console.log(`[NIA Crawler] ${NIA_URL.substring(0, 60)}... 크롤링 시도`);

        const response = await fetch(NIA_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
                'Referer': 'https://www.nia.or.kr/site/nia_kor/main.do',
            },
            next: { revalidate: 1800 },
        });

        if (!response.ok) {
            console.warn(`[NIA Crawler] 응답 실패: ${response.status}`);
            return [];
        }

        const html = await response.text();

        // 게시판 테이블 행 파싱
        const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let rowMatch;
        let rowIndex = 0;

        while ((rowMatch = rowPattern.exec(html)) !== null) {
            const rowContent = rowMatch[1];
            if (rowContent.includes('<th')) continue;

            // td 셀 추출
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

            // 상세 URL 구성
            let detailUrl: string | undefined;
            if (bcIdx) {
                detailUrl = `https://www.nia.or.kr/site/nia_kor/ex/bbs/View.do?cbIdx=78336&bcIdx=${bcIdx}`;
            }

            // 제목 추출 (a 태그)
            let title = '';
            const aPattern = /<a[^>]*>([\s\S]*?)<\/a>/i;
            const aMatch = rowContent.match(aPattern);
            if (aMatch) title = stripHtml(aMatch[1]);
            if (!title) title = cells[1] || cells[0] || '';
            if (!title || title.length < 5) continue;

            // 날짜 추출
            const dateStr = cells.find(c => /\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(c)) || '';
            const cleanDate = dateStr.replace(/[^0-9]/g, '').substring(0, 8);

            // 상태 (접수/마감/진행 등)
            const statusCell = cells.find(c => /접수|마감|진행|종료|공고/.test(c)) || '';

            // 작성자/부서
            const deptCell = cells.find(c => /센터|본부|실|부|팀/.test(c)) || '';

            allItems.push({
                id: `nia-${bcIdx || rowIndex}`,
                bidNtceNo: '', bidNtceOrd: '',
                title,
                organization: '한국지능정보사회진흥원(NIA)',
                demandOrg: deptCell || 'NIA',
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
