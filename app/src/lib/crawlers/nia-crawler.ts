/**
 * NIA(한국지능정보사회진흥원) 소스 어댑터
 *
 * NIA 웹사이트가 봇 접근을 차단하므로,
 * 나라장터(G2B) API에서 NIA 발주 공고를 키워드 기반으로 수집합니다.
 * NIA는 AI/데이터 관련 국가 사업을 총괄하므로
 * "지능정보", "NIA", "한국지능" 등으로 검색합니다.
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
} from '../source-adapter';

const BIZINFO_API_KEY = process.env.BIZINFO_API_KEY || '';
const BIZINFO_API_URL = 'https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do';

async function fetchNiaFromBizinfo(): Promise<BidItem[]> {
    if (!BIZINFO_API_KEY) return [];

    const allItems: BidItem[] = [];
    const keywords = ['NIA', '지능정보'];

    for (const kw of keywords) {
        try {
            const params = new URLSearchParams({
                crtfcKey: BIZINFO_API_KEY,
                dataType: 'json',
                pageUnit: '30',
                pageIndex: '1',
                srchKeyword: kw,
            });

            const url = `${BIZINFO_API_URL}?${params.toString()}`;
            console.log(`[NIA via Bizinfo] ${kw} 검색 시도...`);

            const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                next: { revalidate: 1800 },
            });

            if (!response.ok) continue;

            const data = await response.json();
            let rawItems: any[] = [];
            if (data.jsonArray) rawItems = data.jsonArray;
            else if (Array.isArray(data)) rawItems = data;

            for (const item of rawItems) {
                const title = item.pblancNm || '';
                if (!title) continue;

                // NIA/지능정보 관련 항목만
                const text = `${title} ${item.jrsdInsttNm || ''} ${item.excInsttNm || ''}`.toLowerCase();
                if (!text.includes('nia') && !text.includes('지능정보') && !text.includes('한국지능')) continue;

                const today = new Date();
                const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
                const endDate = (item.reqstEndDe || '').replace(/[^0-9]/g, '').substring(0, 8);
                if (endDate && endDate.length >= 8 && endDate < todayStr) continue;

                allItems.push({
                    id: `nia-biz-${item.pblancId || allItems.length}`,
                    bidNtceNo: '', bidNtceOrd: '',
                    title,
                    organization: item.jrsdInsttNm || 'NIA',
                    demandOrg: item.excInsttNm || 'NIA',
                    noticeDt: (item.creatDt || '').replace(/[^0-9]/g, '').substring(0, 8),
                    bidStartDt: (item.reqstBeginDe || '').replace(/[^0-9]/g, '').substring(0, 8),
                    bidEndDt: endDate,
                    registDt: (item.creatDt || '').replace(/[^0-9]/g, '').substring(0, 8),
                    bidMethod: '', contractMethod: '',
                    detailUrl: item.detailUrl || item.pblancUrl || undefined,
                    category: 'service',
                    isAiRelated: isAiRelated(title),
                    isPriority: isPriorityBid(title),
                    matchedKeywords: matchPriorityKeywords(title),
                    source: 'nia',
                    sourceLabel: 'NIA',
                    description: item.bsnsSumryCn || '',
                });
            }
        } catch (error) {
            console.error(`[NIA via Bizinfo] ${kw} 검색 실패:`, error);
        }
    }

    // 중복 제거
    const seen = new Set<string>();
    const unique = allItems.filter(item => {
        if (seen.has(item.title)) return false;
        seen.add(item.title);
        return true;
    });

    console.log(`[NIA via Bizinfo] 총 ${unique.length}건 수집`);
    return unique;
}

const niaAdapter: SourceAdapter = {
    sourceId: 'nia',
    sourceLabel: 'NIA',
    isAvailable(): boolean { return !!BIZINFO_API_KEY; },
    async fetch(_filter: SearchFilter): Promise<BidItem[]> { return fetchNiaFromBizinfo(); },
};

registerAdapter(niaAdapter);
