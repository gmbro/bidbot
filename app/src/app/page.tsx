'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BidItem } from '@/types/bid';

// 카테고리 한글 라벨
const CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  service: '용역',
  construction: '공사',
  thing: '물품',
  etc: '기타',
};

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  service: 'badge-service',
  construction: 'badge-construction',
  thing: 'badge-thing',
  etc: 'badge-etc',
};

// 데모 데이터 (API 키 미활성화 시 사용)
const DEMO_ITEMS: BidItem[] = [
  {
    id: 'DEMO-001-00',
    bidNtceNo: 'DEMO-001',
    bidNtceOrd: '00',
    title: '2026년 인공지능(AI) 기반 행정업무 자동화 시스템 구축 사업',
    organization: '행정안전부',
    demandOrg: '행정안전부 디지털정부실',
    noticeDt: '2026/03/04 09:00:00',
    bidStartDt: '2026/03/04 09:00:00',
    bidEndDt: '2026/03/18 18:00:00',
    registDt: '2026/03/04 08:30:00',
    bidMethod: '제한경쟁',
    contractMethod: '협상에의한계약',
    estimatedPrice: '2500000000',
    category: 'service',
    noticeKind: '입찰공고',
    isAiRelated: true,
    isPriority: true,
    matchedKeywords: ['AI', '자동화', '인공지능'],
    detailUrl: 'https://www.g2b.go.kr',
  },
  {
    id: 'DEMO-002-00',
    bidNtceNo: 'DEMO-002',
    bidNtceOrd: '00',
    title: '빅데이터·AI 활용 교통흐름 분석 및 예측 시스템 고도화',
    organization: '국토교통부',
    demandOrg: '한국도로공사',
    noticeDt: '2026/03/04 10:00:00',
    bidStartDt: '2026/03/04 10:00:00',
    bidEndDt: '2026/03/20 18:00:00',
    registDt: '2026/03/04 09:45:00',
    bidMethod: '일반경쟁',
    contractMethod: '총액계약',
    estimatedPrice: '1800000000',
    category: 'service',
    noticeKind: '입찰공고',
    isAiRelated: true,
    isPriority: true,
    matchedKeywords: ['AI'],
    detailUrl: 'https://www.g2b.go.kr',
  },
  {
    id: 'DEMO-003-00',
    bidNtceNo: 'DEMO-003',
    bidNtceOrd: '00',
    title: '2026년도 청사 냉난방 설비 유지보수 용역',
    organization: '조달청',
    demandOrg: '조달청 시설관리과',
    noticeDt: '2026/03/04 11:00:00',
    bidStartDt: '2026/03/04 11:00:00',
    bidEndDt: '2026/03/15 18:00:00',
    registDt: '2026/03/04 10:30:00',
    bidMethod: '일반경쟁',
    contractMethod: '총액계약',
    estimatedPrice: '150000000',
    category: 'service',
    noticeKind: '입찰공고',
    isAiRelated: false,
    isPriority: false,
    matchedKeywords: [],
    detailUrl: 'https://www.g2b.go.kr',
  },
  {
    id: 'DEMO-004-00',
    bidNtceNo: 'DEMO-004',
    bidNtceOrd: '00',
    title: '디지털 전환(DX) 컨설팅 및 클라우드 마이그레이션 용역',
    organization: '과학기술정보통신부',
    demandOrg: '한국지능정보사회진흥원',
    noticeDt: '2026/03/04 14:00:00',
    bidStartDt: '2026/03/04 14:00:00',
    bidEndDt: '2026/03/22 18:00:00',
    registDt: '2026/03/04 13:30:00',
    bidMethod: '제한경쟁',
    contractMethod: '협상에의한계약',
    estimatedPrice: '3200000000',
    category: 'service',
    noticeKind: '입찰공고',
    isAiRelated: true,
    isPriority: false,
    matchedKeywords: [],
    detailUrl: 'https://www.g2b.go.kr',
  },
  {
    id: 'DEMO-005-00',
    bidNtceNo: 'DEMO-005',
    bidNtceOrd: '00',
    title: 'GPU 서버 및 AI 학습용 컴퓨팅 장비 구매',
    organization: '과학기술정보통신부',
    demandOrg: '한국전자통신연구원',
    noticeDt: '2026/03/04 15:00:00',
    bidStartDt: '2026/03/04 15:00:00',
    bidEndDt: '2026/03/25 18:00:00',
    registDt: '2026/03/04 14:30:00',
    bidMethod: '일반경쟁',
    contractMethod: '총액계약',
    estimatedPrice: '980000000',
    category: 'thing',
    noticeKind: '입찰공고',
    isAiRelated: true,
    isPriority: true,
    matchedKeywords: ['AI'],
    detailUrl: 'https://www.g2b.go.kr',
  },
  {
    id: 'DEMO-006-00',
    bidNtceNo: 'DEMO-006',
    bidNtceOrd: '00',
    title: '2026년 데이터센터 신축 공사',
    organization: '한국데이터산업진흥원',
    demandOrg: '한국데이터산업진흥원',
    noticeDt: '2026/03/04 16:00:00',
    bidStartDt: '2026/03/04 16:00:00',
    bidEndDt: '2026/04/01 18:00:00',
    registDt: '2026/03/04 15:30:00',
    bidMethod: '일반경쟁',
    contractMethod: '총액계약',
    estimatedPrice: '15000000000',
    category: 'construction',
    noticeKind: '입찰공고',
    isAiRelated: false,
    isPriority: false,
    matchedKeywords: [],
    detailUrl: 'https://www.g2b.go.kr',
  },
  {
    id: 'DEMO-007-00',
    bidNtceNo: 'DEMO-007',
    bidNtceOrd: '00',
    title: '생성형 AI 기반 민원상담 챗봇 구축 사업',
    organization: '서울특별시',
    demandOrg: '서울특별시 스마트도시정책관',
    noticeDt: '2026/03/04 17:00:00',
    bidStartDt: '2026/03/04 17:00:00',
    bidEndDt: '2026/03/28 18:00:00',
    registDt: '2026/03/04 16:30:00',
    bidMethod: '제한경쟁',
    contractMethod: '협상에의한계약',
    estimatedPrice: '750000000',
    category: 'service',
    noticeKind: '입찰공고',
    isAiRelated: true,
    isPriority: true,
    matchedKeywords: ['생성형', 'AI'],
    detailUrl: 'https://www.g2b.go.kr',
  },
  {
    id: 'DEMO-008-00',
    bidNtceNo: 'DEMO-008',
    bidNtceOrd: '00',
    title: '자율주행 시범운행지구 인프라 구축 및 운영',
    organization: '국토교통부',
    demandOrg: '국토교통부 자동차정책과',
    noticeDt: '2026/03/04 18:00:00',
    bidStartDt: '2026/03/04 18:00:00',
    bidEndDt: '2026/04/05 18:00:00',
    registDt: '2026/03/04 17:30:00',
    bidMethod: '제한경쟁',
    contractMethod: '협상에의한계약',
    estimatedPrice: '5600000000',
    category: 'service',
    noticeKind: '입찰공고',
    isAiRelated: true,
    isPriority: false,
    matchedKeywords: [],
    detailUrl: 'https://www.g2b.go.kr',
  },
];

interface FetchResult {
  items: BidItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  stats: { total: number; aiRelated: number; byCategory: Record<string, number>; filtered: number };
  query: { startDate: string; endDate: string; category: string; aiOnly: boolean; keyword: string };
}

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

function getDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateInput(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function parseDateInput(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

// 빠른 날짜 범위 선택 옵션 (종료일 기준)
const QUICK_DATE_OPTIONS = [
  { label: '일', days: 1 },
  { label: '주', days: 7 },
  { label: '월', days: 30 },
];

export default function HomePage() {
  const [items, setItems] = useState<BidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  // 필터
  const [startDate, setStartDate] = useState(getDateNDaysAgo(1));
  const [endDate, setEndDate] = useState(getToday());
  const [category, setCategory] = useState<string>('all');
  const [aiOnly, setAiOnly] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 통계
  const [stats, setStats] = useState({
    total: 0,
    aiRelated: 0,
    byCategory: {} as Record<string, number>,
    filtered: 0,
  });
  const [totalPages, setTotalPages] = useState(1);

  // 모달
  const [selectedItem, setSelectedItem] = useState<BidItem | null>(null);

  // 토스트
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 슬랙 전송 중
  const [sendingSlack, setSendingSlack] = useState(false);

  // 초안 작성 상태
  const [draftItem, setDraftItem] = useState<BidItem | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftContent, setDraftContent] = useState<string>('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftStep, setDraftStep] = useState<'setup' | 'result'>('setup');
  const [templateType, setTemplateType] = useState<'technical' | 'business' | 'simple'>('technical');
  const [rfpContext, setRfpContext] = useState<string>('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchBids = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIsDemo(false);

    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        category,
        aiOnly: String(aiOnly),
        keyword,
        page: String(page),
        pageSize: String(pageSize),
      });

      const res = await fetch(`/api/bids?${params}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || data.message);
      }

      setItems(data.data.items);
      setStats(data.data.stats);
      setTotalPages(data.data.pagination.totalPages);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '알 수 없는 에러';
      console.error('Fetch error:', errorMsg);

      // API 에러 시 데모 데이터 표시
      setError(errorMsg);
      setIsDemo(true);

      // 데모 데이터 필터링 + 최신순 정렬
      let filtered = [...DEMO_ITEMS];
      if (aiOnly) filtered = filtered.filter(i => i.isAiRelated);
      if (category !== 'all') filtered = filtered.filter(i => i.category === category);
      if (keyword) {
        const kw = keyword.toLowerCase();
        filtered = filtered.filter(i =>
          i.title.toLowerCase().includes(kw) ||
          i.organization.toLowerCase().includes(kw)
        );
      }

      // 최신순 정렬 (noticeDt 기준 내림차순)
      filtered.sort((a, b) => {
        const dateA = a.noticeDt || '';
        const dateB = b.noticeDt || '';
        return dateB.localeCompare(dateA);
      });

      setItems(filtered.slice((page - 1) * pageSize, page * pageSize));
      setStats({
        total: DEMO_ITEMS.length,
        aiRelated: DEMO_ITEMS.filter(i => i.isAiRelated).length,
        byCategory: {
          service: DEMO_ITEMS.filter(i => i.category === 'service').length,
          construction: DEMO_ITEMS.filter(i => i.category === 'construction').length,
          thing: DEMO_ITEMS.filter(i => i.category === 'thing').length,
          etc: DEMO_ITEMS.filter(i => i.category === 'etc').length,
        },
        filtered: filtered.length,
      });
      setTotalPages(Math.ceil(filtered.length / pageSize));
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, category, aiOnly, keyword, page]);

  useEffect(() => {
    fetchBids();
  }, [fetchBids]);

  const handleSearch = () => {
    setPage(1);
    fetchBids();
  };

  // 빠른 날짜 범위 선택 핸들러 (종료일 기준으로 시작일 역산)
  const handleQuickDate = (days: number) => {
    setStartDate(getDateNDaysAgo(days));
    setEndDate(getToday());
    setPage(1);
  };

  // 현재 선택된 빠른 날짜 옵션 확인
  const activeQuickDays = QUICK_DATE_OPTIONS.find(
    opt => startDate === getDateNDaysAgo(opt.days) && endDate === getToday()
  )?.days ?? null;

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
    } catch (err) {
      showToast('❌ 슬랙 전송 실패', 'error');
    } finally {
      setSendingSlack(false);
    }
  };

  // 초안 설정 모달 열기 (1단계)
  const openDraftSetup = (item: BidItem) => {
    setDraftItem(item);
    setDraftStep('setup');
    setDraftContent('');
    setDraftError(null);
    setDraftLoading(false);
    setTemplateType('technical');
    setRfpContext('');
    setSelectedItem(null); // 상세 모달 닫기
  };

  // 초안 생성 핸들러 (2단계로 전환)
  const handleGenerateDraft = async () => {
    if (!draftItem) return;
    setDraftStep('result');
    setDraftLoading(true);
    setDraftContent('');
    setDraftError(null);

    try {
      const res = await fetch('/api/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draftItem.title,
          organization: draftItem.organization,
          demandOrg: draftItem.demandOrg,
          bidMethod: draftItem.bidMethod,
          contractMethod: draftItem.contractMethod,
          estimatedPrice: draftItem.estimatedPrice ? formatPrice(draftItem.estimatedPrice) : undefined,
          bidEndDt: draftItem.bidEndDt ? formatDisplayDate(draftItem.bidEndDt) : undefined,
          rfpContext,
          templateType,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setDraftContent(data.draft);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '초안 생성에 실패했습니다';
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
    setDraftStep('setup');
    setRfpContext('');
  };

  const copyDraft = () => {
    if (draftContent) {
      navigator.clipboard.writeText(draftContent);
      showToast('📋 초안이 클립보드에 복사되었습니다', 'success');
    }
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-badge">
          <span>🤖</span>
          <span>AI 공고 모니터링 시스템</span>
        </div>
        <h1>나라장터 AI 공고 모니터</h1>
        <p className="subtitle">
          공공조달 입찰공고에서 AI·디지털 관련 지원사업을 실시간으로 추적합니다
        </p>
      </header>

      {/* Demo 모드 안내 */}
      {isDemo && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <div>
            <strong>데모 모드로 실행 중입니다</strong>
            <p style={{ marginTop: 4, fontSize: '0.85rem', opacity: 0.8 }}>
              {error || 'API 키가 아직 활성화되지 않았습니다.'} data.go.kr API 키 활성화 후 실제 데이터가 표시됩니다.
              (보통 신청 후 1~2시간 소요)
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">📋 전체 공고</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card ai-stat">
          <div className="stat-label">🤖 AI 관련 공고</div>
          <div className="stat-value ai-value">{stats.aiRelated}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🔧 용역</div>
          <div className="stat-value">{stats.byCategory?.service || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">🏗️ 공사</div>
          <div className="stat-value">{stats.byCategory?.construction || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">📦 물품</div>
          <div className="stat-value">{stats.byCategory?.thing || 0}</div>
        </div>
      </div>

      {/* Filters — Toss Style */}
      <div className="filter-section">
        {/* 1행: 기간 선택 */}
        <div className="filter-period-row">
          <span className="filter-period-label">기간</span>
          <div className="segment-control">
            {QUICK_DATE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                className={`segment-btn ${activeQuickDays === opt.days ? 'active' : ''}`}
                onClick={() => handleQuickDate(opt.days)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="date-range-inline">
            <input
              type="date"
              className="date-input-compact"
              value={formatDateInput(startDate)}
              onChange={(e) => setStartDate(parseDateInput(e.target.value))}
            />
            <span className="date-separator">~</span>
            <input
              type="date"
              className="date-input-compact"
              value={formatDateInput(endDate)}
              onChange={(e) => setEndDate(parseDateInput(e.target.value))}
            />
          </div>
        </div>

        {/* 2행: 검색바 */}
        <div className="search-bar-row">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="공고명, 기관명으로 검색..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {keyword && (
              <button className="search-clear" onClick={() => { setKeyword(''); setPage(1); }}>✕</button>
            )}
          </div>
          <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
            검색
          </button>
        </div>

        {/* 3행: 필터 칩 + 액션 */}
        <div className="filter-chips-row">
          <div className="chip-group">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`chip ${category === key ? 'chip-active' : ''}`}
                onClick={() => { setCategory(key); setPage(1); }}
              >
                {label}
              </button>
            ))}
            <span className="chip-divider" />
            <button
              className={`chip ${aiOnly ? 'chip-ai-active' : ''}`}
              onClick={() => { setAiOnly(!aiOnly); setPage(1); }}
            >
              🤖 AI만
            </button>
          </div>
          <button
            className="btn btn-slack btn-sm"
            onClick={sendSlackNotification}
            disabled={sendingSlack}
          >
            {sendingSlack ? '⏳ 전송 중...' : '💬 슬랙 알림'}
          </button>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner" />
          <p style={{ color: 'var(--text-secondary)' }}>공고를 불러오는 중...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📭</div>
          <h3>조건에 맞는 공고가 없습니다</h3>
          <p>날짜 범위를 변경하거나 필터를 조정해보세요.</p>
        </div>
      ) : (
        <>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 16, color: 'var(--text-secondary)', fontSize: '0.9rem'
          }}>
            <span>
              총 <strong style={{ color: 'var(--text-primary)' }}>{stats.filtered}</strong>건
              {aiOnly && <> (AI 관련 <strong style={{ color: 'var(--accent-light)' }}>{stats.aiRelated}</strong>건)</>}
            </span>
            <span>{page} / {totalPages} 페이지</span>
          </div>

          <div className="bid-list">
            {items.map((item) => (
              <div
                key={item.id}
                className={`bid-card ${item.isAiRelated ? 'ai-related' : ''}`}
                onClick={() => setSelectedItem(item)}
              >
                <div className="bid-card-header">
                  <div className="bid-title">
                    <a
                      href={item.detailUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {item.title}
                    </a>
                  </div>
                  <div className="bid-badges">
                    {item.isPriority && <span className="badge badge-priority">🔴 알림</span>}
                    {item.isAiRelated && <span className="badge badge-ai">🤖 AI</span>}
                    <span className={`badge ${CATEGORY_BADGE_CLASS[item.category] || 'badge-etc'}`}>
                      {CATEGORY_LABELS[item.category] || item.category}
                    </span>
                    {item.matchedKeywords.length > 0 && (
                      <span className="matched-keywords">
                        {item.matchedKeywords.map(kw => <span key={kw} className="keyword-tag">{kw}</span>)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bid-meta">
                  <div className="bid-meta-item">
                    <span className="icon">🏢</span>
                    <span>{item.organization}</span>
                  </div>
                  <div className="bid-meta-item">
                    <span className="icon">📅</span>
                    <span className="label">공고일</span>
                    <span>{formatDisplayDate(item.noticeDt)}</span>
                  </div>
                  <div className="bid-meta-item">
                    <span className="icon">⏰</span>
                    <span className="label">마감</span>
                    <span>{formatDisplayDate(item.bidEndDt)}</span>
                  </div>
                  {item.estimatedPrice && (
                    <div className="bid-meta-item">
                      <span className="icon">💰</span>
                      <span>{formatPrice(item.estimatedPrice)}</span>
                    </div>
                  )}
                  <div className="bid-meta-item">
                    <span className="icon">📝</span>
                    <span>{item.contractMethod}</span>
                  </div>
                </div>
                {/* 초안 작성 버튼 */}
                <div className="bid-card-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-draft btn-sm"
                    onClick={() => openDraftSetup(item)}
                  >
                    ✍️ 초안 작성
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                ‹
              </button>
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
                const p = i + 1;
                return (
                  <button
                    key={p}
                    className={`page-btn ${page === p ? 'active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <span className="page-info">{page} / {totalPages}</span>
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

      {/* Detail Modal */}
      {selectedItem && (
        <div className="modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedItem(null)}>✕</button>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {selectedItem.isPriority && <span className="badge badge-priority">🔴 자동 알림 대상</span>}
              {selectedItem.isAiRelated && <span className="badge badge-ai">🤖 AI 관련</span>}
              <span className={`badge ${CATEGORY_BADGE_CLASS[selectedItem.category] || 'badge-etc'}`}>
                {CATEGORY_LABELS[selectedItem.category]}
              </span>
              {selectedItem.noticeKind && (
                <span className="badge badge-etc">{selectedItem.noticeKind}</span>
              )}
              {selectedItem.matchedKeywords.length > 0 && (
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {selectedItem.matchedKeywords.map(kw => <span key={kw} className="keyword-tag">{kw}</span>)}
                </span>
              )}
            </div>

            <h2 className="modal-title">{selectedItem.title}</h2>

            <div className="detail-grid">
              <span className="detail-label">공고번호</span>
              <span className="detail-value">{selectedItem.bidNtceNo}-{selectedItem.bidNtceOrd}</span>

              <span className="detail-label">공고기관</span>
              <span className="detail-value">{selectedItem.organization}</span>

              <span className="detail-label">수요기관</span>
              <span className="detail-value">{selectedItem.demandOrg}</span>

              <span className="detail-label">공고일시</span>
              <span className="detail-value">{formatDisplayDate(selectedItem.noticeDt)}</span>

              <span className="detail-label">입찰개시</span>
              <span className="detail-value">{formatDisplayDate(selectedItem.bidStartDt)}</span>

              <span className="detail-label">입찰마감</span>
              <span className="detail-value" style={{ color: '#fbbf24', fontWeight: 600 }}>
                {formatDisplayDate(selectedItem.bidEndDt)}
              </span>

              <span className="detail-label">등록일시</span>
              <span className="detail-value">{formatDisplayDate(selectedItem.registDt)}</span>

              <span className="detail-label">입찰방법</span>
              <span className="detail-value">{selectedItem.bidMethod}</span>

              <span className="detail-label">계약방법</span>
              <span className="detail-value">{selectedItem.contractMethod}</span>

              {selectedItem.estimatedPrice && (
                <>
                  <span className="detail-label">추정가격</span>
                  <span className="detail-value" style={{ color: '#34d399', fontWeight: 600 }}>
                    {formatPrice(selectedItem.estimatedPrice)}
                  </span>
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
                  🔗 나라장터에서 보기
                </a>
              )}
              <button
                className="btn btn-draft"
                onClick={() => openDraftSetup(selectedItem)}
              >
                ✍️ 초안 작성하기
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${selectedItem.title}\n공고번호: ${selectedItem.bidNtceNo}\n기관: ${selectedItem.organization}\n마감: ${formatDisplayDate(selectedItem.bidEndDt)}\n${selectedItem.detailUrl || ''}`
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

      {/* Draft Modal — 2단계 */}
      {draftItem && (
        <div className="modal-overlay" onClick={closeDraftModal}>
          <div className="draft-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={closeDraftModal}>✕</button>

            <div className="draft-header">
              <div className="draft-header-badge">
                <span>✍️</span>
                <span>AI 제안서 초안</span>
              </div>
              <h2 className="draft-title">{draftItem.title}</h2>
              <p className="draft-subtitle">
                {draftItem.organization} · {formatPrice(draftItem.estimatedPrice)}
              </p>
            </div>

            {/* ── 1단계: 설정 ── */}
            {draftStep === 'setup' && (
              <div className="draft-setup">
                {/* 양식 선택 */}
                <div className="draft-section">
                  <h3 className="draft-section-title">📋 제안서 양식 선택</h3>
                  <div className="template-cards">
                    <button
                      className={`template-card ${templateType === 'technical' ? 'active' : ''}`}
                      onClick={() => setTemplateType('technical')}
                    >
                      <span className="template-icon">🔧</span>
                      <span className="template-name">기술제안서</span>
                      <span className="template-desc">기술 역량·방법론·아키텍처 중심</span>
                    </button>
                    <button
                      className={`template-card ${templateType === 'business' ? 'active' : ''}`}
                      onClick={() => setTemplateType('business')}
                    >
                      <span className="template-icon">📊</span>
                      <span className="template-name">사업계획서</span>
                      <span className="template-desc">사업 타당성·ROI·전략 중심</span>
                    </button>
                    <button
                      className={`template-card ${templateType === 'simple' ? 'active' : ''}`}
                      onClick={() => setTemplateType('simple')}
                    >
                      <span className="template-icon">📝</span>
                      <span className="template-name">간이제안서</span>
                      <span className="template-desc">소규모 사업용 간결한 양식</span>
                    </button>
                  </div>
                </div>

                {/* RFP 입력 */}
                <div className="draft-section">
                  <h3 className="draft-section-title">
                    📄 제안요청서(RFP) / 요구사항 입력
                    <span className="optional-badge">선택사항</span>
                  </h3>
                  <p className="draft-section-hint">
                    공고 내 제안요청서, 과업내용서, 평가기준 등을 붙여넣으면<br />
                    AI가 해당 내용을 반영하여 더 정확한 초안을 생성합니다.
                  </p>
                  <textarea
                    className="rfp-textarea"
                    placeholder="여기에 RFP, 과업내용서, 평가기준, 요구사항 등을 붙여넣으세요...&#10;&#10;예시:&#10;- 평가항목: 기술 이해도(30점), 수행방안(40점), 프로젝트 관리(30점)&#10;- 사업 범위: AI 기반 민원상담 챗봇 개발&#10;- 요구 기능: 자연어 처리, 다국어 지원, 관리자 대시보드"
                    value={rfpContext}
                    onChange={(e) => setRfpContext(e.target.value)}
                    rows={8}
                  />
                  {rfpContext && (
                    <div className="rfp-char-count">
                      {rfpContext.length.toLocaleString()}/10,000자
                    </div>
                  )}
                </div>

                {/* 생성 버튼 */}
                <div className="draft-setup-actions">
                  <button className="btn btn-secondary" onClick={closeDraftModal}>
                    취소
                  </button>
                  <button className="btn btn-draft btn-generate" onClick={handleGenerateDraft}>
                    🤖 AI 초안 생성하기
                  </button>
                </div>
              </div>
            )}

            {/* ── 2단계: 결과 ── */}
            {draftStep === 'result' && (
              <>
                {draftLoading && (
                  <div className="draft-loading">
                    <div className="draft-spinner">
                      <div className="spinner" />
                    </div>
                    <p className="draft-loading-text">
                      🤖 Gemini AI가 {templateType === 'technical' ? '기술제안서' : templateType === 'business' ? '사업계획서' : '간이제안서'} 초안을 작성하고 있습니다...
                    </p>
                    <p className="draft-loading-sub">
                      {rfpContext ? 'RFP 내용을 분석하여 맞춤형 초안을 생성합니다' : '공고 내용을 분석하여 초안을 생성합니다'} (약 10~30초 소요)
                    </p>
                  </div>
                )}

                {draftError && (
                  <div className="draft-error">
                    <span className="error-icon">❌</span>
                    <div>
                      <strong>초안 생성 실패</strong>
                      <p>{draftError}</p>
                    </div>
                  </div>
                )}

                {draftContent && (
                  <>
                    <div className="draft-actions-top">
                      <button className="btn btn-primary btn-sm" onClick={copyDraft}>
                        📋 초안 복사
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setDraftStep('setup')}
                      >
                        ⚙️ 설정 변경
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={handleGenerateDraft}
                      >
                        🔄 다시 생성
                      </button>
                    </div>
                    <div className="draft-content">
                      <div className="draft-markdown" dangerouslySetInnerHTML={{ __html: renderMarkdown(draftContent) }} />
                    </div>
                    <div className="draft-disclaimer">
                      ⚠️ AI가 생성한 초안입니다. 실제 제출 전 반드시 내용을 검토하고 수정하세요.
                    </div>
                  </>
                )}

                {(draftError || (!draftLoading && !draftContent)) && (
                  <div className="draft-setup-actions">
                    <button className="btn btn-secondary" onClick={() => setDraftStep('setup')}>
                      ← 설정으로 돌아가기
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
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
  let html = md
    // 코드 블럭
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // 테이블 처리
    .replace(/^\|(.+)\|\s*$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => /^[\s-:]+$/.test(c))) {
        return ''; // 구분선 제거
      }
      const isHeader = false;
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
