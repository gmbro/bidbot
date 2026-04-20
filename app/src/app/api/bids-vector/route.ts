import { NextRequest, NextResponse } from 'next/server';
import { searchSimilarBids } from '@/lib/vector-db';

export async function GET(request: NextRequest) {
    try {
        const query = request.nextUrl.searchParams.get('q') || '';
        if (!query) {
            return NextResponse.json({ success: true, items: [] });
        }

        console.log(`[Vector DB] 검색 요청: "${query}"`);
        // 코사인 유사도로 상위 30건 검색
        const results = await searchSimilarBids(query, 30);
        
        // 프론트의 BidItem 형식으로 반환
        return NextResponse.json({
            success: true,
            totalCounts: {}, // 통계 생략
            items: results.map(r => r.item),
        });
    } catch (error) {
        console.error('[Vector DB Error]', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
