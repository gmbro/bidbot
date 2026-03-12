/**
 * 입찰공고 조회 API Route
 * 
 * GET /api/bids?startDate=20260304&endDate=20260305&category=all&page=1&pageSize=20&aiOnly=false&keyword=
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllBids, isAiRelated, formatDateForApi } from '@/lib/bid-api';
import type { BidItem } from '@/types/bid';

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

    // 날짜 기본값: 오늘
    const today = new Date();
    const defaultStartDate = formatDateForApi(today, false);
    const defaultEndDate = formatDateForApi(today, true);

    const startDate = startDateParam ? `${startDateParam}0000` : defaultStartDate;
    const endDate = endDateParam ? `${endDateParam}2359` : defaultEndDate;

    try {
        // 카테고리 결정
        const categories: BidItem['category'][] =
            category === 'all'
                ? ['service', 'construction', 'thing', 'etc']
                : [category];

        // API 호출 (최대 999건)
        const { items: allItems, totalCounts } = await fetchAllBids(
            startDate,
            endDate,
            1,
            999,
            categories
        );

        // 필터링
        let filteredItems = allItems;

        // AI 관련만
        if (aiOnly) {
            filteredItems = filteredItems.filter(item => item.isAiRelated);
        }

        // 키워드 검색
        if (keyword) {
            const kw = keyword.toLowerCase();
            filteredItems = filteredItems.filter(item =>
                item.title.toLowerCase().includes(kw) ||
                item.organization.toLowerCase().includes(kw) ||
                item.demandOrg.toLowerCase().includes(kw)
            );
        }

        // 페이지네이션
        const totalItems = filteredItems.length;
        const totalPages = Math.ceil(totalItems / pageSize);
        const startIdx = (page - 1) * pageSize;
        const paginatedItems = filteredItems.slice(startIdx, startIdx + pageSize);

        // 통계
        const stats = {
            total: allItems.length,
            aiRelated: allItems.filter(i => i.isAiRelated).length,
            byCategory: totalCounts,
            filtered: totalItems,
        };

        return NextResponse.json({
            success: true,
            data: {
                items: paginatedItems,
                pagination: {
                    page,
                    pageSize,
                    totalItems,
                    totalPages,
                },
                stats,
                query: {
                    startDate: startDateParam || today.toISOString().slice(0, 10).replace(/-/g, ''),
                    endDate: endDateParam || today.toISOString().slice(0, 10).replace(/-/g, ''),
                    category,
                    aiOnly,
                    keyword,
                },
            },
        });

    } catch (error) {
        console.error('[API /api/bids] Error:', error);

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                message: 'API 키가 아직 활성화되지 않았거나, data.go.kr 서버에 문제가 있을 수 있습니다.',
            },
            { status: 500 }
        );
    }
}
