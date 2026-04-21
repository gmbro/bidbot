/**
 * AI 뉴스 크롤러
 *
 * 소스: AI타임스 (aitimes.com) — AI 산업/정책 뉴스
 *
 * 실제 HTML 구조:
 * <a href="https://www.aitimes.com/news/articleView.html?idxno=209252" target="_top">
 *   <DIV class="auto-titles line-x2 onload">기사 제목</DIV>
 * </a>
 */

export interface NewsItem {
    id: string;
    title: string;
    url: string;
    source: string;
    sourceLabel: string;
    date: string;
}

const NEWS_SOURCES = [
    {
        id: 'aitimes-biz',
        label: 'AI타임스',
        url: 'https://www.aitimes.com/news/articleList.html?sc_section_code=S1N4&view_type=sm',
    },
    {
        id: 'aitimes-policy',
        label: 'AI타임스',
        url: 'https://www.aitimes.com/news/articleList.html?sc_section_code=S1N25&view_type=sm',
    },
];

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

export async function crawlAiNews(): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];
    const seen = new Set<string>();

    for (const source of NEWS_SOURCES) {
        try {
            console.log(`[News Crawler] ${source.id} 크롤링...`);

            const response = await fetch(source.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html',
                    'Accept-Language': 'ko-KR,ko;q=0.9',
                },
                next: { revalidate: 3600 },
            });

            if (!response.ok) continue;
            const html = await response.text();

            // 패턴: <a href="...articleView...idxno=XXXXX"...><DIV class="auto-titles...">제목</DIV></a>
            // DIV가 대문자일 수 있으므로 case-insensitive
            const pattern = /<a\s+href="([^"]*articleView[^"]*idxno=(\d+)[^"]*)"[^>]*>\s*<(?:div|DIV|span)[^>]*class="auto-titles[^"]*"[^>]*>([\s\S]*?)<\/(?:div|DIV|span)>/gi;

            let match;
            while ((match = pattern.exec(html)) !== null) {
                const url = match[1];
                const idxno = match[2];
                const title = stripHtml(match[3]);

                if (!title || title.length < 5) continue;
                if (seen.has(idxno)) continue;
                seen.add(idxno);

                allItems.push({
                    id: `news-${idxno}`,
                    title,
                    url: url.startsWith('http') ? url : `https://www.aitimes.com${url}`,
                    source: source.id,
                    sourceLabel: source.label,
                    date: '',
                });
            }

        } catch (error) {
            console.error(`[News Crawler] ${source.id} 실패:`, error);
        }
    }

    console.log(`[News Crawler] 총 ${allItems.length}건 수집`);
    return allItems.slice(0, 15);
}
