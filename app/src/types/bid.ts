/**
 * 나라장터 입찰공고 API 타입 정의
 */

// API 응답 기본 구조
export interface ApiResponse<T> {
    response: {
        header: {
            resultCode: string;
            resultMsg: string;
        };
        body: {
            items: T[];
            numOfRows: number;
            pageNo: number;
            totalCount: number;
        };
    };
}

// 용역 입찰공고 (Services)
export interface BidServiceItem {
    bidNtceNo: string;         // 입찰공고번호
    bidNtceOrd: string;        // 입찰공고차수
    ntceInsttNm: string;       // 공고기관명
    dminsttNm: string;         // 수요기관명
    bidNtceNm: string;         // 공고명
    ntceInsttCd: string;       // 공고기관코드
    dminsttCd: string;         // 수요기관코드
    bidMethdNm: string;        // 입찰방법명
    cntrctMthdNm: string;      // 계약방법명
    ntceDt: string;            // 공고일시
    bidBeginDt: string;        // 입찰개시일시
    bidClseDt: string;         // 입찰마감일시
    presnatnOprtnDt?: string;  // 설명회일시
    rbidPermsnYn: string;      // 재입찰허용여부
    presmptPrce?: string;      // 추정가격
    bidNtceDtlUrl?: string;    // 입찰공고상세URL
    rgstDt: string;            // 등록일시
    bfSpecRgstNo?: string;     // 사전규격등록번호
    sucBidMthdNm?: string;     // 낙찰방법명
    bidNtceUrl?: string;       // 입찰공고URL
    ntceKindNm?: string;       // 공고종류명 (입찰공고, 재공고 등)
    intrntnlDivNm?: string;    // 국제구분명
    refNo?: string;            // 참조번호
    bidNtceDtlUrl2?: string;   // 추가 URL
}

// 공사 입찰공고 (Construction)
export interface BidConstructionItem extends BidServiceItem {
    plnprc?: string;           // 설계금액
}

// 물품 입찰공고 (Things/Products)
export interface BidThingItem extends BidServiceItem {
    dlvrTmlmt?: string;        // 납품기한
}

// 기타 입찰공고
export interface BidEtcItem extends BidServiceItem { }

// 통합 입찰공고 아이템 (UI에서 사용)
export interface BidItem {
    id: string;                // bidNtceNo + bidNtceOrd
    bidNtceNo: string;         // 입찰공고번호
    bidNtceOrd: string;        // 입찰공고차수
    title: string;             // 공고명
    organization: string;      // 공고기관명
    demandOrg: string;         // 수요기관명
    noticeDt: string;          // 공고일시
    bidStartDt: string;        // 입찰개시일시
    bidEndDt: string;          // 입찰마감일시
    registDt: string;          // 등록일시
    bidMethod: string;         // 입찰방법
    contractMethod: string;    // 계약방법
    estimatedPrice?: string;   // 추정가격
    detailUrl?: string;        // 상세 URL
    category: 'service' | 'construction' | 'thing' | 'etc'; // 카테고리
    noticeKind?: string;       // 공고종류
    isAiRelated: boolean;      // AI 관련 여부
    isPriority: boolean;       // 🔴 우선순위 알림 대상 여부
    matchedKeywords: string[]; // 매칭된 우선순위 키워드 목록
}

// 검색 필터
export interface SearchFilter {
    startDate: string;         // 조회 시작일 (YYYYMMDD)
    endDate: string;           // 조회 종료일 (YYYYMMDD)
    keyword?: string;          // 키워드 검색
    category: 'all' | 'service' | 'construction' | 'thing' | 'etc';
    aiOnly: boolean;           // AI 관련만 표시
    page: number;
    pageSize: number;
}

// 슬랙 메시지
export interface SlackMessage {
    text: string;
    blocks?: SlackBlock[];
}

export interface SlackBlock {
    type: string;
    text?: {
        type: string;
        text: string;
        emoji?: boolean;
    };
    elements?: Array<{
        type: string;
        text?: string | { type: string; text: string };
        url?: string;
        action_id?: string;
    }>;
    fields?: Array<{
        type: string;
        text: string;
    }>;
}
