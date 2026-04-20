/**
 * 소스 어댑터 인터페이스 및 레지스트리
 *
 * 각 공고 소스(나라장터, 기업마당, NIPA 등)를 추상화하여
 * 새로운 소스를 쉽게 추가할 수 있도록 Adapter Pattern을 사용합니다.
 *
 * 새 소스를 추가하려면:
 * 1. SourceAdapter 인터페이스를 구현하는 클래스를 만들고
 * 2. registerAdapter()로 등록하면 자동으로 통합 검색에 포함됩니다.
 */

import type { BidItem, SourceId, SearchFilter } from '@/types/bid';

// ─── 어댑터 인터페이스 ───
export interface SourceAdapter {
    /** 소스 식별자 */
    sourceId: SourceId;
    /** 소스 표시 이름 */
    sourceLabel: string;
    /** 데이터 조회. 실패 시 빈 배열 반환 (다른 소스 영향 없음) */
    fetch(filter: SearchFilter): Promise<BidItem[]>;
    /** 이 어댑터가 사용 가능한지 여부 (API 키 설정 여부 등) */
    isAvailable(): boolean;
}

// ─── 어댑터 레지스트리 ───
const adapters = new Map<SourceId, SourceAdapter>();

/** 어댑터를 레지스트리에 등록 */
export function registerAdapter(adapter: SourceAdapter): void {
    adapters.set(adapter.sourceId, adapter);
}

/** 등록된 모든 어댑터 가져오기 */
export function getAllAdapters(): SourceAdapter[] {
    return Array.from(adapters.values());
}

/** 특정 소스 어댑터 가져오기 */
export function getAdapter(sourceId: SourceId): SourceAdapter | undefined {
    return adapters.get(sourceId);
}

/** 사용 가능한 어댑터만 가져오기 */
export function getAvailableAdapters(): SourceAdapter[] {
    return getAllAdapters().filter(a => a.isAvailable());
}

// ─── 키워드 설정 (전체 소스 공통) ───

/** 🔴 우선순위 키워드 (자동 알림 트리거) */
export const PRIORITY_KEYWORDS = [
    'AI', '에이전트', '플랫폼', '금융', '생성형', '지능형',
];

/** 🟡 일반 AI 관련 키워드 (필터링용) */
export const AI_KEYWORDS = [
    ...PRIORITY_KEYWORDS,
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

/** AI 관련 공고인지 판별 */
export function isAiRelated(title: string): boolean {
    const upperTitle = title.toUpperCase();
    return AI_KEYWORDS.some(keyword => upperTitle.includes(keyword.toUpperCase()));
}

/** 우선순위 키워드에 매칭되는지 판별 */
export function matchPriorityKeywords(title: string): string[] {
    const upperTitle = title.toUpperCase();
    return PRIORITY_KEYWORDS.filter(keyword => upperTitle.includes(keyword.toUpperCase()));
}

/** 우선순위 공고인지 여부 */
export function isPriorityBid(title: string): boolean {
    return matchPriorityKeywords(title).length > 0;
}

/** 소스별 타임아웃 (ms) */
const SOURCE_TIMEOUT_MS: Record<string, number> = {
    g2b: 10000,     // 나라장터 API: 10초
    bizinfo: 8000,  // 기업마당 API: 8초
    nipa: 5000,     // 크롤러: 5초
    nia: 5000,
    mois: 5000,
    seoul: 5000,
};
const DEFAULT_TIMEOUT_MS = 8000;

/** 타임아웃 래퍼 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`[${label}] ${ms}ms 타임아웃`)), ms)
        ),
    ]);
}

/**
 * 멀티소스 통합 조회
 *
 * 지정된 소스들에서 병렬로 데이터를 가져오고,
 * 실패한 소스는 무시하고 성공한 결과만 합칩니다.
 * 각 소스에 개별 타임아웃을 적용하여 느린 소스가 전체를 지연시키지 않습니다.
 */
export async function fetchFromAllSources(
    filter: SearchFilter
): Promise<{
    items: BidItem[];
    sourceStats: Record<string, number>;
    errors: Record<string, string>;
}> {
    const targetSources = filter.sources.length > 0
        ? filter.sources
        : getAvailableAdapters().map(a => a.sourceId);

    const results = await Promise.allSettled(
        targetSources.map(async sourceId => {
            const adapter = getAdapter(sourceId);
            if (!adapter || !adapter.isAvailable()) {
                return { sourceId, items: [] as BidItem[] };
            }
            const timeout = SOURCE_TIMEOUT_MS[sourceId] || DEFAULT_TIMEOUT_MS;
            const items = await withTimeout(
                adapter.fetch(filter),
                timeout,
                adapter.sourceLabel
            );
            return { sourceId, items };
        })
    );

    const allItems: BidItem[] = [];
    const sourceStats: Record<string, number> = {};
    const errors: Record<string, string> = {};

    for (const result of results) {
        if (result.status === 'fulfilled') {
            const { sourceId, items } = result.value;
            allItems.push(...items);
            sourceStats[sourceId] = items.length;
        } else {
            const errorMsg = result.reason?.message || String(result.reason);
            console.warn(`[SourceAdapter] 부분 실패 (무시):`, errorMsg);
            errors['unknown'] = errorMsg;
        }
    }

    return { items: allItems, sourceStats, errors };
}
