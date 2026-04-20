'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { BidItem, SourceId } from '@/types/bid';
import { SOURCE_REGISTRY } from '@/types/bid';

// ─── 상수 ───

const CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  service: '용역',
  construction: '공사',
  thing: '물품',
  etc: '기타',
};

const CATEGORY_ICONS: Record<string, string> = {
  service: '🔧',
  construction: '🏗️',
  thing: '📦',
  etc: '📄',
};

const KEYWORD_CHIPS = ['클라우드', 'AI', '생성형AI', '플랫폼', '에이전트', '데이터', '지능형', '디지털전환'];

const ALL_SOURCES: SourceId[] = ['g2b', 'bizinfo', 'nipa', 'mois', 'seoul'];

// ─── 유틸리티 함수 ───

function formatDisplayDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) return '-';
  const cleaned = dateStr.replace(/[^0-9]/g, '');
  if (cleaned.length >= 12) {
    return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 6)}.${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}:${cleaned.slice(10, 12)}`;
  }
  if (cleaned.length >= 8) {
    return `${cleaned.slice(0, 4)}.${cleaned.slice(4, 6)}.${cleaned.slice(6, 8)}`;
  }
  return dateStr;
}

function formatPrice(price?: string): string {
  if (!price) return '-';
  const num = parseInt(price, 10);
  if (isNaN(num)) return price;
  if (num >= 100000000) return `${(num / 100000000).toFixed(1)}억원`;
  if (num >= 10000) return `${Math.floor(num / 10000).toLocaleString()}만원`;
  return `${num.toLocaleString()}원`;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function getDateMonthsAhead(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateInput(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function parseDateInput(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

function getDaysLeftLabel(bidEndDt: string): { text: string; color: string } {
  if (!bidEndDt) return { text: '기한 미정', color: 'var(--text-muted)' };
  const cleaned = bidEndDt.replace(/[^0-9]/g, '');
  if (cleaned.length < 8) return { text: '기한 미정', color: 'var(--text-muted)' };
  const endDate = new Date(
    parseInt(cleaned.slice(0, 4)),
    parseInt(cleaned.slice(4, 6)) - 1,
    parseInt(cleaned.slice(6, 8))
  );
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { text: '마감', color: '#ef4444' };
  if (days === 0) return { text: 'D-Day', color: '#ef4444' };
  if (days <= 3) return { text: `D-${days}`, color: '#f59e0b' };
  if (days <= 7) return { text: `D-${days}`, color: '#3b82f6' };
  return { text: `D-${days}`, color: 'var(--text-secondary)' };
}

// ─── 메인 컴포넌트 ───

interface FetchResult {
  items: BidItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  stats: { total: number; aiRelated: number; byCategory: Record<string, number>; filtered: number; bySource?: Record<string, number> };
  query: { startDate: string; endDate: string; category: string; aiOnly: boolean; keyword: string; sources: SourceId[] };
}

export default function HomePage() {
  const [items, setItems] = useState<BidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  // 필터
  const [startDate] = useState(getToday());
  const [endDate] = useState(getDateMonthsAhead(3));
  const [category] = useState<string>('all');
  const [aiOnly] = useState(false);
  const [keyword, setKeyword] = useState('AI');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 소스 선택 (기본: 전체)
  const [activeSources, setActiveSources] = useState<SourceId[]>([]);
  const [activeSourceTab, setActiveSourceTab] = useState<'all' | SourceId>('all');

  // debounce ref
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // 검색창 텍스트에서 활성 칩 동기화
  const syncedChips = useMemo(() => {
    const words = keyword.toLowerCase().split(/\s+/).filter(Boolean);
    const chips = new Set<string>();
    KEYWORD_CHIPS.forEach(chip => {
      if (words.includes(chip.toLowerCase())) chips.add(chip);
    });
    return chips;
  }, [keyword]);

  // 통계
  const [stats, setStats] = useState({
    total: 0,
    aiRelated: 0,
    byCategory: {} as Record<string, number>,
    filtered: 0,
    bySource: {} as Record<string, number>,
  });
  const [totalPages, setTotalPages] = useState(1);

  // 모달
  const [selectedItem, setSelectedItem] = useState<BidItem | null>(null);

  // 토스트
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 슬랙 전송 중
  const [sendingSlack, setSendingSlack] = useState(false);

  // 작성 팁 상태
  const [draftItem, setDraftItem] = useState<BidItem | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftContent, setDraftContent] = useState<string>('');
  const [draftError, setDraftError] = useState<string | null>(null);

  // 기간 상태 제거됨 (항상 오늘~3개월 후)

  // 유사 검색 상태 (0건일 때 자동 완화 검색)
  const [fallbackItems, setFallbackItems] = useState<BidItem[]>([]);
  const [isFallback, setIsFallback] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBids = async () => {
    setLoading(true);
    setError(null);
    setIsDemo(false);

    try {
      const sourcesToFetch = activeSourceTab === 'all' ? '' : activeSourceTab;
      const params = new URLSearchParams({
        startDate,
        endDate,
        category,
        aiOnly: String(aiOnly),
        keyword,
        page: String(page),
        pageSize: String(pageSize),
        sources: sourcesToFetch,
      });

      const res = await fetch(`/api/bids?${params}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || data.message);
      }

      // 중복 제거 (동일 제목 공고)
      const seen = new Set<string>();
      const uniqueItems = data.data.items.filter((item: BidItem) => {
        const key = item.title.trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setItems(uniqueItems);
      setStats({ ...data.data.stats, filtered: uniqueItems.length });
      setTotalPages(data.data.pagination.totalPages);

      // 결과 0건이고 키워드가 있으면 → 키워드 완화(OR) 재검색
      if (data.data.items.length === 0 && keyword.trim()) {
        console.log('[Fallback] 키워드 완화 재검색 시도...');
        const fallbackParams = new URLSearchParams({
          startDate,
          endDate,
          category,
          aiOnly: String(aiOnly),
          keyword: '',  // 키워드 없이 전체 검색
          page: '1',
          pageSize: '20',
          sources: sourcesToFetch,
        });
        try {
          const fbRes = await fetch(`/api/bids?${fallbackParams}`);
          const fbData = await fbRes.json();
          if (fbData.success && fbData.data.items.length > 0) {
            // 키워드 단어 중 하나라도 포함된 것을 우선 + 나머지도 표시
            const keywords = keyword.trim().split(/\s+/).filter(Boolean).map(k => k.toLowerCase());
            const scored = fbData.data.items.map((item: BidItem) => {
              const text = `${item.title} ${item.organization} ${item.demandOrg} ${item.description || ''}`.toLowerCase();
              const score = keywords.reduce((acc: number, kw: string) => acc + (text.includes(kw) ? 10 : 0), 0);
              return { item, score };
            });
            scored.sort((a: {score: number}, b: {score: number}) => b.score - a.score);
            setFallbackItems(scored.slice(0, 20).map((s: {item: BidItem}) => s.item));
            setIsFallback(true);
          } else {
            setFallbackItems([]);
            setIsFallback(false);
          }
        } catch {
          setFallbackItems([]);
          setIsFallback(false);
        }
      } else {
        setFallbackItems([]);
        setIsFallback(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 에러';
      console.warn('Fetch fallback triggered:', errorMsg);
      setError(errorMsg);
      setIsDemo(true);
      setItems([]);
      setFallbackItems([]);
      setIsFallback(false);
      setStats({ total: 0, aiRelated: 0, byCategory: {}, filtered: 0, bySource: {} });
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // 모든 필터 상태 변경 시 debounce 검색 수행
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchBids();
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, category, aiOnly, page, keyword, activeSourceTab]);

  const handleSearch = () => {
    setPage(1);
  };

  const handleKeywordChipClick = (kw: string) => {
    setKeyword(prev => {
      const words = prev.trim().split(/\s+/).filter(Boolean);
      const kwLower = kw.toLowerCase();
      const idx = words.findIndex(w => w.toLowerCase() === kwLower);
      if (idx >= 0) {
        words.splice(idx, 1);
      } else {
        words.push(kw);
      }
      return words.join(' ');
    });
    setPage(1);
  };

  const handleSourceTabClick = (source: 'all' | SourceId) => {
    setActiveSourceTab(source);
    setPage(1);
  };

  const sendSlackNotification = async () => {
    setSendingSlack(true);
    try {
      const res = await fetch('/api/slack-notify', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ 슬랙 전송 완료! (${data.itemCount}건)`, 'success');
      } else {
        showToast(`❌ ${data.error}`, 'error');
      }
    } catch {
      showToast('❌ 슬랙 전송 실패', 'error');
    } finally {
      setSendingSlack(false);
    }
  };

  const openDraftModal = (item: BidItem) => {
    setDraftItem(item);
    setDraftContent('');
    setDraftError(null);
    setDraftLoading(false);
    setSelectedItem(null);
  };

  const handleGenerateDraft = async () => {
    if (!draftItem) return;
    setDraftLoading(true);
    setDraftError(null);

    try {
      const res = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftItem.title,
          organization: draftItem.organization || '',
          demandOrg: draftItem.demandOrg || '',
          bidMethod: draftItem.bidMethod || '',
          contractMethod: draftItem.contractMethod || '',
          estimatedPrice: draftItem.estimatedPrice ? formatPrice(draftItem.estimatedPrice) : '',
          bidEndDt: draftItem.bidEndDt ? formatDisplayDate(draftItem.bidEndDt) : '',
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setDraftContent(data.draft);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '작성 팁 생성에 실패했습니다';
      setDraftError(errorMsg);
    } finally {
      setDraftLoading(false);
    }
  };

  const closeDraftModal = () => {
    setDraftItem(null);
    setDraftContent('');
    setDraftError(null);
    setDraftLoading(false);
  };

  // 소스 정보 헬퍼
  const getSourceInfo = (sourceId: string) => SOURCE_REGISTRY[sourceId as SourceId] || { icon: '📄', label: sourceId, color: '#64748b' };

  return (
    <div className="app-container">
      {/* ═══ Header ═══ */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '20px 0 24px',
        borderBottom: '1px solid var(--border)',
        marginBottom: 24,
      }}>
        <div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            background: 'var(--gradient-primary)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 4,
          }}>
            📡 공공사업 통합 모니터
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            나라장터 · 기업마당 · NIPA · 행안부 · 서울AI 공고 통합 추적
          </p>
        </div>
        <button
          className="btn btn-slack btn-sm"
          onClick={sendSlackNotification}
          disabled={sendingSlack}
        >
          {sendingSlack ? '⏳ 전송 중...' : '💬 슬랙 알림'}
        </button>
      </header>

      {/* ═══ 에러/데모 알림 ═══ */}
      {isDemo && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 10,
          marginBottom: 20,
          fontSize: '0.85rem',
          color: '#92400e',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}>
          <span>⚠️</span>
          <span>일부 소스 연결 실패 — {error || 'API 키 미설정'}</span>
        </div>
      )}

      {/* ═══ 소스 탭 ═══ */}
      <div className="source-tabs">
        <button
          className={`source-tab ${activeSourceTab === 'all' ? 'active' : ''}`}
          onClick={() => handleSourceTabClick('all')}
        >
          📡 전체
          {stats.total > 0 && <span className="source-count">{stats.total}</span>}
        </button>
        {ALL_SOURCES.map(sourceId => {
          const info = SOURCE_REGISTRY[sourceId];
          const count = stats.bySource?.[sourceId] || 0;
          return (
            <button
              key={sourceId}
              className={`source-tab ${activeSourceTab === sourceId ? 'active' : ''}`}
              onClick={() => handleSourceTabClick(sourceId)}
            >
              {info.icon} {info.label}
              {count > 0 && <span className="source-count">{count}</span>}
            </button>
          );
        })}
      </div>





      {/* ═══ 필터 영역 (검색 + 키워드 칩만) ═══ */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {/* 검색 */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <span style={{ position: 'absolute', left: 12, fontSize: '0.85rem', opacity: 0.4, pointerEvents: 'none' }}>🔍</span>
            <input
              type="text"
              placeholder="공고명, 기관명, 키워드 검색..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                width: '100%',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 36px 8px 36px',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {keyword && (
              <button
                onClick={() => { setKeyword(''); setPage(1); }}
                style={{
                  position: 'absolute', right: 8,
                  width: 20, height: 20,
                  border: 'none', borderRadius: '50%',
                  background: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '0.65rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            📅 오늘~3개월 후 공고 중
          </div>
        </div>

        {/* 키워드 필터 칩 */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {KEYWORD_CHIPS.map((kw) => (
            <button
              key={kw}
              onClick={() => handleKeywordChipClick(kw)}
              style={{
                padding: '5px 12px',
                border: `1px solid ${syncedChips.has(kw) ? '#8b5cf6' : 'var(--border)'}`,
                borderRadius: 20,
                fontSize: '0.78rem',
                fontWeight: syncedChips.has(kw) ? 600 : 500,
                color: syncedChips.has(kw) ? '#8b5cf6' : 'var(--text-muted)',
                background: syncedChips.has(kw) ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              #{kw}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ 결과 헤더 ═══ */}
      {!loading && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}>
          <span>
            검색결과 <strong style={{ color: 'var(--text-primary)' }}>{stats.filtered}</strong>건
            {keyword && <span> · &quot;{keyword}&quot;</span>}
            {activeSourceTab !== 'all' && (
              <span> · {SOURCE_REGISTRY[activeSourceTab]?.icon} {SOURCE_REGISTRY[activeSourceTab]?.label}</span>
            )}
          </span>
          {totalPages > 1 && <span>{page} / {totalPages} 페이지</span>}
        </div>
      )}

      {/* ═══ 결과 목록 ═══ */}
      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 20px',
          gap: 12,
        }}>
          <div className="spinner" />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>공고를 불러오는 중...</p>
        </div>
      ) : items.length === 0 ? (
        <div>
          {/* 유사 결과가 있으면 보여주기 */}
          {isFallback && fallbackItems.length > 0 ? (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 16px',
                marginBottom: 12,
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
                borderRadius: 10,
                border: '1px solid rgba(99,102,241,0.15)',
              }}>
                <span style={{ fontSize: '1.2rem' }}>🔍</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <strong>&quot;{keyword}&quot;</strong> 정확 매칭 결과가 없어, <strong>유사 공고 {fallbackItems.length}건</strong>을 표시합니다
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {KEYWORD_CHIPS.filter(kw => !keyword.toLowerCase().includes(kw.toLowerCase())).slice(0, 5).map(kw => (
                  <button
                    key={kw}
                    onClick={() => { setKeyword(kw); setPage(1); }}
                    style={{
                      padding: '4px 12px',
                      fontSize: '0.8rem',
                      borderRadius: 20,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    #{kw} 로 검색
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {fallbackItems.map((item) => {
                  const daysLeft = getDaysLeftLabel(item.bidEndDt);
                  const srcInfo = getSourceInfo(item.source);
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      style={{
                        background: 'var(--bg-card)',
                        border: `1px solid var(--border)`,
                        borderLeft: `3px solid ${srcInfo.color}`,
                        borderRadius: 10,
                        padding: '14px 18px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        opacity: 0.85,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)';
                        (e.currentTarget as HTMLElement).style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = '';
                        (e.currentTarget as HTMLElement).style.opacity = '0.85';
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{
                              fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4,
                              background: srcInfo.color + '18', color: srcInfo.color, fontWeight: 600,
                            }}>
                              {srcInfo.icon} {srcInfo.label}
                            </span>
                            {item.isPriority && <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', fontWeight: 600 }}>⭐ 우선</span>}
                          </div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                            {item.title || '제목 없음'}
                          </h4>
                          <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                            <span>🏛️ {item.organization || '-'}</span>
                            <span>📅 {formatDisplayDate(item.noticeDt || item.registDt || '')}</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: daysLeft.color, whiteSpace: 'nowrap' }}>
                          {daysLeft.text}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--text-muted)',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
              <h3 style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>공고를 검색 중입니다</h3>
              <p style={{ fontSize: '0.9rem', marginBottom: 16 }}>날짜 범위를 넓히거나 다른 키워드를 선택해보세요.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                {KEYWORD_CHIPS.slice(0, 6).map(kw => (
                  <button
                    key={kw}
                    onClick={() => { setKeyword(kw); setPage(1); }}
                    style={{
                      padding: '6px 14px',
                      fontSize: '0.85rem',
                      borderRadius: 20,
                      border: '1px solid rgba(99,102,241,0.3)',
                      background: 'rgba(99,102,241,0.06)',
                      color: '#6366f1',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    #{kw}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item) => {
              const daysLeft = getDaysLeftLabel(item.bidEndDt);
              const srcInfo = getSourceInfo(item.source);
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${item.isPriority ? 'rgba(139, 92, 246, 0.3)' : 'var(--border)'}`,
                    borderLeft: item.isAiRelated ? `3px solid ${srcInfo.color}` : '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '14px 18px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = '';
                    (e.currentTarget as HTMLElement).style.boxShadow = '';
                  }}
                >
                  {/* 제목 + D-day */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <a
                        href={item.detailUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: '0.95rem',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          textDecoration: 'none',
                          lineHeight: 1.4,
                        }}
                      >
                        {item.title}
                      </a>
                    </div>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: daysLeft.color,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: daysLeft.text === '마감' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    }}>
                      {daysLeft.text}
                    </span>
                  </div>

                  {/* 메타 정보 */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px 16px',
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    alignItems: 'center',
                  }}>
                    {/* 소스 뱃지 */}
                    <span className={`source-badge source-badge-${item.source}`}>
                      {srcInfo.icon} {srcInfo.label}
                    </span>
                    <span>{CATEGORY_ICONS[item.category] || '📄'} {CATEGORY_LABELS[item.category]}</span>
                    <span>🏢 {item.organization || '미공개'}</span>
                    <span>📅 {formatDisplayDate(item.bidEndDt) || '-'}</span>
                    {item.estimatedPrice && <span>💰 {formatPrice(item.estimatedPrice)}</span>}
                    {item.isPriority && <span style={{ color: '#ef4444', fontWeight: 600 }}>🔴 우선</span>}
                    {item.matchedKeywords.length > 0 && (
                      <span style={{ display: 'flex', gap: 4 }}>
                        {item.matchedKeywords.map(kw => (
                          <span
                            key={kw}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleKeywordChipClick(kw);
                            }}
                            style={{
                              padding: '1px 8px',
                              borderRadius: 12,
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: '#8b5cf6',
                              background: 'rgba(139, 92, 246, 0.1)',
                              cursor: 'pointer',
                            }}
                          >
                            {kw}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              marginTop: 24,
              padding: 12,
            }}>
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ‹
              </button>
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`page-btn ${page === p ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              {totalPages > 10 && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>...</span>}
              <button
                className="page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                ›
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══ Detail Modal ═══ */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedItem(null)}>✕</button>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {/* 소스 뱃지 */}
              <span className={`source-badge source-badge-${selectedItem.source}`}>
                {getSourceInfo(selectedItem.source).icon} {selectedItem.sourceLabel}
              </span>
              {selectedItem.isPriority && <span className="badge badge-priority">🔴 우선 공고</span>}
              {selectedItem.isAiRelated && <span className="badge badge-ai">🤖 AI</span>}
              <span className={`badge badge-${selectedItem.category === 'service' ? 'service' : selectedItem.category === 'construction' ? 'construction' : selectedItem.category === 'thing' ? 'thing' : 'etc'}`}>
                {CATEGORY_LABELS[selectedItem.category]}
              </span>
              {selectedItem.matchedKeywords.length > 0 && (
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {selectedItem.matchedKeywords.map(kw => (
                    <span
                      key={kw}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleKeywordChipClick(kw);
                        setSelectedItem(null);
                      }}
                      style={{
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#8b5cf6',
                        background: 'rgba(139, 92, 246, 0.1)',
                        cursor: 'pointer',
                      }}
                    >
                      {kw}
                    </span>
                  ))}
                </span>
              )}
            </div>

            <h2 className="modal-title">{selectedItem.title}</h2>

            <div className="detail-grid">
              {selectedItem.bidNtceNo && (
                <>
                  <span className="detail-label">공고번호</span>
                  <span className="detail-value">{selectedItem.bidNtceNo}-{selectedItem.bidNtceOrd}</span>
                </>
              )}

              <span className="detail-label">출처</span>
              <span className="detail-value">{getSourceInfo(selectedItem.source).icon} {selectedItem.sourceLabel}</span>

              <span className="detail-label">공고기관</span>
              <span className="detail-value">{selectedItem.organization || '미공개'}</span>

              <span className="detail-label">수요기관</span>
              <span className="detail-value">{selectedItem.demandOrg || selectedItem.organization || '미공개'}</span>

              <span className="detail-label">공고일시</span>
              <span className="detail-value">{formatDisplayDate(selectedItem.noticeDt)}</span>

              {selectedItem.bidStartDt && (
                <>
                  <span className="detail-label">입찰개시</span>
                  <span className="detail-value">{formatDisplayDate(selectedItem.bidStartDt)}</span>
                </>
              )}

              {selectedItem.bidEndDt && (
                <>
                  <span className="detail-label">입찰마감</span>
                  <span className="detail-value" style={{ color: '#ef4444', fontWeight: 600 }}>
                    {formatDisplayDate(selectedItem.bidEndDt)}
                  </span>
                </>
              )}

              {selectedItem.bidMethod && (
                <>
                  <span className="detail-label">입찰방법</span>
                  <span className="detail-value">{selectedItem.bidMethod}</span>
                </>
              )}

              {selectedItem.contractMethod && (
                <>
                  <span className="detail-label">계약방법</span>
                  <span className="detail-value">{selectedItem.contractMethod}</span>
                </>
              )}

              <span className="detail-label">추정가격</span>
              <span className="detail-value" style={{ color: '#10b981', fontWeight: 600 }}>
                {selectedItem.estimatedPrice ? formatPrice(selectedItem.estimatedPrice) : '미공개'}
              </span>

              {selectedItem.status && (
                <>
                  <span className="detail-label">상태</span>
                  <span className="detail-value">{selectedItem.status}</span>
                </>
              )}
            </div>

            <div className="detail-actions">
              {selectedItem.detailUrl && (
                <a
                  href={selectedItem.detailUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  🔗 원문 보기
                </a>
              )}
              <button
                className="btn btn-draft"
                onClick={() => openDraftModal(selectedItem)}
              >
                💡 작성 팁
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${selectedItem.title}\n출처: ${selectedItem.sourceLabel}\n기관: ${selectedItem.organization}\n마감: ${formatDisplayDate(selectedItem.bidEndDt)}\n${selectedItem.detailUrl || ''}`
                  );
                  showToast('📋 클립보드에 복사되었습니다', 'success');
                }}
              >
                📋 복사
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 작성 팁 Modal ═══ */}
      {draftItem && (
        <div className="modal-overlay" onClick={closeDraftModal}>
          <div className="draft-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeDraftModal}>✕</button>

            <div className="draft-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>💡 작성 팁</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {draftItem.title}
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {getSourceInfo(draftItem.source).icon} {draftItem.sourceLabel} · {draftItem.organization} · {draftItem.estimatedPrice ? formatPrice(draftItem.estimatedPrice) : '가격 미정'}
              </p>
            </div>

            {!draftContent && !draftLoading && !draftError && (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                  이 공고에 대한 제안서 작성 전략,<br/>추천 목차, 주의사항을 AI가 분석해드립니다.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button className="btn btn-secondary" onClick={closeDraftModal}>취소</button>
                  <button className="btn btn-draft btn-generate" onClick={handleGenerateDraft}>
                    🤖 작성 팁 받기
                  </button>
                </div>
              </div>
            )}

            {draftLoading && (
              <div className="draft-loading">
                <div className="draft-spinner"><div className="spinner" /></div>
                <p className="draft-loading-text">🤖 공고를 분석하고 있습니다...</p>
                <p className="draft-loading-sub">약 5~10초 소요</p>
              </div>
            )}

            {draftError && (
              <div className="draft-error">
                <span className="error-icon">❌</span>
                <div>
                  <strong>팁 생성 실패</strong>
                  <p>{draftError}</p>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setDraftError(null)}>← 다시 시도</button>
                </div>
              </div>
            )}

            {draftContent && (
              <>
                <div className="draft-actions-top">
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    navigator.clipboard.writeText(draftContent);
                    showToast('📋 작성 팁이 복사되었습니다', 'success');
                  }}>📋 복사</button>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={handleGenerateDraft}
                    disabled={draftLoading}
                  >🔄 다시 분석</button>
                </div>

                <div className="draft-content">
                  <div className="draft-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(draftContent) }} />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ Toast ═══ */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

// 간단한 마크다운 → HTML 변환 (의존성 없이)
function renderMarkdown(md: string): string {
  // XSS 방지: HTML 태그 이스케이프
  md = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let html = md
    // 코드 블럭
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // 테이블 처리
    .replace(/^\|(.+)\|\s*$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => /^[\s-:]+$/.test(c))) {
        return ''; // 구분선 제거
      }
      const tds = cells.map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${tds}</tr>`;
    })
    // 테이블 래핑
    .replace(/((<tr>.*<\/tr>\s*)+)/g, '<table>$1</table>')
    // 헤딩
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 볼드, 이탤릭
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // 리스트
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
    // 줄바꿈
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // li 래핑
  html = html.replace(/(<li>.*?<\/li>(\s*<br\/>)?)+/g, (match) => `<ul>${match}</ul>`);

  return `<p>${html}</p>`;
}
