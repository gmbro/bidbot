import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    // Vercel Cron은 자동으로 Authorization: Bearer <CRON_SECRET> 을 추가합니다.
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    try {
        // 내부 API 호출 시 절대 경로 구성
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
        const apiUrl = new URL('/api/slack-notify?type=cron', baseUrl);

        // POST 메서드로 슬랙 알림 라우트 호출
        const res = await fetch(apiUrl.toString(), {
            method: 'POST',
            cache: 'no-store'
        });

        const data = await res.json();
        return NextResponse.json({ success: true, message: 'Cron job executed successfully', result: data });
    } catch (error) {
        console.error('[Cron API Error]', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
