import fs from 'fs';
import path from 'path';
import type { BidItem } from '@/types/bid';

const DATA_DIR = path.join(process.cwd(), 'data');
const VECTOR_DB_PATH = path.join(DATA_DIR, 'bids-vector.json');

export interface VectorItem {
    id: string; // bidNtceNo-bidNtceOrd
    metadata: BidItem;
    embedding: number[];
}

export interface VectorDB {
    items: VectorItem[];
    lastUpdated: string;
}

// 초기화
function initDB() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(VECTOR_DB_PATH)) {
        const initial: VectorDB = { items: [], lastUpdated: new Date().toISOString() };
        fs.writeFileSync(VECTOR_DB_PATH, JSON.stringify(initial), 'utf8');
    }
}

export function loadVectorDB(): VectorDB {
    initDB();
    const data = fs.readFileSync(VECTOR_DB_PATH, 'utf8');
    return JSON.parse(data);
}

export function saveVectorDB(db: VectorDB) {
    db.lastUpdated = new Date().toISOString();
    fs.writeFileSync(VECTOR_DB_PATH, JSON.stringify(db), 'utf8');
}

/** 코사인 유사도 계산기 */
function cosineSimilarity(A: number[], B: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < A.length; i++) {
        dotProduct += A[i] * B[i];
        normA += A[i] * A[i];
        normB += B[i] * B[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** 텍스트 임베딩 생성 (Gemini) */
export async function generateEmbedding(text: string): Promise<number[]> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY is not configured');

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: "models/text-embedding-004",
            content: { parts: [{ text }] }
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(`Embedding API Error: ${err.error?.message || res.status}`);
    }

    const data = await res.json();
    return data.embedding.values;
}

/** 유사 공고 검색 */
export async function searchSimilarBids(query: string, topK: number = 20): Promise<{ item: BidItem, score: number }[]> {
    const db = loadVectorDB();
    if (db.items.length === 0) return [];

    const queryEmbedding = await generateEmbedding(query);

    const scored = db.items.map(v => ({
        item: v.metadata,
        score: cosineSimilarity(queryEmbedding, v.embedding)
    }));

    // 높은 점수순 정렬
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
}
