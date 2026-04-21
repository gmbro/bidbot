/**
 * AI 뉴스 피드 API
 * GET /api/news
 */
import { NextResponse } from 'next/server';
import { crawlAiNews } from '@/lib/crawlers/news-crawler';

export const revalidate = 3600; // 1시간 캐시

export async function GET() {
    try {
        const news = await crawlAiNews();
        return NextResponse.json({ success: true, data: news });
    } catch (error) {
        console.error('[API /api/news] Error:', error);
        return NextResponse.json(
            { success: false, data: [], error: 'AI 뉴스를 불러오지 못했습니다.' },
            { status: 500 }
        );
    }
}
