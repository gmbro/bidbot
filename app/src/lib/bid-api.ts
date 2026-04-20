/**
 * 나라장터(G2B) 소스 어댑터
 *
 * data.go.kr의 조달청 나라장터 공공데이터개방표준서비스를 호출합니다.
 *
 * API Endpoint: https://apis.data.go.kr/1230000/ao/PubDataOpnStdService
 * - /getDataSetOpnStdBidPblancInfo (입찰공고정보 조회 - 통합)
 */

import type { BidItem, SearchFilter } from '@/types/bid';
import {
    type SourceAdapter,
    registerAdapter,
    isAiRelated,
    isPriorityBid,
    matchPriorityKeywords,
    PRIORITY_KEYWORDS,
    AI_KEYWORDS,
} from './source-adapter';

const BASE_URL = process.env.DATA_GO_KR_BASE_URL || 'https://apis.data.go.kr/1230000/ao/PubDataOpnStdService';
// 인코딩 키를 우선 사용 (URLSearchParams 이중 인코딩 방지)
const API_KEY_ENCODED = process.env.DATA_GO_KR_API_KEY_ENCODED || '';
const API_KEY_DECODED = process.env.DATA_GO_KR_API_KEY || '';

// ─── Re-export (기존 호환) ───
export { PRIORITY_KEYWORDS, AI_KEYWORDS, isAiRelated, matchPriorityKeywords, isPriorityBid };

/**
 * 날짜를 API 형식(YYYYMMDDHHmm)으로 변환
 */
export function formatDateForApi(date: Date, isEnd = false): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}${isEnd ? '2359' : '0000'}`;
}

/**
 * 날짜 문자열을 읽기 쉬운 형식으로 변환
 */
export function formatDisplayDate(dateStr: string): string {
    if (!dateStr || dateStr.length < 8) return '-';
    const cleaned = dateStr.replace(/[^0-9]/g, '');
    if (cleaned.length >= 12) {
        return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 6)}.${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}:${cleaned.slice(10, 12)}`;
    }
    if (cleaned.length >= 8) {
        return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 6)}.${cleaned.slice(6, 8)}`;
    }
    return dateStr;
}

/**
 * API 원본 데이터를 통합 BidItem으로 변환
 */
function toBidItem(item: any, category: BidItem['category']): BidItem {
    const bidStartDt = item.bidBeginDate && item.bidBeginTm
        ? `${item.bidBeginDate} ${item.bidBeginTm}`
        : (item.bidBeginDt || item.bidBeginDate || '');
    const bidEndDt = item.bidClseDate && item.bidClseTm
        ? `${item.bidClseDate} ${item.bidClseTm}`
        : (item.bidClseDt || item.bidClseDate || '');
    const noticeDt = item.bidNtceDate && item.bidNtceBgn
        ? `${item.bidNtceDate} ${item.bidNtceBgn}`
        : (item.ntceDt || item.bidNtceDate || '');

    return {
        id: `g2b-${item.bidNtceNo}-${item.bidNtceOrd}`,
        bidNtceNo: item.bidNtceNo || '',
        bidNtceOrd: item.bidNtceOrd || '',
        title: item.bidNtceNm || '',
        organization: item.ntceInsttNm || '',
        demandOrg: item.dmndInsttNm || item.dminsttNm || '',
        noticeDt,
        bidStartDt,
        bidEndDt,
        registDt: item.rgstDt || item.dataBssDate || '',
        bidMethod: item.cntrctCnclsMthdNm || item.bidMethdNm || '',
        contractMethod: item.cntrctCnclsSttusNm || item.cntrctMthdNm || '',
        estimatedPrice: item.presmptPrce ? String(item.presmptPrce) : undefined,
        detailUrl: item.bidNtceUrl || item.bidNtceDtlUrl || undefined,
        category,
        noticeKind: item.bidNtceSttusNm || item.ntceKindNm || undefined,
        isAiRelated: isAiRelated(item.bidNtceNm || ''),
        isPriority: isPriorityBid(item.bidNtceNm || ''),
        matchedKeywords: matchPriorityKeywords(item.bidNtceNm || ''),
        // 소스 정보
        source: 'g2b',
        sourceLabel: '나라장터',
    };
}

/**
 * 공고 제목/분류로 카테고리 추정
 */
function classifyCategory(title: string, classification: string): BidItem['category'] {
    const text = (title + ' ' + classification).toLowerCase();
    if (text.includes('용역') || text.includes('서비스') || text.includes('컨설팅') || text.includes('개발') || text.includes('시스템') || text.includes('구축')) return 'service';
    if (text.includes('공사') || text.includes('건설') || text.includes('신축') || text.includes('개보수')) return 'construction';
    if (text.includes('물품') || text.includes('구매') || text.includes('장비') || text.includes('납품')) return 'thing';
    return 'etc';
}

/**
 * 입찰공고 조회 (신규 통합 API)
 */
async function fetchBidsFromAPI(
    startDate: string,
    endDate: string,
    pageNo: number = 1,
    numOfRows: number = 100
): Promise<{ items: BidItem[]; totalCount: number }> {
    const params = new URLSearchParams({
        numOfRows: String(numOfRows),
        pageNo: String(pageNo),
        type: 'json',
        bidNtceBgnDt: startDate,
        bidNtceEndDt: endDate,
    });

    // serviceKey는 URLSearchParams에 넣으면 이중 인코딩되므로 직접 URL에 삽입
    const serviceKey = API_KEY_ENCODED || encodeURIComponent(API_KEY_DECODED);
    const url = `${BASE_URL}/getDataSetOpnStdBidPblancInfo?serviceKey=${serviceKey}&${params.toString()}`;

    console.log(`[G2B API Call] ${url.substring(0, 150)}...`);

    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 180 },
        signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[G2B API Error] ${response.status}: ${errorText.substring(0, 200)}`);
        throw new Error(`API 호출 실패: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();

    // 에러 응답 구조 처리
    const errorResponse = data['nkoneps.com.response.ResponseError'];
    if (errorResponse) {
        const errHeader = errorResponse.header;
        console.error(`[G2B API Error] resultCode: ${errHeader?.resultCode}, msg: ${errHeader?.resultMsg}`);
        throw new Error(`API 에러: ${errHeader?.resultMsg || '알 수 없는 에러'}`);
    }

    // 정상 응답 구조
    const header = data.response?.header;
    if (header?.resultCode !== '00') {
        console.error(`[G2B API Error] resultCode: ${header?.resultCode}, msg: ${header?.resultMsg}`);
        throw new Error(`API 에러: ${header?.resultMsg || '알 수 없는 에러'}`);
    }

    let rawItems = data.response?.body?.items || [];
    if (!Array.isArray(rawItems)) {
        rawItems = rawItems?.item || [];
        if (!Array.isArray(rawItems)) rawItems = [rawItems];
    }

    const items = rawItems.map((item: any) => {
        const category = classifyCategory(item.bidNtceNm || '', item.prdctClsfcNoNm || '');
        return toBidItem(item, category);
    });
    const totalCount = data.response?.body?.totalCount || 0;

    console.log(`[G2B API Result] ${items.length}건 / 전체 ${totalCount}건`);

    return { items, totalCount };
}

/**
 * 모든 입찰공고를 조회 (신규 통합 API)
 */
export async function fetchAllBids(
    startDate: string,
    endDate: string,
    pageNo: number = 1,
    numOfRows: number = 100,
    _categories?: BidItem['category'][]
): Promise<{ items: BidItem[]; totalCounts: Record<string, number> }> {
    try {
        const result = await fetchBidsFromAPI(startDate, endDate, pageNo, numOfRows);

        const totalCounts: Record<string, number> = {};
        for (const item of result.items) {
            totalCounts[item.category] = (totalCounts[item.category] || 0) + 1;
        }

        result.items.sort((a, b) => {
            const dateA = a.registDt || a.noticeDt || '';
            const dateB = b.registDt || b.noticeDt || '';
            return dateB.localeCompare(dateA);
        });

        return { items: result.items, totalCounts };
    } catch (error) {
        throw new Error(`API 호출이 실패했습니다: ${error}`);
    }
}

/**
 * 어제 등록된 AI 관련 공고만 추출 (슬랙 알림용)
 */
export async function fetchYesterdayAiBids(): Promise<BidItem[]> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate = formatDateForApi(yesterday, false);
    const endDate = formatDateForApi(yesterday, true);

    const { items } = await fetchAllBids(startDate, endDate, 1, 999);
    return items.filter(item => item.isAiRelated);
}

/**
 * 특정 시간 기준 최근 1시간 내 등록된 AI 관련 공고만 추출
 */
export async function fetchHourlyAiBids(nowDate: Date = new Date()): Promise<BidItem[]> {
    const y = nowDate.getFullYear();
    const m = String(nowDate.getMonth() + 1).padStart(2, '0');
    const d = String(nowDate.getDate()).padStart(2, '0');

    let targetHour = nowDate.getHours() - 1;
    const targetDate = new Date(nowDate);

    if (targetHour < 0) {
        targetHour = 23;
        targetDate.setDate(targetDate.getDate() - 1);
        const prevY = targetDate.getFullYear();
        const prevM = String(targetDate.getMonth() + 1).padStart(2, '0');
        const prevD = String(targetDate.getDate()).padStart(2, '0');

        const hStr = '23';
        const startDate = `${prevY}${prevM}${prevD}${hStr}00`;
        const endDate = `${prevY}${prevM}${prevD}${hStr}59`;
        const { items } = await fetchAllBids(startDate, endDate, 1, 100);
        return items.filter(item => item.isPriority);
    }

    const hStr = String(targetHour).padStart(2, '0');
    const startDate = `${y}${m}${d}${hStr}00`;
    const endDate = `${y}${m}${d}${hStr}59`;

    const { items } = await fetchAllBids(startDate, endDate, 1, 100);
    return items.filter(item => item.isPriority);
}

/**
 * 추정가격 포맷팅
 */
export function formatPrice(price?: string): string {
    if (!price) return '미정';
    const num = parseInt(price, 10);
    if (isNaN(num)) return price;
    if (num >= 100000000) {
        return `${(num / 100000000).toFixed(1)}억원`;
    }
    if (num >= 10000) {
        return `${(num / 10000).toFixed(0)}만원`;
    }
    return `${num.toLocaleString()}원`;
}

/**
 * 나라장터 공고 상세 페이지 URL 생성
 */
export function getBidDetailUrl(bidNtceNo: string, bidNtceOrd: string): string {
    return `https://www.g2b.go.kr/bid/ancmDtl.do?ancmId=${bidNtceNo}&ancmOrd=${bidNtceOrd}`;
}

// ─── G2B 어댑터 등록 ───
const g2bAdapter: SourceAdapter = {
    sourceId: 'g2b',
    sourceLabel: '나라장터',

    isAvailable(): boolean {
        return !!(API_KEY_ENCODED || API_KEY_DECODED);
    },

    async fetch(filter: SearchFilter): Promise<BidItem[]> {
        // G2B API는 최대 1개월(31일) 범위만 허용 → 오늘~+30일
        const now = new Date();
        const oneMonthLater = new Date();
        oneMonthLater.setDate(oneMonthLater.getDate() + 30);

        const startDate = formatDateForApi(now, false);
        const endDate = formatDateForApi(oneMonthLater, true);

        const { items } = await fetchAllBids(startDate, endDate, 1, 999);

        // 모집 중인 공고만 반환 (마감일 >= 오늘)
        const todayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        return items.filter(item => {
            if (!item.bidEndDt) return true;
            const endDt = item.bidEndDt.replace(/[^0-9]/g, '').substring(0, 8);
            if (!endDt || endDt.length < 8) return true;
            return endDt >= todayStr;
        });
    },
};

registerAdapter(g2bAdapter);
