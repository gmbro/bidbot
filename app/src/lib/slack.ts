/**
 * Slack Web API & Webhook 유틸리티
 * 
 * 두 가지 모드를 지원합니다:
 * 
 * 1. Bot Token 모드 (권장): chat.postMessage API로 쓰레드 지원
 *    - SLACK_BOT_TOKEN + SLACK_CHANNEL_ID 필요
 *    - 메인 메시지 → 개별 공고를 쓰레드 답글로
 * 
 * 2. Webhook 모드 (간단): 하나의 메시지로 전송
 *    - SLACK_WEBHOOK_URL만 필요
 *    - 쓰레드 미지원
 */

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID || '';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';

export type SlackMode = 'bot' | 'webhook' | 'none';

/**
 * 현재 사용 가능한 슬랙 모드 확인
 */
export function getSlackMode(): SlackMode {
    if (SLACK_BOT_TOKEN && SLACK_CHANNEL_ID) return 'bot';
    if (SLACK_WEBHOOK_URL) return 'webhook';
    return 'none';
}

/**
 * Slack Web API로 메시지 전송 (Bot Token 모드)
 * @returns 메시지의 ts (쓰레드 부모 식별용)
 */
export async function postSlackMessage(
    text: string,
    blocks?: any[],
    threadTs?: string,
): Promise<string | null> {
    if (!SLACK_BOT_TOKEN || !SLACK_CHANNEL_ID) {
        throw new Error('SLACK_BOT_TOKEN 또는 SLACK_CHANNEL_ID가 설정되지 않았습니다.');
    }

    // 유저 ID(U로 시작)이면 DM 채널을 먼저 열기
    let targetChannel = SLACK_CHANNEL_ID;
    if (SLACK_CHANNEL_ID.startsWith('U')) {
        const openRes = await fetch('https://slack.com/api/conversations.open', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
            },
            body: JSON.stringify({ users: SLACK_CHANNEL_ID }),
        });
        const openData = await openRes.json();
        if (!openData.ok) {
            console.error('[Slack DM Open Error]', openData.error);
            throw new Error(`Slack DM 열기 실패: ${openData.error}`);
        }
        targetChannel = openData.channel.id;
    }

    const body: any = {
        channel: targetChannel,
        text,
        unfurl_links: false,
        unfurl_media: false,
    };

    if (blocks) body.blocks = blocks;
    if (threadTs) body.thread_ts = threadTs;

    const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        },
        body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!data.ok) {
        console.error('[Slack API Error]', data.error, data.response_metadata);
        throw new Error(`Slack API 에러: ${data.error}`);
    }

    return data.ts || null; // 메시지 timestamp (쓰레드용)
}

/**
 * Slack Webhook으로 메시지 전송
 */
export async function postSlackWebhook(
    text: string,
    blocks?: any[],
): Promise<void> {
    if (!SLACK_WEBHOOK_URL) {
        throw new Error('SLACK_WEBHOOK_URL이 설정되지 않았습니다.');
    }

    const body: any = { text };
    if (blocks) body.blocks = blocks;

    const res = await fetch(SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Slack Webhook 에러: ${res.status} - ${errorText}`);
    }
}
