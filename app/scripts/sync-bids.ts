import { fetchAllBids, formatDateForApi } from '../src/lib/bid-api';
import type { BidItem } from '../src/types/bid';
import { loadVectorDB, saveVectorDB, generateEmbedding, type VectorItem } from '../src/lib/vector-db';

async function syncBids() {
    console.log('🔄 공고 데이터 6개월치(±3개월) 스크래핑 및 임베딩 생성 시작...');
    const now = new Date();
    const db = loadVectorDB();
    const existingIds = new Set(db.items.map(i => i.id));
    
    // -3개월부터 +3개월까지 1달 단위로 순회하여 데이터 긁기
    const itemsToEmbed: BidItem[] = [];

    for (let i = -3; i <= 2; i++) {
        const start = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 0); // 그 달의 마지막 날
        
        const startStr = formatDateForApi(start, false);
        const endStr = formatDateForApi(end, true);

        console.log(`[Sync] 조회 구간: ${startStr} ~ ${endStr}`);
        
        try {
            // 이번 달 데이터 추출 (최대 1000건)
            const { items } = await fetchAllBids(startStr, endStr, 1, 999);
            const aiItems = items.filter(b => b.isAiRelated);
            console.log(`  -> 추출 성공: 전체 ${items.length}건 중 AI 관련 ${aiItems.length}건`);
            
            aiItems.forEach(item => {
                const id = `${item.bidNtceNo}-${item.bidNtceOrd}`;
                if (!existingIds.has(id)) {
                    itemsToEmbed.push(item);
                    existingIds.add(id); // 중복 방지
                }
            });
        } catch (e) {
            console.error(`[Sync Error] ${startStr} 조회 실패:`, e);
        }
        
        // 조달청 API Rate Limit 방지용 대기
        await new Promise(r => setTimeout(r, 1000));
    }

    if (itemsToEmbed.length === 0) {
        console.log('✅ 신규로 추가할 공고가 없습니다.');
        return;
    }

    console.log(`🚀 총 ${itemsToEmbed.length}건의 신규 공고 임베딩(벡터 변환)을 시작합니다...`);
    
    // Gemini Embedding API Rate Limit (1500 per min) - 매우 넉넉하므로 일괄 처리
    let successCount = 0;
    for (let i = 0; i < itemsToEmbed.length; i++) {
        const item = itemsToEmbed[i];
        try {
            // "제목 + 카테고리 + 키워드" 조합을 벡터로 변환
            const docText = `${item.title} ${item.category} ${item.matchedKeywords.join(' ')} ${item.organization || ''}`;
            const embedding = await generateEmbedding(docText);
            
            db.items.push({
                id: `${item.bidNtceNo}-${item.bidNtceOrd}`,
                metadata: item,
                embedding
            });
            successCount++;
            
            if (successCount % 10 === 0) {
                console.log(`  ... 임베딩 진행 중: ${successCount} / ${itemsToEmbed.length}`);
            }
        } catch (e) {
            console.error(`  [Embed Error] ${item.title} 변환 실패:`, e);
            // Gemini 등 에러 감지 시 속도 조절
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    // 파일 시스템 저장
    saveVectorDB(db);
    console.log(`🎉 동기화 완료! DB에 총 ${db.items.length}건 저장됨.`);
}

syncBids().catch(console.error);
