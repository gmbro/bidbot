/**
 * 기업마당(bizinfo.go.kr) 소스 어댑터
 *
 * 중소벤처기업부가 운영하는 기업마당 API를 통해
 * NIPA, NIA, 행안부, 부산시 등 다양한 기관의 지원사업 공고를 통합 수집합니다.
 *
 * API Endpoint: https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
} from './source-adapter';

const BIZINFO_API_URL = 'https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do';
const BIZINFO_API_KEY = process.env.BIZINFO_API_KEY || '';

/**
 * 기업마당 API 원본 데이터를 BidItem으로 변환
 */
function toBidItem(item: any): BidItem {
    const title = item.pblancNm || item.title || '';
    const org = item.jrsdInsttNm || item.pbancRcptInsttNm || '';

    return {
        id: `bizinfo-${item.pblancId || item.inqireNo || Math.random().toString(36).slice(2)}`,
        bidNtceNo: '',
        bidNtceOrd: '',
        title,
        organization: org,
        demandOrg: org,
        noticeDt: item.creatPnttm || item.pblancBgngYmd || '',
        bidStartDt: item.pblancBgngYmd || '',
        bidEndDt: item.pblancEndYmd || '',
        registDt: item.creatPnttm || '',
        bidMethod: '',
        contractMethod: '',
        estimatedPrice: undefined,
        detailUrl: item.detailUrl || item.pblancUrl || undefined,
        category: classifyCategory(title),
        isAiRelated: isAiRelated(title),
        isPriority: isPriorityBid(title),
        matchedKeywords: matchPriorityKeywords(title),
        source: 'bizinfo',
        sourceLabel: '기업마당',
        status: item.pblancNm?.includes('마감') ? '마감' : '접수중',
        description: item.bsnsSumryCn || '',
    };
}

function classifyCategory(title: string): BidItem['category'] {
    const text = title.toLowerCase();
    if (text.includes('용역') || text.includes('서비스') || text.includes('컨설팅') || text.includes('개발') || text.includes('시스템') || text.includes('구축')) return 'service';
    if (text.includes('공사') || text.includes('건설')) return 'construction';
    if (text.includes('물품') || text.includes('구매') || text.includes('장비')) return 'thing';
    return 'etc';
}

/**
 * 기업마당 API 호출
 */
async function fetchBizinfoAPI(keyword?: string): Promise<BidItem[]> {
    const params = new URLSearchParams({
        crtfcKey: BIZINFO_API_KEY,
        dataType: 'json',
        pageUnit: '50',
        pageIndex: '1',
    });

    // 키워드가 있으면 검색어 추가
    if (keyword) {
        params.set('srchKeyword', keyword);
    }

    const url = `${BIZINFO_API_URL}?${params.toString()}`;
    console.log(`[Bizinfo API Call] ${url.substring(0, 120)}...`);

    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 600 }, // 10분 캐시
    });

    if (!response.ok) {
        console.error(`[Bizinfo API Error] ${response.status}`);
        throw new Error(`기업마당 API 호출 실패: ${response.status}`);
    }

    const data = await response.json();

    // 응답 구조 파싱 (기업마당 API는 여러 포맷으로 응답할 수 있음)
    let rawItems: any[] = [];
    if (data.jsonArray) {
        rawItems = data.jsonArray;
    } else if (data.response?.body?.items) {
        rawItems = Array.isArray(data.response.body.items) ? data.response.body.items : [data.response.body.items];
    } else if (Array.isArray(data)) {
        rawItems = data;
    }

    console.log(`[Bizinfo API Result] ${rawItems.length}건`);
    return rawItems.map(toBidItem);
}

// ─── 기업마당 어댑터 등록 ───
const bizinfoAdapter: SourceAdapter = {
    sourceId: 'bizinfo',
    sourceLabel: '기업마당',

    isAvailable(): boolean {
        return !!BIZINFO_API_KEY;
    },

    async fetch(filter: SearchFilter): Promise<BidItem[]> {
        try {
            const keyword = filter.keyword || '클라우드';
            const items = await fetchBizinfoAPI(keyword);

            // 모집 중만 반환 (마감일 >= 오늘 & 상태가 '마감'이 아닌 것)
            const today = new Date();
            const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

            return items.filter(item => {
                // 상태가 명시적으로 마감이면 제외
                if (item.status === '마감') return false;
                // 마감일 체크
                if (item.bidEndDt) {
                    const endDt = item.bidEndDt.replace(/[^0-9]/g, '').substring(0, 8);
                    if (endDt && endDt.length >= 8 && endDt < todayStr) return false;
                }
                return true;
            });
        } catch (error) {
            console.error('[Bizinfo Adapter] Fetch failed:', error);
            return [];
        }
    },
};

registerAdapter(bizinfoAdapter);
