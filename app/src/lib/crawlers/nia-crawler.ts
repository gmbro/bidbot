/**
 * NIA(한국지능정보사회진흥원) 입찰공고 크롤러
 *
 * 실제 HTML 구조:
 * <a href="#view" onclick="doBbsFView('78336','29293','16010100','29293');return false;"
 *    title="[공모] 공공 병원정보시스템 AI 클라우드서비스 개발 검증 지원(새 글)-첨부파일 있음">
 *
 * → doBbsFView(cbIdx, bcIdx, deptCode, parentSeq) 패턴에서 bcIdx + title 추출
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

function cleanTitle(raw: string): string {
    // "(새 글)-첨부파일 있음" 등 부가 텍스트 제거
    return raw
        .replace(/\(새\s*글\)/g, '')
        .replace(/-?첨부파일\s*있음/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function crawlNia(): Promise<BidItem[]> {
    const items: BidItem[] = [];

    try {
        console.log('[NIA Crawler] 크롤링 시도...');

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
        console.log(`[NIA Crawler] 응답 길이: ${html.length}`);

        // doBbsFView('cbIdx','bcIdx','deptCode','parentSeq') 패턴 + title 속성
        const pattern = /doBbsFView\s*\(\s*'(\d+)'\s*,\s*'(\d+)'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*\)[\s\S]*?title="([^"]+)"/gi;

        let match;
        const seen = new Set<string>();

        while ((match = pattern.exec(html)) !== null) {
            const cbIdx = match[1];
            const bcIdx = match[2];
            const rawTitle = match[3];

            // 중복 방지 (같은 bcIdx)
            if (seen.has(bcIdx)) continue;
            seen.add(bcIdx);

            const title = cleanTitle(rawTitle);
            if (!title || title.length < 5) continue;

            const detailUrl = `https://www.nia.or.kr/site/nia_kor/ex/bbs/View.do?cbIdx=${cbIdx}&bcIdx=${bcIdx}`;

            items.push({
                id: `nia-${bcIdx}`,
                bidNtceNo: '', bidNtceOrd: '',
                title,
                organization: '한국지능정보사회진흥원(NIA)',
                demandOrg: 'NIA',
                noticeDt: '',
                bidStartDt: '', bidEndDt: '',
                registDt: '',
                bidMethod: '', contractMethod: '',
                detailUrl,
                category: 'service',
                isAiRelated: isAiRelated(title),
                isPriority: isPriorityBid(title),
                matchedKeywords: matchPriorityKeywords(title),
                source: 'nia',
                sourceLabel: 'NIA',
                status: '',
            });
        }

        // 날짜 추출 시도 (별도): <td> 안에 날짜 패턴 있으면 매칭
        // NIA의 목록에는 날짜가 별도 <span>에 있을 수 있음
        const datePattern = /<span[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/span>/gi;
        let dateMatch;
        let dateIndex = 0;
        while ((dateMatch = datePattern.exec(html)) !== null && dateIndex < items.length) {
            const dateStr = dateMatch[1].replace(/[^0-9]/g, '').substring(0, 8);
            if (dateStr.length >= 8) {
                items[dateIndex].noticeDt = dateStr;
                items[dateIndex].registDt = dateStr;
            }
            dateIndex++;
        }

    } catch (error) {
        console.error('[NIA Crawler] 크롤링 실패:', error);
    }

    console.log(`[NIA Crawler] 총 ${items.length}건 수집 완료`);
    return items;
}

const niaAdapter: SourceAdapter = {
    sourceId: 'nia',
    sourceLabel: 'NIA',
    isAvailable(): boolean { return true; },
    async fetch(_filter: SearchFilter): Promise<BidItem[]> { return crawlNia(); },
};

registerAdapter(niaAdapter);
