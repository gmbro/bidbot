/**
 * 나라장터 입찰공고 API 유틸리티
 * 
 * data.go.kr의 조달청 나라장터 공공데이터개방표준서비스를 호출합니다.
 * 
 * API Endpoint: https://apis.data.go.kr/1230000/ao/PubDataOpnStdService
 * 
 * 주요 API:
 * - /getDataSetOpnStdBidPblancInfo (입찰공고정보 조회 - 통합)
 */

import type { BidItem, BidServiceItem, ApiResponse } from '@/types/bid';

const BASE_URL = process.env.DATA_GO_KR_BASE_URL || 'https://apis.data.go.kr/1230000/ao/PubDataOpnStdService';
// 인코딩 키를 우선 사용 (URLSearchParams 이중 인코딩 방지)
const API_KEY_ENCODED = process.env.DATA_GO_KR_API_KEY_ENCODED || '';
const API_KEY_DECODED = process.env.DATA_GO_KR_API_KEY || '';

// ─── 키워드 설정 ───
// 🔴 우선순위 키워드 (이 키워드가 포함되면 자동 알림 트리거)
export const PRIORITY_KEYWORDS = [
    'AI', '에이전트', '플랫폼', '금융', '생성형', '지능형',
];

// 🟡 일반 AI 관련 키워드 (필터링용, 알림은 안 감)
export const AI_KEYWORDS = [
    // 우선순위 키워드 포함
    ...PRIORITY_KEYWORDS,
    // 추가 AI/디지털 키워드
    '머신러닝', '기계학습', '딥러닝', '심층학습',
    '대규모언어모델', '자연어처리', 'NLP',
    '챗봇', '빅데이터', '빅 데이터',
    '데이터분석', '데이터 분석',
    '자율주행', '로봇', 'Robot',
    '컴퓨터비전', '영상분석', '음성인식',
    '지능형', '스마트',
    '클라우드', 'SaaS', 'DaaS',
    'IoT', '사물인터넷',
    'RPA', '디지털전환', '디지털 전환', 'DX',
    'XR', 'VR', 'AR', '메타버스',
    '블록체인', 'NFT',
];

/**
 * AI 관련 공고인지 판별
 */
export function isAiRelated(title: string): boolean {
    const upperTitle = title.toUpperCase();
    return AI_KEYWORDS.some(keyword => upperTitle.includes(keyword.toUpperCase()));
}

/**
 * 우선순위 키워드에 매칭되는지 판별 (자동 알림 대상)
 * @returns 매칭된 키워드 목록 (없으면 빈 배열)
 */
export function matchPriorityKeywords(title: string): string[] {
    const upperTitle = title.toUpperCase();
    return PRIORITY_KEYWORDS.filter(keyword => upperTitle.includes(keyword.toUpperCase()));
}

/**
 * 우선순위 공고인지 여부 (자동 알림 대상)
 */
export function isPriorityBid(title: string): boolean {
    return matchPriorityKeywords(title).length > 0;
}

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
    // "2026/03/04 15:00:00" 또는 "20260304" 형태 처리
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
 * 신규 PubDataOpnStdService API 필드명에 맞춰 매핑
 */
function toBidItem(item: any, category: BidItem['category']): BidItem {
    // 접수 시작/마감 날짜+시간 조합
    const bidStartDt = item.bidBeginDate && item.bidBeginTm
        ? `${item.bidBeginDate} ${item.bidBeginTm}`
        : (item.bidBeginDt || item.bidBeginDate || '');
    const bidEndDt = item.bidClseDate && item.bidClseTm
        ? `${item.bidClseDate} ${item.bidClseTm}`
        : (item.bidClseDt || item.bidClseDate || '');
    // 공고일시
    const noticeDt = item.bidNtceDate && item.bidNtceBgn
        ? `${item.bidNtceDate} ${item.bidNtceBgn}`
        : (item.ntceDt || item.bidNtceDate || '');

    return {
        id: `${item.bidNtceNo}-${item.bidNtceOrd}`,
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
    };
}

/**
 * 입찰공고 조회 (신규 통합 API)
 * 
 * PubDataOpnStdService/getDataSetOpnStdBidPblancInfo 엔드포인트 사용
 * 카테고리 구분 없이 통합 조회 후 클라이언트에서 분류
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

    console.log(`[API Call] ${url.substring(0, 150)}...`);

    const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        next: { revalidate: 300 }, // 5분 캐시
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[API Error] ${response.status}: ${errorText.substring(0, 200)}`);
        throw new Error(`API 호출 실패: ${response.status} - ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();

    // 응답 구조: response.header.resultCode / response.body.items
    const header = data.response?.header;
    if (header?.resultCode !== '00') {
        console.error(`[API Error] resultCode: ${header?.resultCode}, msg: ${header?.resultMsg}`);
        throw new Error(`API 에러: ${header?.resultMsg}`);
    }

    // items가 배열이 아닌 경우 처리
    let rawItems = data.response?.body?.items || [];
    if (!Array.isArray(rawItems)) {
        rawItems = rawItems?.item || [];
        if (!Array.isArray(rawItems)) rawItems = [rawItems];
    }

    // 업무구분에 따라 카테고리 분류
    const items = rawItems.map((item: any) => {
        const category = classifyCategory(item.bidNtceNm || '', item.prdctClsfcNoNm || '');
        return toBidItem(item, category);
    });
    const totalCount = data.response?.body?.totalCount || 0;

    console.log(`[API Result] ${items.length}건 / 전체 ${totalCount}건`);

    return { items, totalCount };
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

        // 카테고리별 통계 집계
        const totalCounts: Record<string, number> = {};
        for (const item of result.items) {
            totalCounts[item.category] = (totalCounts[item.category] || 0) + 1;
        }

        // 등록일시 기준 최신순 정렬
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
    // 나라장터 공고 상세 URL 패턴
    return `https://www.g2b.go.kr/bid/ancmDtl.do?ancmId=${bidNtceNo}&ancmOrd=${bidNtceOrd}`;
}
