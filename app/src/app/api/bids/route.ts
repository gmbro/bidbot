/**
 * 통합 공고 조회 API Route
 *
 * GET /api/bids?startDate=20260304&endDate=20260305&category=all&page=1&pageSize=20&aiOnly=false&keyword=&sources=g2b,nipa,nia
 *
 * 나라장터, 기업마당, NIPA, NIA, 행안부, 부산시 등
 * 멀티소스에서 병렬로 데이터를 수집하여 통합 결과를 반환합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { formatDateForApi } from '@/lib/bid-api';
import type { BidItem, SourceId } from '@/types/bid';
import { fetchFromAllSources, isAiRelated } from '@/lib/source-adapter';
import { loadVectorDB } from '@/lib/vector-db';

// 어댑터 모듈 import (side-effect로 registerAdapter 호출)
import '@/lib/bid-api';
import '@/lib/bizinfo-api';
import '@/lib/crawlers/nipa-crawler';
import '@/lib/crawlers/mois-crawler';
import '@/lib/crawlers/seoul-crawler';

const ALL_SOURCES: SourceId[] = ['g2b', 'bizinfo', 'nipa', 'mois', 'seoul'];

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);

    // 파라미터 추출
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const category = (searchParams.get('category') || 'all') as 'all' | 'service' | 'construction' | 'thing' | 'etc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    const aiOnly = searchParams.get('aiOnly') === 'true';
    const keyword = searchParams.get('keyword') || '';
    const sourcesParam = searchParams.get('sources') || '';

    // 소스 파싱
    const sources: SourceId[] = sourcesParam
        ? sourcesParam.split(',').filter(s => ALL_SOURCES.includes(s as SourceId)) as SourceId[]
        : ALL_SOURCES;

    // 날짜 기본값
    const today = new Date();
    const defaultStartDate = formatDateForApi(today, false);
    const defaultEndDate = formatDateForApi(today, true);

    const startDate = startDateParam || today.toISOString().slice(0, 10).replace(/-/g, '');
    const endDate = endDateParam || today.toISOString().slice(0, 10).replace(/-/g, '');


    try {
        // 멀티소스 병렬 조회 (전체 수집)
        const { items: allItems, sourceStats, errors } = await fetchFromAllSources({
            startDate,
            endDate,
            category,
            aiOnly,
            keyword,
            page: 1,
            pageSize: 999,
            sources,
        });

        // ── 모집 중 필터: 마감일이 오늘 이후이거나 마감일이 없는 공고만 ──
        const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        let filteredItems = allItems.filter(item => {
            if (!item.bidEndDt) return true; // 마감일 미정은 포함
            const endDt = item.bidEndDt.replace(/[^0-9]/g, '').substring(0, 8);
            if (!endDt || endDt.length < 8) return true;
            return endDt >= todayStr; // 오늘 이후만
        });

        // 카테고리 필터
        if (category !== 'all') {
            filteredItems = filteredItems.filter(item => item.category === category);
        }

        // AI 관련만
        if (aiOnly) {
            filteredItems = filteredItems.filter(item => item.isAiRelated);
        }

        // 키워드 매칭 (OR 조건 + 유사도 점수 정렬)
        // 키워드 중 하나라도 포함되면 표시, 많이 매칭될수록 상위
        if (keyword) {
            const keywords = keyword.trim().split(/\s+/).filter(Boolean).map(k => k.toLowerCase());

            // 유사 키워드 확장 (클라우드 → SaaS, IaaS 등)
            const RELATED_KEYWORDS: Record<string, string[]> = {
                '클라우드': ['cloud', 'saas', 'iaas', 'paas', '클라우드'],
                'ai': ['인공지능', 'ai', '머신러닝', '딥러닝', '지능형'],
                '생성형ai': ['생성형', 'llm', 'gpt', '대규모언어', '생성ai'],
                '플랫폼': ['플랫폼', 'platform', '포털', '시스템구축'],
                '에이전트': ['에이전트', 'agent', '자동화', 'rpa'],
                '데이터': ['데이터', 'data', '빅데이터', '데이터분석'],
                '지능형': ['지능형', '스마트', 'ict', '디지털'],
                '디지털전환': ['디지털전환', 'dx', '디지털 전환', '정보화'],
            };

            // 확장 키워드 생성
            const expandedKeywords = new Set<string>(keywords);
            keywords.forEach(kw => {
                const related = RELATED_KEYWORDS[kw];
                if (related) related.forEach(r => expandedKeywords.add(r));
            });
            const allKws = Array.from(expandedKeywords);

            // 유사도 점수 부여
            const scored = filteredItems.map(item => {
                const searchText = `${item.title} ${item.organization} ${item.demandOrg} ${item.description || ''} ${item.sourceLabel || ''}`.toLowerCase();
                let score = 0;
                // 원본 키워드 정확 매칭: 10점
                keywords.forEach(kw => { if (searchText.includes(kw)) score += 10; });
                // 확장 키워드 매칭: 3점
                allKws.forEach(kw => { if (searchText.includes(kw)) score += 3; });
                // AI 관련이면 보너스
                if (item.isAiRelated) score += 2;
                // 소스 API에서 이미 키워드로 검색한 결과(bizinfo 등)는 최소 1점 보장
                if (score === 0 && (item.source === 'bizinfo')) score = 1;
                return { item, score };
            });

            // 점수 > 0인 것만 필터 (하나라도 매칭)
            const matched = scored.filter(s => s.score > 0);

            if (matched.length > 0) {
                // 점수 높은 순 → 최신순
                matched.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    const dateA = a.item.registDt || a.item.noticeDt || '';
                    const dateB = b.item.registDt || b.item.noticeDt || '';
                    return dateB.localeCompare(dateA);
                });
                filteredItems = matched.map(s => s.item);
            } else {
                // 키워드 매칭 0건이면 빈 결과 반환 (무관한 공고 표시 방지)
                filteredItems = [];
            }
        } else {
            // 키워드 없으면 최신순
            filteredItems.sort((a, b) => {
                const dateA = a.registDt || a.noticeDt || '';
                const dateB = b.registDt || b.noticeDt || '';
                return dateB.localeCompare(dateA);
            });
        }

        // 페이지네이션
        const totalItems = filteredItems.length;
        const totalPages = Math.ceil(totalItems / pageSize);
        const startIdx = (page - 1) * pageSize;
        const paginatedItems = filteredItems.slice(startIdx, startIdx + pageSize);

        // 통계
        const byCategory: Record<string, number> = {};
        for (const item of allItems) {
            byCategory[item.category] = (byCategory[item.category] || 0) + 1;
        }

        const stats = {
            total: allItems.length,
            aiRelated: allItems.filter(i => i.isAiRelated).length,
            byCategory,
            filtered: totalItems,
            bySource: sourceStats,
        };

        return NextResponse.json({
            success: true,
            data: {
                items: paginatedItems,
                pagination: { page, pageSize, totalItems, totalPages },
                stats,
                query: {
                    startDate: startDateParam || today.toISOString().slice(0, 10).replace(/-/g, ''),
                    endDate: endDateParam || today.toISOString().slice(0, 10).replace(/-/g, ''),
                    category,
                    aiOnly,
                    keyword,
                    sources,
                },
                errors: Object.keys(errors).length > 0 ? errors : undefined,
            },
        });

    } catch (error) {
        console.error('[API /api/bids] Multi-source fetch error, fallback to local DB:', error);

        try {
            // 로컬 벡터 DB 폴백
            const db = loadVectorDB();
            let localItems = db.items.map(v => ({
                ...v.metadata,
                source: (v.metadata as any).source || 'g2b' as SourceId,
                sourceLabel: (v.metadata as any).sourceLabel || '나라장터',
            }));

            // 날짜 필터
            localItems = localItems.filter(item => {
                const dt = (item.registDt || item.noticeDt || '').replace(/[^0-9]/g, '');
                if (!dt) return true;
                const d = dt.substring(0, 8);
                const s = (startDateParam || '').substring(0, 8);
                const e = (endDateParam || '99999999').substring(0, 8);
                return d >= s && d <= e;
            });

            if (category !== 'all') {
                localItems = localItems.filter(item => item.category === category);
            }
            if (aiOnly) {
                localItems = localItems.filter(item => item.isAiRelated);
            }
            if (keyword) {
                const keywords = keyword.trim().split(/\s+/).filter(Boolean).map(k => k.toLowerCase());
                localItems = localItems.filter(item => {
                    const searchText = `${item.title} ${item.organization} ${item.demandOrg}`.toLowerCase();
                    return keywords.every(kw => searchText.includes(kw));
                });
            }

            localItems.sort((a, b) => {
                const dateA = a.registDt || a.noticeDt || '';
                const dateB = b.registDt || b.noticeDt || '';
                return dateB.localeCompare(dateA);
            });

            const totalItems = localItems.length;
            const totalPages = Math.ceil(totalItems / pageSize);
            const startIdx = (page - 1) * pageSize;
            const paginatedItems = localItems.slice(startIdx, startIdx + pageSize);

            return NextResponse.json({
                success: true,
                data: {
                    items: paginatedItems,
                    pagination: { page, pageSize, totalItems, totalPages },
                    stats: { total: totalItems, aiRelated: totalItems, byCategory: {}, filtered: totalItems, bySource: {} },
                    query: { startDate: startDateParam || '', endDate: endDateParam || '', category, aiOnly, keyword, sources },
                },
            });
        } catch (dbError) {
            return NextResponse.json(
                {
                    success: false,
                    error: String(error),
                    message: 'API 및 로컬 DB 호출에 모두 실패했습니다.',
                },
                { status: 500 }
            );
        }
    }
}
