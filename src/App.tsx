import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';

const CURRENT_APP_VERSION = '2026.09.28 v5.10.9';

interface ShipClass {
  id: string;
  code: string;
  name_zh: string;
  category: string;
  current_status?: string;
  nato_code?: string;
  image_url?: string;
  overview?: string;
  displacement?: string;
  length?: string;
  beam?: string;
  draft?: string;
  power_output?: string;
  propulsion?: string;
  max_speed?: string;
  crew?: string;
  radar_systems?: string;
  weapons_summary?: string;
  electronic_warfare?: string;
  aircraft?: string;
  identification_features?: string[];
  identification_notes?: string;
  similar_classes?: string[];
  identification_status?: 'verified' | 'unverified' | 'incomplete';
  identification_source?: string;
  identification_updated_at?: string;
}

interface Ship {
  id: string;
  class_id: string;
  hull_number: string;
  name_zh: string;
  commissioned_year?: string;
  commission_precision?: 'exact' | 'year' | 'unknown';
  fleet?: string;
  squadron?: string;
  status: string;
  status_code?: 'active' | 'retired' | 'unknown' | 'sea_trial' | 'planned' | 'under_construction' | 'fitting_out' | 'refit';
}

type FontSizeOption = 'sm' | 'default' | 'md' | 'lg';
type ThemeMode = 'dark' | 'red' | 'high_contrast';
type BottomTab = 'classes' | 'favorites' | 'compare' | 'more';

function StarIcon({ isFilled, isRedMode }: { isFilled: boolean; isRedMode: boolean }) {
  if (isFilled) {
    return (
      <svg className={`w-6 h-6 ${isRedMode ? 'text-red-400' : 'text-amber-400'}`} fill="currentColor" viewBox="0 0 24 24">
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="w-6 h-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  );
}

export default function App() {
  const [classes, setClasses] = useState<ShipClass[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [hasUpdateAvailable, setHasUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    const saved = localStorage.getItem('tn_recent_searches');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedClassDetail, setSelectedClassDetail] = useState<ShipClass | null>(null);
  const [expandedShipList, setExpandedShipList] = useState(false);
  const [detailMenuOpen, setDetailMenuOpen] = useState(false);
  const detailTouchStartX = useRef<number | null>(null);
  const detailTouchStartY = useRef<number | null>(null);
  const [detailDragX, setDetailDragX] = useState(0);
  const [detailDragging, setDetailDragging] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullRefreshDone, setPullRefreshDone] = useState(false);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('tn_theme_mode') as ThemeMode) || 'dark';
  });
  const [fontSize, setFontSize] = useState<FontSizeOption>(() => {
    return (localStorage.getItem('tn_font_size') as FontSizeOption) || 'default';
  });

  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('classes');
  const [showMoreModal, setShowMoreModal] = useState<null | 'rankings' | 'guide' | 'sources' | 'update'>(null);

  const [comparePool, setComparePool] = useState<string[]>(() => {
    const saved = localStorage.getItem('tn_compare_pool');
    return saved ? JSON.parse(saved) : [];
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('tn_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const [queryCounts, setQueryCounts] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('tn_query_counts');
    return saved ? JSON.parse(saved) : {};
  });
  const [monthlyUsage, setMonthlyUsage] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('tn_monthly_usage');
    return saved ? JSON.parse(saved) : {};
  });
  const [globalQueryCounts, setGlobalQueryCounts] = useState<Record<string, number>>({});
  const [globalMonthlyUsage, setGlobalMonthlyUsage] = useState<Record<string, number>>({});

  const moreTabsRef = useRef<HTMLDivElement | null>(null);
  const moreTabSwipeStartX = useRef<number | null>(null);
  const moreTabSwipeStartY = useRef<number | null>(null);
  useEffect(() => {
    if (!showMoreModal || !moreTabsRef.current) return;
    const active = moreTabsRef.current.querySelector<HTMLElement>(`[data-more-tab="${showMoreModal}"]`);
    active?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [showMoreModal]);

  const [showAdmin, setShowAdmin] = useState(false);
  const panelSwipeStartX = useRef<number | null>(null);
  const panelSwipeStartY = useRef<number | null>(null);
  const [panelDragX, setPanelDragX] = useState(0);
  const [panelDragging, setPanelDragging] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('tn_admin_auth') === 'true';
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminActiveTab, setAdminActiveTab] = useState<'class_edit' | 'ship_add' | 'banner'>('class_edit');

  const [bannerText, setBannerText] = useState<string>(() => {
    return localStorage.getItem('tn_banner_text') || '';
  });
  const [adminBannerInput, setAdminBannerInput] = useState('');
  const [editingShipId, setEditingShipId] = useState<string | null>(null);
  const [selectedShipIds, setSelectedShipIds] = useState<string[]>([]);

  const [editingClassForm, setEditingClassForm] = useState<Partial<ShipClass>>({
    code: '', name_zh: '', category: '驅逐艦', nato_code: '', image_url: '', overview: '',
    displacement: '', length: '', beam: '', draft: '', power_output: '', propulsion: '', max_speed: '', current_status: '',
    crew: '', radar_systems: '', weapons_summary: '', electronic_warfare: '', aircraft: '',
    identification_features: [], identification_notes: '', similar_classes: [],
    identification_status: 'unverified', identification_source: ''
  });
  const [tempFeatureInput, setTempFeatureInput] = useState('');
  const [draggingFeatureIndex, setDraggingFeatureIndex] = useState<number | null>(null);
  const featureDragStartY = useRef<number | null>(null);
  const featureDragCurrentIndex = useRef<number | null>(null);

  const [wikiQuery, setWikiQuery] = useState('');
  const [isFetchingWiki, setIsFetchingWiki] = useState(false);
  const [wikiPreviewClass, setWikiPreviewClass] = useState<Partial<ShipClass> | null>(null);
  const [shipWikiQuery, setShipWikiQuery] = useState('');
  const [isFetchingShipWiki, setIsFetchingShipWiki] = useState(false);
  const [wikiShipBatch, setWikiShipBatch] = useState<Array<{ hull_number: string; name_zh: string; commissioned_year: string; commission_precision: 'exact' | 'year' | 'unknown'; fleet: string; squadron: string; status_code: Ship['status_code'] }>>([]);

  const [newShipForm, setNewShipForm] = useState<{
    class_id: string;
    hull_number: string;
    name_zh: string;
    commissioned_year: string;
    commission_precision: 'exact' | 'year' | 'unknown';
    fleet: string;
    squadron: string;
    status_code: 'active' | 'retired' | 'unknown' | 'sea_trial' | 'planned' | 'under_construction' | 'fitting_out' | 'refit';
  }>({
    class_id: '', hull_number: '', name_zh: '', commissioned_year: '',
    commission_precision: 'year', fleet: '', squadron: '', status_code: 'active'
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setHasUpdateAvailable(true);
              }
            };
          }
        };
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleForceUpdateApp = async () => {
    setIsUpdating(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      }
      alert('已清除本機靜態快取，即將重新載入最新版面！');
      window.location.reload();
    } catch (e) {
      console.error(e);
      window.location.reload();
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const saved = localStorage.getItem('tn_monthly_usage');
    const currentMap = saved ? JSON.parse(saved) : {};
    currentMap[currentMonthKey] = (currentMap[currentMonthKey] || 0) + 1;
    localStorage.setItem('tn_monthly_usage', JSON.stringify(currentMap));
    setMonthlyUsage(currentMap);

    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(granted => {
        if (granted) console.log('Persistent storage active');
      });
    }
  }, []);

  const fetchGlobalStats = async () => {
    if (!supabase || !navigator.onLine) return;
    const [{ data: classStats, error: classError }, { data: monthStats, error: monthError }] = await Promise.all([
      supabase.from('ship_query_stats').select('class_id,query_count'),
      supabase.from('monthly_query_stats').select('month_key,query_count').order('month_key', { ascending: false }).limit(10)
    ]);
    if (!classError && classStats) {
      setGlobalQueryCounts(Object.fromEntries(classStats.map(row => [row.class_id, Number(row.query_count) || 0])));
    }
    if (!monthError && monthStats) {
      setGlobalMonthlyUsage(Object.fromEntries(monthStats.map(row => [row.month_key, Number(row.query_count) || 0])));
    }
  };

  const fetchData = async () => {
    setIsLoading(true);
    const cachedClasses = localStorage.getItem('tn_cache_classes');
    const cachedShips = localStorage.getItem('tn_cache_ships');
    const cachedBanner = localStorage.getItem('tn_banner_text');
    if (cachedClasses) setClasses(JSON.parse(cachedClasses));
    if (cachedShips) setShips(JSON.parse(cachedShips));
    if (cachedBanner && !bannerText) setBannerText(cachedBanner);

    if (!supabase || !navigator.onLine) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: cData } = await supabase.from('ship_classes').select('*').order('code');
      const { data: sData } = await supabase.from('ships').select('*').order('hull_number');
      const { data: bData } = await supabase.from('app_settings').select('banner_text').eq('id', 'global').maybeSingle();
      await fetchGlobalStats();

      if (cData) {
        setClasses(cData as ShipClass[]);
        localStorage.setItem('tn_cache_classes', JSON.stringify(cData));
      }
      if (sData) {
        setShips(sData as Ship[]);
        localStorage.setItem('tn_cache_ships', JSON.stringify(sData));
      }
      if (bData?.banner_text !== undefined) {
        setBannerText(bData.banner_text || '');
        localStorage.setItem('tn_banner_text', bData.banner_text || '');
      }
    } catch (err) {
      console.warn('離線或快照使用中', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 全域廣播即時同步：其他已連線裝置不需重新整理即可收到最新通報。
  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const channel = client
      .channel('shipid-global-banner')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: 'id=eq.global' },
        (payload) => {
          const next = (payload.new as { banner_text?: string } | null)?.banner_text ?? '';
          setBannerText(next);
          localStorage.setItem('tn_banner_text', next);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  const handleSelectRecentSearch = (term: string) => {
    setSearchTerm(term);
  };

  const handleExecuteSearch = (val: string) => {
    setSearchTerm(val);
    if (val.trim() && !recentSearches.includes(val.trim())) {
      const updated = [val.trim(), ...recentSearches.filter(s => s !== val.trim())].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('tn_recent_searches', JSON.stringify(updated));
    }
  };

  const getStatusLabel = (code?: string, fallbackStatus?: string) => {
    if (themeMode === 'red') {
      const redThemeLabels: Record<string, string> = {
        active: '現役', retired: '退役', unknown: '未知', sea_trial: '海試',
        planned: '計畫', fitting_out: '舾裝中', under_construction: '建造中', refit: '改裝中'
      };
      return { label: redThemeLabels[code || ''] || fallbackStatus || '未知', color: 'bg-red-950 text-red-200 border-red-800' };
    }
    switch (code) {
      case 'active': return { label: '現役', color: 'bg-emerald-950 text-emerald-300 border-emerald-500/40' };
      case 'retired': return { label: '退役', color: 'bg-slate-800 text-slate-400 border-slate-700' };
      case 'unknown': return { label: '未知', color: 'bg-slate-800 text-slate-300 border-slate-700' };
      case 'sea_trial': return { label: '海試', color: 'bg-amber-950 text-amber-300 border-amber-500/40' };
      case 'planned': return { label: '計畫', color: 'bg-cyan-950 text-cyan-300 border-cyan-500/40' };
      case 'fitting_out': return { label: '舾裝中', color: 'bg-blue-950 text-blue-300 border-blue-500/40' };
      case 'under_construction': return { label: '建造中', color: 'bg-purple-950 text-purple-300 border-purple-500/40' };
      case 'refit': return { label: '改裝中', color: 'bg-orange-950 text-orange-300 border-orange-500/40' };
      default: return { label: fallbackStatus || '現役', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const getVerificationBadge = (status?: string) => {
    if (themeMode === 'red') {
      return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-950 text-red-300 border border-red-800">已查證</span>;
    }
    switch (status) {
      case 'verified':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50">已查證</span>;
      case 'incomplete':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-500/50">資料未完整</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">待查證</span>;
    }
  };

  const toggleFavorite = (classId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let updated: string[];
    if (favorites.includes(classId)) {
      updated = favorites.filter(id => id !== classId);
    } else {
      updated = [...favorites, classId];
    }
    setFavorites(updated);
    localStorage.setItem('tn_favorites', JSON.stringify(updated));
  };

  const toggleCompare = (classId: string) => {
    let updated: string[];
    if (comparePool.includes(classId)) {
      updated = comparePool.filter(id => id !== classId);
    } else {
      if (comparePool.length >= 2) {
        updated = [comparePool[1], classId];
      } else {
        updated = [...comparePool, classId];
      }
    }
    setComparePool(updated);
    localStorage.setItem('tn_compare_pool', JSON.stringify(updated));
  };

  const handleOpenDetail = (shipClass: ShipClass) => {
    setSelectedClassDetail(shipClass);
    setExpandedShipList(false);
    setDetailMenuOpen(false);

    // 本機仍保留計數，斷網時可正常運作；在線時另外累加全站統計。
    const updated = { ...queryCounts, [shipClass.id]: (queryCounts[shipClass.id] || 0) + 1 };
    setQueryCounts(updated);
    localStorage.setItem('tn_query_counts', JSON.stringify(updated));

    if (supabase && navigator.onLine) {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      void supabase.rpc('increment_ship_query_stats', {
        p_class_id: shipClass.id,
        p_month_key: monthKey
      }).then(({ error }) => {
        if (error) {
          console.warn('全站查詢統計同步失敗', error);
          return;
        }
        setGlobalQueryCounts(prev => ({ ...prev, [shipClass.id]: (prev[shipClass.id] || 0) + 1 }));
        setGlobalMonthlyUsage(prev => ({ ...prev, [monthKey]: (prev[monthKey] || 0) + 1 }));
      });
    }
  };

  const renderFormattedList = (text?: string) => {
    const textColor = themeMode === 'red' ? 'text-red-200' : themeMode === 'high_contrast' ? 'text-slate-950' : 'text-white';
    if (!text) return <span className={`${textColor} font-medium`}>-</span>;
    const items = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (items.length <= 1) {
      return <span className={`${textColor} font-medium leading-relaxed break-words`}>{text}</span>;
    }
    return (
      <div className="space-y-1.5 pt-0.5">
        {items.map((item, idx) => (
          <div key={idx} className={`flex items-start gap-2 ${textColor} leading-relaxed`}>
            <span className={themeMode === 'red' ? 'text-red-700' : themeMode === 'high_contrast' ? 'text-slate-600' : 'text-slate-500'}>•</span>
            <span className="font-medium break-words">{item}</span>
          </div>
        ))}
      </div>
    );
  };

  const lowerSearch = searchTerm.toLowerCase().trim();
  const matchingShipClassIds = new Set<string>();
  const matchingShips = ships.filter(s => {
    const match = s.hull_number.toLowerCase().includes(lowerSearch) || s.name_zh.includes(lowerSearch);
    if (match) matchingShipClassIds.add(s.class_id);
    return match;
  });

  let displayedClasses = classes.filter(c => {
    if (!lowerSearch) return true;
    return (
      c.code.toLowerCase().includes(lowerSearch) ||
      c.name_zh.toLowerCase().includes(lowerSearch) ||
      (c.nato_code && c.nato_code.toLowerCase().includes(lowerSearch)) ||
      matchingShipClassIds.has(c.id)
    );
  });

  if (activeBottomTab === 'favorites') {
    displayedClasses = displayedClasses.filter(c => favorites.includes(c.id));
  }

  const getThemeStyles = () => {
    if (themeMode === 'red') {
      return {
        bg: 'bg-[#080203]',
        headerBg: 'bg-[#120305]/95 border-red-950',
        cardBg: 'bg-[#130305] border-red-950 hover:border-red-700',
        modalBg: 'bg-[#0f0204] border-red-900/80 text-red-200',
        subPanelBg: 'bg-[#180407] border-red-950 text-red-200',
        accentText: 'text-red-500',
        accentBg: 'bg-red-800 hover:bg-red-700 text-red-100',
        border: 'border-red-950',
        badge: 'bg-[#1a0408] text-red-300 border border-red-900',
        input: 'bg-black border-red-950 text-red-200 placeholder-red-900 focus:border-red-700',
        btnSecondary: 'bg-[#1c0509] border-red-950 text-red-300 hover:bg-[#25070d]',
        textMuted: 'text-red-800'
      };
    }
    if (themeMode === 'high_contrast') {
      return {
        bg: 'bg-white',
        headerBg: 'bg-white/95 border-slate-200',
        cardBg: 'bg-white border-slate-200 text-slate-950 hover:border-cyan-500/60',
        modalBg: 'bg-white border-slate-200 text-slate-950',
        subPanelBg: 'bg-white border-slate-200 text-slate-950',
        accentText: 'text-cyan-700 font-bold',
        accentBg: 'bg-cyan-600 hover:bg-cyan-500 text-white font-bold',
        border: 'border-slate-200',
        badge: 'bg-slate-100 text-slate-900 border border-slate-200 font-medium',
        input: 'bg-white border border-slate-300 text-slate-950 placeholder-slate-400 focus:border-cyan-600',
        btnSecondary: 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 hover:text-slate-950',
        textMuted: 'text-slate-600'
      };
    }
    return {
      bg: 'bg-[#070b12]',
      headerBg: 'bg-[#0c121e]/95 border-slate-800',
      cardBg: 'bg-[#0f1726] border-slate-800 hover:border-cyan-500/50',
      modalBg: 'bg-[#0c1322] border-slate-700 text-slate-100',
      subPanelBg: 'bg-[#070d18] border-slate-800 text-slate-200',
      accentText: 'text-cyan-400',
      accentBg: 'bg-cyan-600 hover:bg-cyan-500 text-white',
      border: 'border-slate-800',
      badge: 'bg-slate-800/80 text-slate-200 border border-slate-700',
      input: 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400',
      btnSecondary: 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white',
      textMuted: 'text-slate-500'
    };
  };

  const currentTheme = getThemeStyles();
  const primaryText = themeMode === 'red' ? 'text-red-200' : themeMode === 'high_contrast' ? 'text-slate-950' : 'text-white';
  const hoverText = themeMode === 'high_contrast' ? 'hover:text-slate-950' : 'hover:text-white';

  const getFontSizeStyles = () => {
    switch (fontSize) {
      case 'sm':
        return { root: 'text-[15px] leading-relaxed', cardTitle: 'text-2xl', cardSub: 'text-[16px]', header: 'text-[15px]', button: 'text-[15px] font-semibold' };
      case 'md':
        return { root: 'text-[20px] leading-relaxed', cardTitle: 'text-3xl', cardSub: 'text-[19px]', header: 'text-[18px]', button: 'text-[17px] font-bold' };
      case 'lg':
        return { root: 'text-[22px] leading-loose', cardTitle: 'text-4xl', cardSub: 'text-xl', header: 'text-xl', button: 'text-lg font-black' };
      default:
        return { root: 'text-[18px] leading-relaxed', cardTitle: 'text-[28px]', cardSub: 'text-[18px]', header: 'text-[17px]', button: 'text-[16px] font-semibold' };
    }
  };

  const fontStyle = getFontSizeStyles();

  // Wikipedia 安全解析，純字串過濾杜絕正規表達式 TS1161 報錯
  const cleanWikiText = (raw: string) => {
    return raw.replace(/\[\d+\]/g, '').replace(/\[註\s*\d+\]/g, '').trim();
  };

  const toTraditional = (text: string) => text.replace(/[舰号现时间队装战计划态驱护导远标属区军萨连锡东无阳义庆济宁沈长门级国台湾产厂发后备录称试验编]/g, char => ({
    舰: '艦', 号: '號', 现: '現', 时: '時', 间: '間', 队: '隊', 装: '裝', 战: '戰', 计: '計', 划: '畫', 态: '態', 驱: '驅', 护: '護', 导: '導', 远: '遠', 标: '標',
    属: '屬', 区: '區', 军: '軍', 萨: '薩', 连: '連', 锡: '錫', 东: '東', 无: '無', 阳: '陽', 义: '義', 庆: '慶', 济: '濟', 宁: '寧', 沈: '瀋', 长: '長', 门: '門', 级: '級', 国: '國', 台: '臺', 湾: '灣', 产: '產', 厂: '廠', 发: '發', 后: '後', 备: '備', 录: '錄', 称: '稱', 试: '試', 验: '驗', 编: '編'
  }[char] || char));

  const fetchWikiDocument = async (query: string) => {
    const response = await fetch(`/api/wiki?title=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '維基資料擷取失敗');
    return {
      resolvedTitle: data.title as string,
      doc: new DOMParser().parseFromString(data.html || '', 'text/html')
    };
  };

  const handleFetchWikiForComparison = async (queryOverride?: string) => {
    const query = (queryOverride ?? wikiQuery).trim();
    if (!query) return alert('請輸入艦型關鍵字（例: 052D）');
    setIsFetchingWiki(true);
    setWikiPreviewClass(null);

    try {
      let input = query;
      if (input.includes('wikipedia.org/wiki/')) {
        input = decodeURIComponent(input.split('wikipedia.org/wiki/')[1].split('?')[0].split('#')[0]);
      }
      const { resolvedTitle, doc } = await fetchWikiDocument(input);

      let imgUrl = '';
      const firstImg = doc.querySelector('table.infobox img') || doc.querySelector('.thumbimage') || doc.querySelector('img');
      if (firstImg) {
        let src = firstImg.getAttribute('src') || '';
        if (src.startsWith('//')) src = `https:${src}`;
        imgUrl = src.replace(/\/thumb(\/.*)\/[^\/]+$/, '$1');
      }

      const getVal = (keywords: string[]) => {
        const rows = Array.from(doc.querySelectorAll('table.infobox tr'));
        for (const row of rows) {
          const th = row.querySelector('th')?.textContent?.trim() || '';
          if (keywords.some(k => th.includes(k))) {
            const td = row.querySelector('td');
            if (td) {
              const clone = td.cloneNode(true) as HTMLElement;
              clone.querySelectorAll('br').forEach(b => b.replaceWith('\n'));
              clone.querySelectorAll('li').forEach(l => l.append('\n'));
              return cleanWikiText(clone.textContent || '').slice(0, 500);
            }
          }
        }
        return '';
      };

      let overviewP = '';
      for (const p of Array.from(doc.querySelectorAll('p'))) {
        const txt = cleanWikiText(p.textContent || '');
        if (txt.length > 50) { overviewP = txt; break; }
      }

      const codeMatch = resolvedTitle.match(/([0-9A-Za-z\-]+)(?:型|級)/);
      const extractedCode = codeMatch ? codeMatch[1] : input;

      const previewData: Partial<ShipClass> = {
        code: extractedCode.toUpperCase(),
        name_zh: resolvedTitle,
        category: getVal(['艦種', '舰种']) || ((doc.body.textContent || '').includes('巡防艦') ? '巡防艦' : '驅逐艦'),
        current_status: getVal(['目前狀態', '目前状态', '服役狀態', '服役状态']),
        image_url: imgUrl,
        overview: overviewP,
        displacement: getVal(['排水量', '排水']),
        length: getVal(['全長', '全长', '長度']),
        beam: getVal(['型寬', '寬度', '舷寬']),
        draft: getVal(['吃水']),
        power_output: getVal(['功率', '輸出', '出力']),
        propulsion: getVal(['動力方式', '主機']),
        max_speed: getVal(['最高速度', '航速']),
        crew: getVal(['乘員', '定員']),
        radar_systems: getVal(['搜索系統', '偵搜系統', '偵蒐系統', '侦搜系统', '侦蒐系统', '雷達', '雷达']),
        weapons_summary: getVal(['武器系統', '武器']),
        electronic_warfare: getVal(['電戰系統', '電子戰']),
        aircraft: getVal(['艦載機', '直升機'])
      };

      setWikiPreviewClass(previewData);
      alert(`已成功解析維基條目【${resolvedTitle}】！請檢視下方的現有與新資料對照預覽。`);
    } catch (err: any) {
      alert(`擷取失敗: ${err.message || '連線逾時'}`);
    } finally {
      setIsFetchingWiki(false);
    }
  };

  const handleConfirmSaveClass = async () => {
    if (!supabase || !editingClassForm.code) return;
    const cid = `c-${editingClassForm.code.toLowerCase().trim()}`;
    const payload = {
      ...editingClassForm,
      id: cid,
      code: editingClassForm.code.trim().toUpperCase(),
      identification_updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('ship_classes').upsert([payload]);
    if (error) return alert(`儲存失敗: ${error.message}`);

    alert(`艦型【${payload.code}】資料已成功寫入雲端與本機！`);
    setShowAdmin(false);
    setWikiPreviewClass(null);
    await fetchData();
  };

  const handleFetchWikiForShip = async () => {
    if (!shipWikiQuery.trim()) return alert('請輸入單艦維基關鍵字或網址');
    setIsFetchingShipWiki(true);
    try {
      let input = shipWikiQuery.trim();
      if (input.includes('wikipedia.org/wiki/')) {
        input = decodeURIComponent(input.split('wikipedia.org/wiki/')[1].split('?')[0].split('#')[0]);
      }
      const { resolvedTitle, doc } = await fetchWikiDocument(input);
      const getVal = (keywords: string[]) => {
        for (const row of Array.from(doc.querySelectorAll('table.infobox tr'))) {
          const th = row.querySelector('th')?.textContent?.trim() || '';
          if (keywords.some(k => th.includes(k))) {
            const td = row.querySelector('td');
            if (td) return cleanWikiText(td.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
          }
        }
        return '';
      };
      const extractedShips: Array<{ hull_number: string; name_zh: string; commissioned_year: string; commission_precision: 'exact' | 'year' | 'unknown'; fleet: string; squadron: string; status_code: Ship['status_code'] }> = [];
      for (const table of Array.from(doc.querySelectorAll('table'))) {
        const rows = Array.from(table.querySelectorAll('tr'));
        const headerRowIndex = rows.findIndex(row => {
          const rowText = toTraditional(cleanWikiText(row.textContent || '').replace(/\s+/g, ' '));
          return /舷號|艦號/.test(rowText) && /艦名|名稱/.test(rowText);
        });
        if (headerRowIndex < 0) continue;
        const headers = Array.from(rows[headerRowIndex].querySelectorAll('th,td')).map(cell => toTraditional(cleanWikiText(cell.textContent || '').replace(/\s+/g, ' ')));
        const indexOf = (patterns: RegExp[]) => headers.findIndex(header => patterns.some(pattern => pattern.test(header)));
        const hullIndex = indexOf([/舷號/, /艦號/, /編號/]);
        const nameIndex = indexOf([/艦名/, /名稱/]);
        const commissionedIndex = indexOf([/服役時間/, /服役日期/, /入役/, /服役/]);
        const fleetIndex = indexOf([/所屬艦隊/, /艦隊/]);
        const squadronIndex = indexOf([/所屬支隊/, /支隊/]);
        const statusIndex = indexOf([/現狀/, /現況/, /狀態/]);
        for (const row of rows.slice(headerRowIndex + 1)) {
          const cells = Array.from(row.querySelectorAll('th,td')).map(cell => toTraditional(cleanWikiText(cell.textContent || '').replace(/\s+/g, ' ').trim()));
          const hull = (hullIndex >= 0 ? cells[hullIndex] : cells.find(value => /^\d{2,4}[A-Za-z啟]?[-A-Za-z]*$/.test(value))) || '';
          if (!hull || cells.length < 2) continue;
          const name = (nameIndex >= 0 ? cells[nameIndex] : cells.find(value => value && value !== hull && !/^\d{4}/.test(value))) || '';
          if (!name) continue;
          const commissioned = commissionedIndex >= 0 ? cells[commissionedIndex] || '' : '';
          // Wikipedia tables often use rowspan/colspan, so the visual column index can drift.
          // Prefer the declared status column, but fall back to scanning the whole row for a known status keyword.
          const indexedStatusText = statusIndex >= 0 ? cells[statusIndex] || '' : '';
          const rowStatusText = cells.join(' ');
          const hasKnownStatus = (value: string) => /現役|服役中|退役|除役|海試|航行試驗|試航|計畫|規劃|建造中|建造|舾裝中|舾裝|改裝中|改裝/.test(value);
          const statusText = hasKnownStatus(indexedStatusText) ? indexedStatusText : rowStatusText;
          const statusCode: Ship['status_code'] =
            /退役|除役/.test(statusText) ? 'retired' :
            /海試|航行試驗|試航/.test(statusText) ? 'sea_trial' :
            /舾裝中|舾裝/.test(statusText) ? 'fitting_out' :
            /改裝中|改裝/.test(statusText) ? 'refit' :
            /建造中|建造/.test(statusText) ? 'under_construction' :
            /計畫|規劃/.test(statusText) ? 'planned' :
            /現役|服役中/.test(statusText) ? 'active' : 'unknown';
          if (!extractedShips.some(ship => ship.hull_number === hull)) extractedShips.push({ hull_number: hull, name_zh: name, commissioned_year: commissioned, commission_precision: /\d{4}(?:-|年)\d{1,2}(?:-|月)\d{1,2}日?/.test(commissioned) ? 'exact' : /\d{4}/.test(commissioned) ? 'year' : 'unknown', fleet: fleetIndex >= 0 ? cells[fleetIndex] || '' : '', squadron: squadronIndex >= 0 ? cells[squadronIndex] || '' : '', status_code: statusCode });
        }
      }
      setWikiShipBatch(extractedShips);
      const hull = getVal(['舷號', '舷号', '艦號', '舰号', '編號', '编号']) || (resolvedTitle.match(/\b\d{2,4}\b/)?.[0] || '');
      const name = getVal(['艦名', '舰名']) || resolvedTitle;
      const commissioned = getVal(['服役日期', '服役時間', '服役时间', '入役', '服役']);
      const statusText = getVal(['目前狀態', '目前状态', '服役狀態', '服役状态', '艦況', '舰况']);
      const statusCode = statusText.includes('退役') ? 'retired' : statusText.includes('海試') || statusText.includes('海试') || statusText.includes('航行試驗') || statusText.includes('航行试验') || statusText.includes('試航') || statusText.includes('试航') ? 'sea_trial' : statusText.includes('計畫') || statusText.includes('计划') ? 'planned' : statusText.includes('建造') ? 'under_construction' : statusText.includes('舾裝') || statusText.includes('舾装') ? 'fitting_out' : statusText.includes('改裝') || statusText.includes('改装') ? 'refit' : statusText.includes('現役') || statusText.includes('现役') || statusText.includes('服役') ? 'active' : 'unknown';
      const precision = /\d{4}(?:-|年)\d{1,2}(?:-|月)\d{1,2}日?/.test(commissioned) ? 'exact' : /\d{4}/.test(commissioned) ? 'year' : 'unknown';
      const classCode = resolvedTitle.match(/([0-9A-Za-z-]+)(?:型|級)/)?.[1] || input.match(/[0-9A-Za-z-]+/)?.[0] || '';
      const matchedClass = classes.find(item => item.code.toLowerCase() === classCode.toLowerCase());
      const firstImportedShip = extractedShips[0];
      setNewShipForm(prev => ({ ...prev, class_id: matchedClass?.id || prev.class_id, hull_number: firstImportedShip?.hull_number || hull, name_zh: firstImportedShip?.name_zh || name, commissioned_year: firstImportedShip?.commissioned_year || commissioned, commission_precision: firstImportedShip?.commission_precision || precision, fleet: firstImportedShip?.fleet || prev.fleet, squadron: firstImportedShip?.squadron || prev.squadron, status_code: firstImportedShip?.status_code || statusCode }));
      alert(extractedShips.length > 0 ? `已找到【${extractedShips.length}】艘本級艦艇，請檢視下方列表後匯入。` : `已成功解析單艦維基條目【${resolvedTitle}】！請檢查下方資料後儲存。`);
    } catch (err: any) {
      alert(`擷取失敗: ${err.message || '連線逾時'}`);
    } finally {
      setIsFetchingShipWiki(false);
    }
  };

  const handleImportShipBatch = async () => {
    if (!supabase || wikiShipBatch.length === 0) return;
    const selectedClass = classes.find(item => item.id === newShipForm.class_id) || classes.find(item => newShipForm.class_id && item.code.toLowerCase() === newShipForm.class_id.toLowerCase());
    if (!selectedClass) return alert('請先選擇要匯入的所屬艦型');
    const shiftedLegacyIds = ships
      .filter(existing => existing.class_id === selectedClass.id && wikiShipBatch.some(imported => imported.name_zh === existing.hull_number))
      .map(existing => existing.id);
    if (shiftedLegacyIds.length > 0) {
      const { error: cleanupError } = await supabase.from('ships').delete().in('id', shiftedLegacyIds);
      if (cleanupError) return alert(`清理舊有錯位資料失敗: ${cleanupError.message}`);
    }
    const { error } = await supabase.from('ships').upsert(wikiShipBatch.map(ship => ({
      id: `s-${ship.hull_number}`,
      class_id: selectedClass.id,
      hull_number: ship.hull_number,
      name_zh: ship.name_zh,
      commissioned_year: ship.commissioned_year,
      commission_precision: ship.commission_precision,
      fleet: ship.fleet,
      squadron: ship.squadron,
      status_code: ship.status_code,
      status: getStatusLabel(ship.status_code).label
    })));
    if (error) return alert(`匯入本級單艦失敗: ${error.message}`);
    alert(`已匯入【${wikiShipBatch.length}】艘單艦至【${selectedClass.code}】名冊！`);
    setWikiShipBatch([]);
    await fetchData();
  };

  const openClassEditor = (classDetail: ShipClass, importWiki = false) => {
    setEditingClassForm({ ...editingClassForm, ...classDetail });
    setWikiQuery(classDetail.code);
    setAdminActiveTab('class_edit');
    setSelectedClassDetail(null);
    setShowAdmin(true);
    if (importWiki) void handleFetchWikiForComparison(classDetail.code);
  };

  const openShipEditor = (ship: Ship) => {
    setEditingShipId(ship.id);
    setNewShipForm({
      class_id: ship.class_id,
      hull_number: ship.hull_number,
      name_zh: ship.name_zh,
      commissioned_year: ship.commissioned_year || '',
      commission_precision: ship.commission_precision || 'year',
      fleet: ship.fleet || '',
      squadron: ship.squadron || '',
      status_code: ship.status_code || 'unknown'
    });
    setAdminActiveTab('ship_add');
    setSelectedClassDetail(null);
    setShowAdmin(true);
  };

  const handleDeleteEditingShip = async () => {
    if (!isAuthenticated || !editingShipId || !supabase) return;
    const confirmed = window.confirm(`確定要刪除單艦「${newShipForm.hull_number} ${newShipForm.name_zh}」嗎？\n此操作無法復原。`);
    if (!confirmed) return;
    const { error } = await supabase.from('ships').delete().eq('id', editingShipId);
    if (error) return alert(`刪除單艦失敗: ${error.message}`);
    alert(`單艦【${newShipForm.hull_number} ${newShipForm.name_zh}】已刪除。`);
    setEditingShipId(null);
    setShowAdmin(false);
    await fetchData();
  };

  const handleDeleteSelectedShips = async () => {
    if (!isAuthenticated || selectedShipIds.length === 0 || !supabase) return;
    const selectedShips = ships.filter(ship => selectedShipIds.includes(ship.id));
    const preview = selectedShips.slice(0, 5).map(ship => `${ship.hull_number} ${ship.name_zh}`).join('、');
    const remaining = selectedShips.length > 5 ? `，另 ${selectedShips.length - 5} 艘` : '';
    const confirmed = window.confirm(`確定要刪除已勾選的 ${selectedShipIds.length} 艘單艦嗎？\n${preview}${remaining}\n此操作無法復原。`);
    if (!confirmed) return;
    const { error } = await supabase.from('ships').delete().in('id', selectedShipIds);
    if (error) return alert(`批次刪除單艦失敗: ${error.message}`);
    alert(`已刪除 ${selectedShipIds.length} 艘單艦。`);
    setSelectedShipIds([]);
    if (editingShipId && selectedShipIds.includes(editingShipId)) setEditingShipId(null);
    await fetchData();
  };

  const handleDeleteSelectedClass = async () => {
    if (!isAuthenticated || !selectedClassDetail || !supabase) return;
    const confirmed = window.confirm(`確定要刪除艦型「${selectedClassDetail.code} ${selectedClassDetail.name_zh}」嗎？\n此操作會一併刪除本級艦艇資料，且無法復原。`);
    if (!confirmed) return;
    const { error: shipsError } = await supabase.from('ships').delete().eq('class_id', selectedClassDetail.id);
    if (shipsError) return alert(`刪除本級艦艇失敗: ${shipsError.message}`);
    const { error } = await supabase.from('ship_classes').delete().eq('id', selectedClassDetail.id);
    if (error) return alert(`刪除艦型失敗: ${error.message}`);
    setDetailMenuOpen(false);
    setSelectedClassDetail(null);
    await fetchData();
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput.trim() === '750120') {
      setIsAuthenticated(true);
      localStorage.setItem('tn_admin_auth', 'true');
      setShowPasswordModal(false);
      setShowAdmin(true);
    } else {
      alert('通行密碼錯誤！');
      setAdminPasswordInput('');
    }
  };

  return (
    <div
      className={`shipid-app w-full min-h-screen ${currentTheme.bg} ${themeMode === 'red' ? 'text-red-300' : themeMode === 'high_contrast' ? 'text-slate-950' : 'text-slate-100'} flex flex-col items-center select-none ${fontStyle.root} transition-colors duration-300`}
      onTouchStart={(e) => {
        const isHome = activeBottomTab === 'classes' && !selectedClassDetail && !showAdmin && !showMoreModal;
        if (!isHome || window.scrollY > 0 || isPullRefreshing) return;
        pullStartY.current = e.touches[0].clientY;
        setPullRefreshDone(false);
      }}
      onTouchMove={(e) => {
        if (pullStartY.current === null || window.scrollY > 0 || isPullRefreshing) return;
        const dy = e.touches[0].clientY - pullStartY.current;
        if (dy > 0) setPullDistance(Math.min(110, dy * 0.55));
      }}
      onTouchEnd={async () => {
        if (pullStartY.current === null) return;
        pullStartY.current = null;
        if (pullDistance >= 72 && !isPullRefreshing) {
          setIsPullRefreshing(true);
          setPullDistance(72);
          try {
            // 直接重抓 Supabase / App 最新資料，不做整頁 reload，保留 PWA 體驗。
            await fetchData();
            setPullRefreshDone(true);
          } finally {
            setIsPullRefreshing(false);
            window.setTimeout(() => {
              setPullDistance(0);
              setPullRefreshDone(false);
            }, 650);
          }
        } else {
          setPullDistance(0);
        }
      }}
    >
      <style>{`
        .shipid-app .text-xs { font-size: ${fontSize === 'sm' ? '14px' : fontSize === 'md' ? '17px' : fontSize === 'lg' ? '19px' : '16px'} !important; line-height: 1.55 !important; }
        .shipid-app .text-sm { font-size: ${fontSize === 'sm' ? '15px' : fontSize === 'md' ? '18px' : fontSize === 'lg' ? '20px' : '17px'} !important; line-height: 1.55 !important; }
        .shipid-app .text-base { font-size: ${fontSize === 'sm' ? '16px' : fontSize === 'md' ? '19px' : fontSize === 'lg' ? '21px' : '18px'} !important; line-height: 1.6 !important; }
        .shipid-app input, .shipid-app select, .shipid-app textarea { font-size: ${fontSize === 'sm' ? '15px' : fontSize === 'md' ? '18px' : fontSize === 'lg' ? '20px' : '17px'} !important; }
        .shipid-app nav span { font-size: ${fontSize === 'sm' ? '14px' : fontSize === 'md' ? '17px' : fontSize === 'lg' ? '19px' : '16px'} !important; }

        @media (max-width: 767px) {
          .shipid-app .shipid-top-header {
            padding-top: calc(env(safe-area-inset-top, 0px) + 18px) !important;
          }
          @media (display-mode: browser) {
            .shipid-app .shipid-top-header {
              padding-top: max(14px, env(safe-area-inset-top, 0px)) !important;
            }
          }
          .shipid-app .shipid-brand-subtitle {
            margin-top: 7px;
            font-size: 10px !important;
            line-height: 1 !important;
            letter-spacing: 0.18em;
            opacity: 0.72;
          }
          .shipid-app .shipid-brand-title {
            transform: scaleY(1.12);
            transform-origin: left center;
            line-height: 1;
            margin-top: 3px;
            margin-bottom: 3px;
          }
          .shipid-app .shipid-mobile-header {
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .shipid-app .shipid-mobile-brand {
            min-width: 0 !important;
            flex: 1 1 auto !important;
          }
          .shipid-app .shipid-mobile-brand-meta {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            gap: 4px 10px !important;
            margin-top: 6px !important;
          }
          .shipid-app .shipid-mobile-status,
          .shipid-app .shipid-mobile-version {
            white-space: nowrap !important;
          }
          .shipid-app .shipid-mobile-actions {
            flex: 0 0 auto !important;
            gap: 6px !important;
          }
          .shipid-app .shipid-mobile-actions button {
            min-width: 46px !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }
          .shipid-app .shipid-mobile-preset {
            white-space: nowrap !important;
            word-break: keep-all !important;
          }
          .shipid-app main {
            padding-bottom: 190px !important;
          }
        }

        @media (min-width: 768px) {
          .shipid-app .shipid-brand-subtitle {
            margin-top: 6px;
            font-size: 11px !important;
            letter-spacing: 0.2em;
          }
          .shipid-app .shipid-kicker { font-size: ${fontSize === 'sm' ? '14px' : fontSize === 'md' ? '17px' : fontSize === 'lg' ? '19px' : '16px'} !important; }
        }
      `}</style>
      {(pullDistance > 2 || isPullRefreshing || pullRefreshDone) && activeBottomTab === 'classes' && !selectedClassDetail && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full border shadow-xl backdrop-blur-md font-bold text-sm ${currentTheme.modalBg}`}
          style={{
            top: `calc(env(safe-area-inset-top, 0px) + 8px)`,
            transform: `translate(-50%, ${Math.min(pullDistance, 72)}px)`,
            transition: isPullRefreshing ? 'transform 160ms ease-out' : undefined
          }}
        >
          {pullRefreshDone
            ? '✓ 資料已更新'
            : isPullRefreshing
              ? '↻ 正在更新資料…'
              : pullDistance >= 72
                ? '↻ 放開重新整理'
                : '↓ 下拉重新整理'}
        </div>
      )}
      
      {/* 戰術抬頭列 */}
      <header className={`shipid-top-header w-full ${currentTheme.headerBg} border-b backdrop-blur-md px-4 pt-6 md:pt-8 pb-5 flex flex-col items-center shadow-lg transition-all`}>
        <div className="w-full max-w-md md:max-w-[1480px] grid grid-cols-[minmax(0,1fr)_auto] md:flex md:justify-between md:items-center gap-x-3 gap-y-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className={`w-2.5 h-2.5 shrink-0 rounded-full ${themeMode === 'red' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : isOnline ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`}></span>
              <div className="min-w-0">
                <h1 className="shipid-brand-title font-black tracking-[0.11em] text-[22px] sm:text-2xl md:text-[30px] font-mono whitespace-nowrap">TAIWAN NAVY</h1>
                <div className={`shipid-brand-subtitle font-mono font-semibold uppercase whitespace-nowrap ${currentTheme.textMuted}`}>
                  VESSEL IDENTIFICATION SYSTEM
                </div>
              </div>
            </div>

            {/* Desktop 狀態列：維持原本位置 */}
            <div className={`hidden md:flex text-xs font-mono ${themeMode === 'red' ? 'text-red-500' : 'text-slate-400'} items-center gap-1.5 pt-0.5`}>
              {isOnline ? (
                <span className={themeMode === 'red' ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>✓ 離線資料已就緒</span>
              ) : (
                <span className={themeMode === 'red' ? 'text-red-400 font-black' : 'text-amber-400 font-black'}>● OFFLINE · 使用本機資料</span>
              )}
              <span className={currentTheme.textMuted}>| {CURRENT_APP_VERSION}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasUpdateAvailable && (
              <button
                type="button"
                onClick={handleForceUpdateApp}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs animate-bounce flex items-center gap-1.5 shadow-lg"
                title="點擊立即更新至最新版面"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <span>新版就緒</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const next: ThemeMode = themeMode === 'dark' ? 'red' : themeMode === 'red' ? 'high_contrast' : 'dark';
                setThemeMode(next);
                localStorage.setItem('tn_theme_mode', next);
              }}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl ${currentTheme.btnSecondary} active:scale-95 transition`}
              title="切換顯示主題"
            >
              {themeMode === 'red' ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
                </svg>
              ) : themeMode === 'high_contrast' ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                const list: FontSizeOption[] = ['sm', 'default', 'md', 'lg'];
                const next = list[(list.indexOf(fontSize) + 1) % list.length];
                setFontSize(next);
                localStorage.setItem('tn_font_size', next);
              }}
              className={`shipid-mobile-preset min-w-[56px] md:min-w-[44px] min-h-[44px] px-2.5 rounded-xl ${currentTheme.btnSecondary} font-bold text-xs flex items-center justify-center whitespace-nowrap break-keep active:scale-95 transition`}
              title="切換字體大小"
            >
              {fontSize === 'sm' ? '小字' : fontSize === 'default' ? '預設' : fontSize === 'md' ? '中字' : '大字'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (isAuthenticated) setShowAdmin(true);
                else setShowPasswordModal(true);
              }}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl ${currentTheme.btnSecondary} active:scale-95 transition`}
              title="資料庫後台"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Mobile 狀態列：獨立佔滿第二列，不再與右側按鈕搶寬度 */}
          <div className={`md:hidden col-span-2 w-full text-xs font-mono ${themeMode === 'red' ? 'text-red-500' : 'text-slate-400'} flex flex-wrap items-center gap-x-2 gap-y-1 pt-1`}>
            {isOnline ? (
              <span className={`${themeMode === 'red' ? 'text-red-400' : 'text-emerald-400'} font-bold whitespace-nowrap`}>✓ 離線資料已就緒</span>
            ) : (
              <span className={`${themeMode === 'red' ? 'text-red-400' : 'text-amber-400'} font-black whitespace-nowrap`}>● OFFLINE · 使用本機資料</span>
            )}
            <span className={`${currentTheme.textMuted} whitespace-nowrap`}>| {CURRENT_APP_VERSION}</span>
          </div>
        </div>

        {bannerText && (
          <div className={`w-full max-w-md md:max-w-[1480px] mt-3 px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${themeMode === 'red' ? 'bg-[#1e0508] border-red-800 text-red-200' : themeMode === 'high_contrast' ? 'bg-white border-sky-200 text-sky-800' : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-200'}`}>
            <span className={`w-2 h-2 rounded-full ${themeMode === 'red' ? 'bg-red-500' : 'bg-cyan-400'} animate-ping`}></span>
            <span className="flex-1">{bannerText}</span>
          </div>
        )}
      </header>

      {/* 主內容區 */}
      <main className="w-full max-w-md md:max-w-[1480px] px-4 md:px-8 pt-5 md:pt-9 pb-48 flex flex-col flex-1 gap-5">
        {(activeBottomTab === 'classes' || activeBottomTab === 'favorites') && (
          <>
            {searchTerm && matchingShips.length > 0 && (
              <div className={`p-3.5 rounded-2xl border space-y-2 ${themeMode === 'red' ? 'bg-[#180407] border-red-950 text-red-200' : themeMode === 'high_contrast' ? 'bg-white border-sky-200 text-slate-950' : 'bg-cyan-950/40 border-cyan-500/40'}`}>
                <div className={`text-xs font-mono font-bold uppercase ${currentTheme.accentText}`}>
                  配對舷號與單艦 ({matchingShips.length})
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {matchingShips.map(s => {
                    const parentClass = classes.find(c => c.id === s.class_id);
                    const statusMeta = getStatusLabel(s.status_code, s.status);
                    return (
                      <div
                        key={s.id}
                        onClick={() => parentClass && handleOpenDetail(parentClass)}
                        className={`p-3 rounded-xl border flex justify-between items-center cursor-pointer transition ${currentTheme.subPanelBg} hover:border-red-600`}
                      >
                        <div className="flex items-baseline gap-2.5">
                          <span className={`font-mono text-xl font-black ${currentTheme.accentText}`}>{s.hull_number}</span>
                          <span className={`font-bold text-base ${primaryText}`}>{s.name_zh}</span>
                          {parentClass && <span className={`text-xs font-mono ${currentTheme.textMuted}`}>({parentClass.code})</span>}
                        </div>
                        <span className={`text-xs px-2.5 py-0.5 rounded-md font-bold border ${statusMeta.color}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <section className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-center px-1">
                <span className={`text-xs md:text-sm font-mono font-bold tracking-wider uppercase ${currentTheme.textMuted}`}>
                  {activeBottomTab === 'favorites' ? `我的最愛 (${displayedClasses.length})` : `作戰艦型清單 (${displayedClasses.length})`}
                </span>
              </div>

              {isLoading ? (
                <div className={`text-center py-20 font-mono text-xs animate-pulse ${currentTheme.textMuted}`}>
                  載入離線艦艇資料庫中...
                </div>
              ) : displayedClasses.length === 0 ? (
                <div className={`text-center py-16 rounded-2xl border border-dashed text-xs ${currentTheme.subPanelBg}`}>
                  查無符合條件的艦艇資料
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-5">
                {displayedClasses.map(c => {
                  const isFav = favorites.includes(c.id);
                  const classShips = ships.filter(s => s.class_id === c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleOpenDetail(c)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenDetail(c); } }}
                      role="button"
                      tabIndex={0}
                      className={`group relative min-w-0 overflow-hidden rounded-2xl border cursor-pointer transition-all duration-200 shadow-sm hover:shadow-xl hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${currentTheme.cardBg}`}
                    >
                      <div className={`absolute inset-y-0 left-0 w-1 ${themeMode === 'red' ? 'bg-red-700' : themeMode === 'high_contrast' ? 'bg-cyan-700' : 'bg-cyan-500'}`} />
                      <div className="p-4 md:p-6 pl-5 md:pl-7 flex flex-col gap-4 min-h-[176px]">
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className={`shipid-kicker text-[14px] font-mono tracking-[0.14em] uppercase mb-2 ${currentTheme.textMuted}`}>
                              SHIP CLASS / {c.category}
                            </div>
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                              <span className={`font-mono font-black tracking-tight ${fontStyle.cardTitle} ${currentTheme.accentText}`}>{c.code}</span>
                              <span className={`font-bold break-words ${primaryText} ${fontStyle.cardSub}`}>{c.name_zh}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            aria-label={isFav ? '取消收藏' : '加入收藏'}
                            onClick={e => toggleFavorite(c.id, e)}
                            className={`shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl border active:scale-95 transition ${currentTheme.btnSecondary}`}
                          >
                            <StarIcon isFilled={isFav} isRedMode={themeMode === 'red'} />
                          </button>
                        </div>
                        {(c.identification_features?.length ?? 0) > 0 && (
                          <div
                            className="-mt-1 -mx-1 px-1 flex items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(c.identification_features ?? []).slice(0, 3).map((feature, index) => (
                              <span
                                key={`${c.id}-feature-${index}`}
                                title={feature}
                                className={`shrink-0 max-w-[72%] px-2.5 py-1 rounded-lg border text-[13px] sm:text-sm font-medium truncate ${
                                  themeMode === 'red'
                                    ? 'border-red-800/70 bg-red-950/35 text-red-200'
                                    : themeMode === 'high_contrast'
                                      ? 'border-sky-500 bg-sky-50 text-slate-950'
                                      : 'border-cyan-700/60 bg-cyan-950/25 text-cyan-100'
                                }`}
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className={`mt-auto pt-3 border-t flex flex-wrap items-center gap-x-3 gap-y-2 ${currentTheme.border}`}>
                          {c.nato_code && <span className={`px-2.5 py-1 rounded-md font-mono text-base ${currentTheme.badge}`}>{c.nato_code}</span>}
                          <span className={`text-base font-medium ${primaryText}`}>登錄 {classShips.length} 艘</span>
                          {c.identification_status === 'verified' && <span className={themeMode === 'red' ? 'text-red-400 text-base font-bold' : 'text-emerald-400 text-base font-bold'}>✓ 已查證</span>}
                          <span className={`ml-auto text-base font-bold ${currentTheme.accentText} whitespace-nowrap`}>查看資料 →</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </section>
          </>
        )}

        {/* TAB 3：比對分頁 */}
        {activeBottomTab === 'compare' && (() => {
          const shipA = classes.find(c => c.id === comparePool[0]);
          const shipB = classes.find(c => c.id === comparePool[1]);

          return (
            <div className="space-y-4">
              <div className={`flex justify-between items-center border-b pb-2 px-1 ${currentTheme.border}`}>
                <div>
                  <span className={`text-xs font-mono font-bold tracking-wider uppercase block ${currentTheme.textMuted}`}>雙艦戰術數據比對</span>
                  <span className={`text-[11px] ${currentTheme.textMuted}`}>並排對照外觀特徵與作戰指標</span>
                </div>
                {comparePool.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setComparePool([]);
                      localStorage.removeItem('tn_compare_pool');
                    }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${themeMode === 'red' ? 'bg-[#25070d] border-red-900 text-red-300' : themeMode === 'high_contrast' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/40 border-red-900/60 text-red-400'}`}
                  >
                    重置比對池
                  </button>
                )}
              </div>

              {comparePool.length < 2 ? (
                <div className={`p-8 text-center rounded-2xl border border-dashed space-y-3 ${currentTheme.subPanelBg}`}>
                  <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center text-lg font-mono ${currentTheme.btnSecondary}`}>
                    {comparePool.length}/2
                  </div>
                  <div className="space-y-1">
                    <p className={`font-bold text-sm ${primaryText}`}>比對池尚未選滿 2 艘艦艇</p>
                    <p className={`text-xs leading-relaxed ${currentTheme.textMuted}`}>請回「艦型清單」點選艦艇卡片進入詳細頁，按下「＋加入比對」即可啟動雙艦同屏比對！</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveBottomTab('classes')}
                    className={`min-h-[44px] px-5 rounded-xl font-bold text-xs shadow-md transition ${currentTheme.accentBg}`}
                  >
                    前往艦型清單挑選
                  </button>
                </div>
              ) : shipA && shipB ? (
                <div className="space-y-3 text-xs">
                  {(shipA.identification_features?.length || shipB.identification_features?.length) ? (
                    <div className={`p-4 rounded-2xl border space-y-2.5 ${themeMode === 'red' ? 'bg-[#180407] border-red-950' : themeMode === 'high_contrast' ? 'bg-white border-sky-200' : 'bg-cyan-950/30 border-cyan-500/40'}`}>
                      <span className={`font-bold text-sm flex items-center gap-2 border-b pb-1.5 ${currentTheme.accentText} ${currentTheme.border}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        主要外觀辨識特徵對照
                      </span>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <span className={`font-mono font-bold block ${currentTheme.accentText}`}>{shipA.code}:</span>
                          {shipA.identification_features?.map((f, i) => (
                            <div key={i} className={`text-xs leading-snug ${primaryText}`}>• {f}</div>
                          )) || <span className={`${currentTheme.textMuted} italic`}>無人工辨識資料</span>}
                        </div>
                        <div className={`space-y-1 border-l pl-3 ${currentTheme.border}`}>
                          <span className={`font-mono font-bold block ${currentTheme.accentText}`}>{shipB.code}:</span>
                          {shipB.identification_features?.map((f, i) => (
                            <div key={i} className={`text-xs leading-snug ${primaryText}`}>• {f}</div>
                          )) || <span className={`${currentTheme.textMuted} italic`}>無人工辨識資料</span>}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <div className={`p-4 rounded-2xl border space-y-3.5 ${currentTheme.cardBg}`}>
                    <div className={`grid grid-cols-2 gap-3 text-center border-b pb-3 ${currentTheme.border}`}>
                      <div>
                        <span className={`font-mono text-2xl font-black block ${currentTheme.accentText}`}>{shipA.code}</span>
                        <span className={`font-bold text-sm ${primaryText}`}>{shipA.name_zh}</span>
                      </div>
                      <div className={`border-l pl-3 ${currentTheme.border}`}>
                        <span className={`font-mono text-2xl font-black block ${currentTheme.accentText}`}>{shipB.code}</span>
                        <span className={`font-bold text-sm ${primaryText}`}>{shipB.name_zh}</span>
                      </div>
                    </div>

                    {[
                      { label: '排水量', valA: shipA.displacement, valB: shipB.displacement },
                      { label: '全長構型', valA: shipA.length, valB: shipB.length },
                      { label: '型寬', valA: shipA.beam, valB: shipB.beam },
                      { label: '最高航速', valA: shipA.max_speed, valB: shipB.max_speed },
                      { label: '動力方式', valA: shipA.propulsion, valB: shipB.propulsion },
                      { label: '搜索雷達/聲納', valA: shipA.radar_systems, valB: shipB.radar_systems },
                      { label: '武器系統', valA: shipA.weapons_summary, valB: shipB.weapons_summary },
                      { label: '艦載直升機', valA: shipA.aircraft, valB: shipB.aircraft },
                    ].map((row, idx) => (
                      <div key={idx} className={`border-b pb-2.5 ${currentTheme.border}`}>
                        <span className={`font-bold block mb-1 text-[11px] ${currentTheme.textMuted}`}>{row.label}</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div>{renderFormattedList(row.valA)}</div>
                          <div className={`border-l pl-3 ${currentTheme.border}`}>{renderFormattedList(row.valB)}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setComparePool([]);
                      localStorage.removeItem('tn_compare_pool');
                    }}
                    className={`w-full min-h-[44px] rounded-xl font-bold ${currentTheme.btnSecondary}`}
                  >
                    清空比對池
                  </button>
                </div>
              ) : null}
            </div>
          );
        })()}
      </main>

      {/* 底部戰術控制底座 */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center pointer-events-none">
        {(activeBottomTab === 'classes' || activeBottomTab === 'favorites') && (
          <div className="w-full max-w-md md:max-w-4xl px-4 pb-2 pointer-events-auto">
            <div className="relative flex items-center shadow-2xl">
              <svg className={`w-5 h-5 absolute left-3.5 pointer-events-none ${currentTheme.textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="搜尋舷號、艦名或艦型 (例: 172、052D)..."
                value={searchTerm}
                onChange={e => handleExecuteSearch(e.target.value)}
                className={`w-full min-h-[50px] rounded-2xl pl-11 pr-10 text-base font-semibold shadow-2xl transition focus:outline-none ${currentTheme.input}`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className={`absolute right-2 min-w-[44px] min-h-[44px] flex items-center justify-center ${currentTheme.textMuted} ${hoverText}`}
                >
                  ✕
                </button>
              )}
            </div>

            {!searchTerm && recentSearches.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1.5">
                <span className={`text-[11px] font-mono shrink-0 ${currentTheme.textMuted}`}>快搜:</span>
                {recentSearches.map(term => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleSelectRecentSearch(term)}
                    className={`px-2.5 py-1 rounded-lg backdrop-blur border text-xs font-mono shrink-0 shadow-sm ${currentTheme.badge}`}
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <nav className={`w-full ${currentTheme.headerBg} border-t backdrop-blur-xl flex justify-center shadow-2xl pointer-events-auto`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}>
          <div className="w-full max-w-md md:max-w-4xl flex justify-around items-center px-3 py-2.5 text-base font-bold">
            <button
              type="button"
              onClick={() => setActiveBottomTab('classes')}
              className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition ${activeBottomTab === 'classes' ? currentTheme.accentText : currentTheme.textMuted}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span>艦型</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveBottomTab('favorites')}
              className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition ${activeBottomTab === 'favorites' ? (themeMode === 'red' ? 'text-red-400 font-black' : 'text-amber-400') : currentTheme.textMuted}`}
            >
              <svg className="w-5 h-5" fill={activeBottomTab === 'favorites' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <span>收藏</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveBottomTab('compare')}
              className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition ${activeBottomTab === 'compare' ? currentTheme.accentText : currentTheme.textMuted}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              <span>比對 ({comparePool.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMoreModal('update')}
              className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition relative ${currentTheme.textMuted} ${hoverText}`}
            >
              {hasUpdateAvailable && (
                <span className="absolute top-1 right-5 w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
              )}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              <span>更多</span>
            </button>
          </div>
        </nav>
      </div>

      {/* 「更多」抽屜視窗 */}
      {showMoreModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+12px)] sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowMoreModal(null); }}
        >
          <div
            className={`w-full max-w-md h-[64dvh] min-h-[500px] max-h-[640px] border rounded-[24px] sm:rounded-3xl p-5 flex flex-col gap-4 overflow-hidden shadow-2xl ${currentTheme.modalBg}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex justify-between items-center border-b pb-3 ${currentTheme.border}`}>
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-bold text-base whitespace-nowrap">資訊與系統設定</h3>
                <a
                  href={`mailto:pkddqq@gmail.com?subject=${encodeURIComponent('TAIWAN NAVY 使用者意見')}`}
                  className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-bold ${currentTheme.btnSecondary}`}
                >
                  提供問題或意見
                </a>
              </div>
              <button type="button" onClick={() => setShowMoreModal(null)} className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${currentTheme.textMuted} ${hoverText}`}>✕</button>
            </div>

            <div ref={moreTabsRef} className={`grid grid-cols-4 gap-1 p-1.5 rounded-xl text-sm font-bold ${currentTheme.subPanelBg}`}>
              <button data-more-tab="update" type="button" onClick={() => setShowMoreModal('update')} className={`px-2 py-2 rounded-lg min-w-0 whitespace-nowrap ${showMoreModal === 'update' ? currentTheme.accentBg : currentTheme.textMuted}`}>版面更新</button>
              <button data-more-tab="rankings" type="button" onClick={() => setShowMoreModal('rankings')} className={`px-2 py-2 rounded-lg min-w-0 whitespace-nowrap ${showMoreModal === 'rankings' ? currentTheme.accentBg : currentTheme.textMuted}`}>查詢統計</button>
              <button data-more-tab="guide" type="button" onClick={() => setShowMoreModal('guide')} className={`px-2 py-2 rounded-lg min-w-0 whitespace-nowrap ${showMoreModal === 'guide' ? currentTheme.accentBg : currentTheme.textMuted}`}>離線說明</button>
              <button data-more-tab="sources" type="button" onClick={() => setShowMoreModal('sources')} className={`px-2 py-2 rounded-lg min-w-0 whitespace-nowrap ${showMoreModal === 'sources' ? currentTheme.accentBg : currentTheme.textMuted}`}>資料來源</button>
            </div>

            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-0.5"
              onTouchStart={(e) => {
                moreTabSwipeStartX.current = e.touches[0].clientX;
                moreTabSwipeStartY.current = e.touches[0].clientY;
              }}
              onTouchEnd={(e) => {
                if (moreTabSwipeStartX.current === null || moreTabSwipeStartY.current === null) return;
                const dx = e.changedTouches[0].clientX - moreTabSwipeStartX.current;
                const dy = e.changedTouches[0].clientY - moreTabSwipeStartY.current;
                moreTabSwipeStartX.current = null;
                moreTabSwipeStartY.current = null;
                if (Math.abs(dx) < 55 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
                const tabs: Array<'update' | 'rankings' | 'guide' | 'sources'> = ['update', 'rankings', 'guide', 'sources'];
                const currentIndex = tabs.indexOf(showMoreModal as 'update' | 'rankings' | 'guide' | 'sources');
                if (currentIndex < 0) return;
                const direction = dx < 0 ? 1 : -1;
                const nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
                setShowMoreModal(tabs[nextIndex]);
              }}
              onTouchCancel={() => {
                moreTabSwipeStartX.current = null;
                moreTabSwipeStartY.current = null;
              }}
            >
            {showMoreModal === 'update' && (
              <div className={`space-y-4 p-5 rounded-2xl border text-base ${currentTheme.subPanelBg}`}>
                <div className={`flex justify-between items-center border-b pb-2 ${currentTheme.border}`}>
                  <span className={currentTheme.textMuted}>版本：</span>
                  <span className={`font-mono font-bold ${currentTheme.accentText}`}>{CURRENT_APP_VERSION}</span>
                </div>
                <div className="space-y-2 leading-relaxed">
                  <p className="font-bold">為什麼有時候畫面沒有更新？</p>
                  <p className={currentTheme.textMuted}>為了確保在斷網時能照常運作，手機會自動將畫面鎖存在本機快取中。若雲端發布了新版面但畫面卡住，可點擊下方按鈕強制清除本機快取並刷新。</p>
                </div>
                
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleForceUpdateApp}
                  className={`w-full min-h-[48px] rounded-xl font-bold text-sm shadow-lg active:scale-95 transition flex items-center justify-center gap-2 ${currentTheme.accentBg}`}
                >
                  {isUpdating ? (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      正在清除快取並載入...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      強制清除快取並更新至最新版面
                    </span>
                  )}
                </button>
              </div>
            )}

            {showMoreModal === 'rankings' && (
              <div className="space-y-5 text-xs">
                <section className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h4 className={`font-black text-sm ${currentTheme.accentText}`}>全站查詢排行</h4>
                    <span className={currentTheme.textMuted}>{isOnline ? 'ALL DEVICES · TOP 10' : 'OFFLINE · 本機快取'}</span>
                  </div>
                  {classes
                    .slice()
                    .sort((a, b) => ((isOnline ? globalQueryCounts : queryCounts)[b.id] || 0) - ((isOnline ? globalQueryCounts : queryCounts)[a.id] || 0))
                    .slice(0, 10)
                    .map((c, idx) => (
                      <div key={c.id} className={`p-2.5 rounded-xl border flex justify-between items-center ${currentTheme.subPanelBg}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-mono font-bold shrink-0 ${currentTheme.textMuted}`}>#{idx + 1}</span>
                          <span className={`font-mono font-bold shrink-0 ${currentTheme.accentText}`}>{c.code}</span>
                          <span className="truncate">{c.name_zh}</span>
                        </div>
                        <span className={`font-mono font-bold shrink-0 ml-2 ${currentTheme.textMuted}`}>{(isOnline ? globalQueryCounts : queryCounts)[c.id] || 0} 次</span>
                      </div>
                    ))}
                </section>

                <section className={`space-y-2 border-t pt-4 ${currentTheme.border}`}>
                  <div className="flex items-center justify-between px-1">
                    <h4 className={`font-black text-sm ${currentTheme.accentText}`}>全站每月統計</h4>
                    <span className={currentTheme.textMuted}>{isOnline ? 'ALL DEVICES · 近 10 個月' : 'OFFLINE · 本機快取'}</span>
                  </div>
                  {Object.keys(isOnline ? globalMonthlyUsage : monthlyUsage).sort().reverse().slice(0, 10).map(m => (
                    <div key={m} className={`p-2.5 rounded-xl border flex justify-between items-center ${currentTheme.subPanelBg}`}>
                      <span className="font-mono">{m}</span>
                      <span className={`font-mono font-bold ${currentTheme.accentText}`}>{(isOnline ? globalMonthlyUsage : monthlyUsage)[m]} 次查詢</span>
                    </div>
                  ))}
                </section>
              </div>
            )}

            {showMoreModal === 'guide' && (
              <div className={`space-y-2 text-xs leading-relaxed p-3.5 rounded-2xl border ${currentTheme.subPanelBg}`}>
                <p>1. iOS Safari 點選「分享」按鈕 ➔ 選擇「加入主畫面」，即可安裝為獨立 App；Android 手機亦可透過瀏覽器選單「加入主畫面」安裝。</p>
                <p>2. 本系統以離線使用為核心設計。首次連線時，請滑動瀏覽各級艦艇一次，即可建立 <strong>180 天離線資料庫</strong>，供後續斷網期間查詢使用。</p>
                <p>3. 任務斷網期間，<strong>切勿手動清除瀏覽器快取、網站資料或瀏覽紀錄</strong>，否則可能導致已儲存的離線資料遭移除。</p>
              </div>
            )}

            {showMoreModal === 'sources' && (
              <div className={`space-y-2 text-xs leading-relaxed p-3.5 rounded-2xl border ${currentTheme.subPanelBg}`}>
                <p>• 技術資料主要依據維基百科公開資料庫與國際公開軍事智庫手冊。</p>
                <p>• 外觀辨識特徵一律由管理員人工輸入查證，未驗證者均清楚標註。</p>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* 授權驗證 Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-xs border rounded-3xl p-6 shadow-2xl space-y-4 text-center ${currentTheme.modalBg}`}>
            <h3 className="font-bold text-base">後台管理通行驗證</h3>
            <form onSubmit={handleVerifyPassword} className="space-y-3">
              <input
                type="password"
                required
                maxLength={10}
                placeholder="請輸入 6 位授權碼"
                value={adminPasswordInput}
                onChange={e => setAdminPasswordInput(e.target.value)}
                className={`w-full min-h-[48px] rounded-xl text-center text-xl font-mono tracking-widest focus:outline-none ${currentTheme.input}`}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className={`flex-1 min-h-[44px] rounded-xl text-xs font-bold ${currentTheme.btnSecondary}`}>取消</button>
                <button type="submit" className={`flex-1 min-h-[44px] rounded-xl text-xs font-bold ${currentTheme.accentBg}`}>確認驗證</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 詳細頁 Modal · Desktop V3 */}
      {selectedClassDetail && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center px-2.5 pb-2.5 pt-[calc(env(safe-area-inset-top,0px)+10px)] sm:p-4 lg:p-6 transition-colors duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDetailMenuOpen(false);
              setSelectedClassDetail(null);
            }
          }}
        >
          <div
            className={`relative w-full sm:w-[96vw] lg:w-[90vw] xl:w-[88vw] max-w-[1560px] h-[calc(100dvh-env(safe-area-inset-top,0px)-22px)] sm:h-[92vh] border rounded-[24px] sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden ${currentTheme.modalBg} ${detailDragging ? '' : 'transition-transform duration-200 ease-out'}`}
            style={{
              transform: `translateX(${detailDragX}px)`,
              opacity: Math.max(0.72, 1 - detailDragX / 900)
            }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              detailTouchStartX.current = touch.clientX;
              detailTouchStartY.current = touch.clientY;
              setDetailDragging(false);
            }}
            onTouchMove={(e) => {
              if (detailTouchStartX.current === null || detailTouchStartY.current === null) return;
              const touch = e.touches[0];
              const dx = touch.clientX - detailTouchStartX.current;
              const dy = touch.clientY - detailTouchStartY.current;

              // 只接管明確的向右水平手勢，保留上下捲動。
              if (dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.25) {
                setDetailDragging(true);
                setDetailDragX(Math.max(0, dx));
              }
            }}
            onTouchEnd={(e) => {
              if (detailTouchStartX.current === null || detailTouchStartY.current === null) return;
              const touch = e.changedTouches[0];
              const dx = touch.clientX - detailTouchStartX.current;
              const dy = touch.clientY - detailTouchStartY.current;
              detailTouchStartX.current = null;
              detailTouchStartY.current = null;

              const shouldDismiss =
                dx >= 100 &&
                Math.abs(dx) > Math.abs(dy) * 1.25;

              if (shouldDismiss) {
                setDetailDragX(window.innerWidth);
                window.setTimeout(() => {
                  setDetailMenuOpen(false);
                  setSelectedClassDetail(null);
                  setDetailDragX(0);
                  setDetailDragging(false);
                }, 180);
              } else {
                setDetailDragX(0);
                setDetailDragging(false);
              }
            }}
            onTouchCancel={() => {
              detailTouchStartX.current = null;
              detailTouchStartY.current = null;
              setDetailDragX(0);
              setDetailDragging(false);
            }}
          >
            {detailDragging && detailDragX > 24 && (
              <div
                className="md:hidden fixed left-4 top-1/2 -translate-y-1/2 z-[60] px-3 py-2 rounded-full bg-black/55 backdrop-blur text-white/90 text-sm font-bold pointer-events-none"
                style={{ opacity: Math.min(1, detailDragX / 100) }}
              >
                ‹ 返回
              </div>
            )}
            <div className={`px-5 lg:px-8 py-4 lg:py-5 border-b flex justify-between items-center shrink-0 ${currentTheme.border}`}>
              <div className="flex items-center gap-3 lg:gap-4 min-w-0">
                <span className={`font-mono text-2xl md:text-3xl lg:text-4xl font-black ${currentTheme.accentText}`}>{selectedClassDetail.code}</span>
                <span className="font-black text-base md:text-xl lg:text-2xl truncate">{selectedClassDetail.name_zh}</span>
              </div>
              <div className="relative">
                <button type="button" onClick={() => setDetailMenuOpen(prev => !prev)} aria-label="小卡功能選單" className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl border font-black text-xl ${currentTheme.btnSecondary}`}>⋯</button>
                {detailMenuOpen && (
                  <div className={`absolute right-0 top-[calc(100%+0.5rem)] z-10 w-36 rounded-xl border p-1.5 shadow-xl ${currentTheme.modalBg}`}>
                    {isAuthenticated && (<><button type="button" onClick={() => { setDetailMenuOpen(false); openClassEditor(selectedClassDetail); }} className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold ${currentTheme.btnSecondary}`}>編輯</button><button type="button" onClick={handleDeleteSelectedClass} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold text-red-400 hover:bg-red-950/40">刪除</button></>)}
                    <button type="button" onClick={() => { setDetailMenuOpen(false); setSelectedClassDetail(null); }} className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-bold ${currentTheme.btnSecondary}`}>關閉</button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 lg:p-8 overflow-y-auto space-y-5 lg:space-y-7 text-[16px] lg:text-[18px] leading-relaxed">
              <div className="space-y-4">
                {selectedClassDetail.image_url ? (
                  <div className={`w-full h-52 sm:h-72 lg:h-[430px] xl:h-[500px] rounded-2xl lg:rounded-3xl overflow-hidden border bg-black ${currentTheme.border} ${themeMode === 'red' ? 'brightness-75 contrast-125 sepia hue-rotate-[320deg]' : ''}`}>
                    <img src={selectedClassDetail.image_url} alt={selectedClassDetail.name_zh} className="w-full h-full object-cover object-center" />
                  </div>
                ) : <div className={`w-full h-32 rounded-2xl border border-dashed flex items-center justify-center ${currentTheme.subPanelBg} ${currentTheme.textMuted}`}>暫無艦影照片</div>}

                <div className="flex flex-row justify-between items-start gap-2 pt-1">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-2xl lg:text-3xl font-black tracking-tight leading-tight">{selectedClassDetail.name_zh}</h2>
                    <p className={`text-sm lg:text-base font-mono mt-1 ${currentTheme.textMuted}`}>{selectedClassDetail.nato_code} · {selectedClassDetail.category}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => toggleCompare(selectedClassDetail.id)} className={`min-h-[48px] px-3 sm:px-4 lg:px-5 rounded-xl font-bold text-sm lg:text-base whitespace-nowrap transition active:scale-95 ${comparePool.includes(selectedClassDetail.id) ? currentTheme.accentBg : currentTheme.btnSecondary}`}>{comparePool.includes(selectedClassDetail.id) ? '已加入比對' : '＋加入比對'}</button>
                    <button type="button" onClick={() => toggleFavorite(selectedClassDetail.id)} className={`min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl border ${currentTheme.btnSecondary}`}><StarIcon isFilled={favorites.includes(selectedClassDetail.id)} isRedMode={themeMode === 'red'} /></button>
                  </div>
                </div>

                {selectedClassDetail.overview && <p className={`text-[16px] lg:text-[19px] p-4 lg:p-5 rounded-2xl border leading-[1.8] text-justify ${currentTheme.subPanelBg}`}>{selectedClassDetail.overview}</p>}
              </div>

              <div className={`p-4 lg:p-6 rounded-2xl lg:rounded-3xl border space-y-4 ${currentTheme.subPanelBg}`}>
                <div className={`flex justify-between items-center border-b pb-3 ${currentTheme.border}`}>
                  <span className={`font-black text-xl lg:text-2xl flex items-center gap-2 ${currentTheme.accentText}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>外觀辨識</span>
                  {getVerificationBadge(selectedClassDetail.identification_status)}
                </div>
                {selectedClassDetail.identification_features && selectedClassDetail.identification_features.length > 0 ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10 gap-y-3 lg:gap-y-4">
                    {selectedClassDetail.identification_features.map((feature, idx) => <div key={idx} className="flex items-start gap-3"><span className={`font-mono text-xl font-black ${currentTheme.accentText}`}>•</span><span className="font-semibold text-[16px] lg:text-[19px] leading-[1.65]">{feature}</span></div>)}
                  </div>
                ) : <p className={`py-1 italic ${currentTheme.textMuted}`}>目前尚未建立人工查證的外觀辨識資料</p>}
                {selectedClassDetail.identification_notes && <div className={`mt-3 pt-3 border-t text-sm lg:text-base ${currentTheme.border} ${currentTheme.textMuted}`}><span className="font-bold block mb-1">辨識附註：</span>{selectedClassDetail.identification_notes}</div>}
              </div>

              {selectedClassDetail.similar_classes && selectedClassDetail.similar_classes.length > 0 && (
                <div className={`p-4 lg:p-5 rounded-2xl border space-y-3 ${currentTheme.subPanelBg}`}><span className={`font-bold text-base lg:text-lg flex items-center gap-1.5 ${themeMode === 'red' ? 'text-red-400' : themeMode === 'high_contrast' ? 'text-amber-700' : 'text-amber-300'}`}>容易混淆艦型（點擊啟動比對）</span><div className="flex flex-wrap gap-2">{selectedClassDetail.similar_classes.map(targetCode => { const matched = classes.find(c => c.code.toLowerCase() === targetCode.toLowerCase()); return <button key={targetCode} type="button" onClick={() => { if (matched) { setComparePool([selectedClassDetail.id, matched.id]); setSelectedClassDetail(null); setActiveBottomTab('compare'); } else alert(`資料庫中暫無【${targetCode}】之完整參數`); }} className={`min-h-[46px] px-4 rounded-xl border font-mono font-bold text-sm lg:text-base ${currentTheme.btnSecondary}`}>{targetCode} <span className={currentTheme.textMuted}>➔ 比對</span></button>; })}</div></div>
              )}

              <div className={`p-4 lg:p-6 rounded-2xl lg:rounded-3xl border space-y-5 ${currentTheme.cardBg}`}>
                <span className={`font-black text-xl lg:text-2xl block border-b pb-3 ${currentTheme.border}`}>技術規格與裝備參數</span>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
                  {[
                    ['艦種', selectedClassDetail.category], ['目前狀態', selectedClassDetail.current_status],
                    ['排水量', selectedClassDetail.displacement], ['長度', selectedClassDetail.length],
                    ['型寬', selectedClassDetail.beam], ['吃水', selectedClassDetail.draft],
                    ['動力方式', selectedClassDetail.propulsion], ['動力輸出', selectedClassDetail.power_output],
                    ['最高速度', selectedClassDetail.max_speed], ['乘員', selectedClassDetail.crew]
                  ].map(([label, value]) => <div key={label as string} className={`p-3 lg:p-4 rounded-xl border ${currentTheme.subPanelBg}`}><span className={`block text-sm lg:text-[15px] font-bold mb-1 ${currentTheme.textMuted}`}>{label}</span><div className="text-[16px] lg:text-[18px]">{renderFormattedList(value as string | undefined)}</div></div>)}
                </div>
                {[
                  ['搜索／偵搜系統（雷達／聲納）', selectedClassDetail.radar_systems], ['武器系統', selectedClassDetail.weapons_summary], ['電戰系統', selectedClassDetail.electronic_warfare], ['艦載機', selectedClassDetail.aircraft]
                ].map(([label, value]) => <div key={label as string} className={`p-3 lg:p-4 rounded-xl border ${currentTheme.subPanelBg}`}><span className={`block text-sm lg:text-[15px] font-bold mb-1.5 ${currentTheme.textMuted}`}>{label}</span><div className="text-[16px] lg:text-[18px]">{renderFormattedList(value as string | undefined)}</div></div>)}
              </div>

              <div className="space-y-3">
                <button type="button" onClick={() => setExpandedShipList(!expandedShipList)} className={`w-full min-h-[54px] px-4 lg:px-5 rounded-xl border flex justify-between items-center text-base lg:text-lg font-bold ${currentTheme.subPanelBg}`}><span>本級艦各艇名冊 ({ships.filter(s => s.class_id === selectedClassDetail.id).length} 艘)</span><span className={`font-mono ${currentTheme.accentText}`}>{expandedShipList ? '▲ 收合' : '▼ 展開'}</span></button>
                {expandedShipList && <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">{ships.filter(s => s.class_id === selectedClassDetail.id).map(s => { const statusMeta = getStatusLabel(s.status_code, s.status); return <div key={s.id} className={`relative p-4 lg:p-5 rounded-xl border shadow-sm ${currentTheme.subPanelBg}`}><div className="flex justify-between items-center gap-3"><div className="flex items-baseline gap-3"><span className={`font-mono text-2xl lg:text-3xl font-black ${currentTheme.accentText}`}>{s.hull_number}</span><span className={`font-bold text-lg ${primaryText}`}>{s.name_zh}</span></div><span className={`text-sm px-3 py-1 rounded-md font-bold border ${statusMeta.color}`}>{statusMeta.label}</span></div><div className={`text-sm lg:text-base space-y-1.5 mt-3 pt-3 border-t ${currentTheme.border}`}><div><span className={currentTheme.textMuted}>服役時間：</span><span className="font-mono">{s.commissioned_year || '未載明'}</span></div><div><span className={currentTheme.textMuted}>編屬部隊：</span>{s.fleet || '未載明'}{s.squadron && ` · ${s.squadron}`}</div></div>{isAuthenticated && <button type="button" onClick={() => openShipEditor(s)} className={`mt-3 min-h-[42px] px-4 rounded-lg text-sm font-bold border ${currentTheme.btnSecondary}`}>編輯單艦</button>}</div>; })}</div>}
              </div>

              <div className={`p-4 rounded-xl border text-sm lg:text-base space-y-1.5 ${currentTheme.subPanelBg}`}><div>資料來源：{selectedClassDetail.identification_source || 'Wikipedia 公開軍事情報資料庫'}</div><div>最後維護：{selectedClassDetail.identification_updated_at ? new Date(selectedClassDetail.identification_updated_at).toLocaleDateString('zh-TW') : CURRENT_APP_VERSION}</div><div>查證狀態：{selectedClassDetail.identification_status === 'verified' ? '已通過人工確認' : '尚待人工複核'}</div></div>
            </div>
          </div>
        </div>
      )}

      {/* 資料庫管理後台 Modal */}
      {showAdmin && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center px-2.5 pb-2.5 pt-[calc(env(safe-area-inset-top,0px)+10px)] sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdmin(false); }}
        >
          <div
            className={`w-full max-w-lg md:max-w-5xl h-[calc(100dvh-env(safe-area-inset-top,0px)-22px)] sm:h-[88vh] border rounded-[24px] sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden ${currentTheme.modalBg} ${panelDragging ? '' : 'transition-transform duration-200 ease-out'}`}
            style={{ transform: `translateX(${panelDragX}px)`, opacity: Math.max(0.72, 1 - panelDragX / 900) }}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => { panelSwipeStartX.current=e.touches[0].clientX; panelSwipeStartY.current=e.touches[0].clientY; setPanelDragging(false); }}
            onTouchMove={(e) => {
              if (panelSwipeStartX.current===null || panelSwipeStartY.current===null) return;
              const dx=e.touches[0].clientX-panelSwipeStartX.current;
              const dy=e.touches[0].clientY-panelSwipeStartY.current;
              if (dx>8 && Math.abs(dx)>Math.abs(dy)*1.25) { setPanelDragging(true); setPanelDragX(Math.max(0,dx)); }
            }}
            onTouchEnd={(e) => {
              if (panelSwipeStartX.current===null || panelSwipeStartY.current===null) return;
              const dx=e.changedTouches[0].clientX-panelSwipeStartX.current;
              const dy=e.changedTouches[0].clientY-panelSwipeStartY.current;
              panelSwipeStartX.current=null; panelSwipeStartY.current=null;
              if (dx>=100 && Math.abs(dx)>Math.abs(dy)*1.25) {
                setPanelDragX(window.innerWidth);
                window.setTimeout(()=>{ setShowAdmin(false); setPanelDragX(0); setPanelDragging(false); },180);
              } else { setPanelDragX(0); setPanelDragging(false); }
            }}
            onTouchCancel={()=>{ panelSwipeStartX.current=null; panelSwipeStartY.current=null; setPanelDragX(0); setPanelDragging(false); }}
          >
            <div className={`px-5 py-4 border-b flex justify-between items-center shrink-0 ${currentTheme.border}`}>
              <h2 className="font-bold text-base">資料庫管理與外觀特徵維護</h2>
              <button type="button" onClick={() => setShowAdmin(false)} className={`min-w-[44px] min-h-[44px] flex items-center justify-center ${currentTheme.textMuted} ${hoverText}`}>✕</button>
            </div>

            <div className={`flex border-b text-base font-bold p-1.5 mx-4 mt-3 rounded-xl gap-1 ${currentTheme.subPanelBg} ${currentTheme.border}`}>
              <button type="button" onClick={() => setAdminActiveTab('class_edit')} className={`flex-1 min-h-[44px] rounded-lg ${adminActiveTab === 'class_edit' ? currentTheme.accentBg : currentTheme.textMuted}`}>艦型與外觀特徵</button>
              <button type="button" onClick={() => { setEditingShipId(null); setAdminActiveTab('ship_add'); }} className={`flex-1 min-h-[44px] rounded-lg ${adminActiveTab === 'ship_add' ? currentTheme.accentBg : currentTheme.textMuted}`}>單艦管理</button>
              <button type="button" onClick={() => { setAdminBannerInput(bannerText); setAdminActiveTab('banner'); }} className={`flex-1 min-h-[44px] rounded-lg ${adminActiveTab === 'banner' ? currentTheme.accentBg : currentTheme.textMuted}`}>廣播通報</button>
            </div>

            <div className="p-5 md:p-6 overflow-y-auto space-y-5 text-base">
              {adminActiveTab === 'class_edit' && (
                <div className="space-y-4">
                  <div className={`p-3.5 rounded-2xl border space-y-2.5 ${currentTheme.subPanelBg}`}>
                    <span className={`font-bold block ${currentTheme.accentText}`}>Wikipedia 資料比對與安全擷取</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="輸入艦型代號 (例: 052D)"
                        value={wikiQuery}
                        onChange={e => setWikiQuery(e.target.value)}
                        className={`flex-1 min-h-[44px] rounded-xl px-3 text-xs ${currentTheme.input}`}
                      />
                      <button
                        type="button"
                        disabled={isFetchingWiki}
                        onClick={() => handleFetchWikiForComparison()}
                        className={`min-h-[44px] px-3.5 font-bold rounded-xl active:scale-95 transition ${currentTheme.accentBg}`}
                      >
                        {isFetchingWiki ? '解析中...' : '擷取預覽'}
                      </button>
                    </div>

                    {wikiPreviewClass && (
                      <div className={`p-3 rounded-xl border space-y-2 mt-2 ${currentTheme.cardBg}`}>
                        <span className={`font-bold block ${currentTheme.accentText}`}>新擷取資料比對預覽：</span>
                        <div className="text-xs space-y-1">
                          <div>艦名：{wikiPreviewClass.name_zh}</div>
                          <div>排水量：{wikiPreviewClass.displacement}</div>
                          <div>長度/型寬：{wikiPreviewClass.length} / {wikiPreviewClass.beam}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingClassForm(prev => ({ ...prev, ...wikiPreviewClass }));
                            setWikiPreviewClass(null);
                            alert('已套用新擷取資料至下方表單，確認無誤後請點擊最下方儲存。');
                          }}
                          className={`min-h-[40px] w-full mt-2 rounded-lg font-bold ${currentTheme.accentBg}`}
                        >
                          確認套用至編輯表單（不覆蓋外觀特徵）
                        </button>
                      </div>
                    )}
                  </div>

                  <div className={`p-3.5 rounded-2xl border space-y-3 ${currentTheme.subPanelBg}`}>
                    <span className="font-bold text-sm block flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      外觀辨識特徵人工管理
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="輸入單項特徵 (例: 封閉式雙面相控陣主桅)"
                        value={tempFeatureInput}
                        onChange={e => setTempFeatureInput(e.target.value)}
                        className={`flex-1 min-h-[44px] rounded-xl px-3 text-xs ${currentTheme.input}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!tempFeatureInput.trim()) return;
                          const current = editingClassForm.identification_features || [];
                          setEditingClassForm({
                            ...editingClassForm,
                            identification_features: [...current, tempFeatureInput.trim()]
                          });
                          setTempFeatureInput('');
                        }}
                        className={`min-h-[44px] px-3.5 font-bold rounded-xl border ${currentTheme.btnSecondary}`}
                      >
                        ＋新增
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {(editingClassForm.identification_features ?? []).map((feat, idx) => (
                        <React.Fragment key={`${feat}-${idx}`}>
                          {idx === 3 && (
                            <div className={`flex items-center gap-2 py-1.5 text-[11px] font-bold ${currentTheme.textMuted}`}>
                              <span className={`h-px flex-1 ${themeMode === 'high_contrast' ? 'bg-sky-300' : 'bg-slate-700'}`} />
                              <span>↑ 首頁顯示前三項</span>
                              <span className={`h-px flex-1 ${themeMode === 'high_contrast' ? 'bg-sky-300' : 'bg-slate-700'}`} />
                            </div>
                          )}
                          <div
                            data-feature-index={idx}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs transition ${
                              draggingFeatureIndex === idx ? 'opacity-55 scale-[0.99]' : ''
                            } ${currentTheme.cardBg}`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (draggingFeatureIndex === null || draggingFeatureIndex === idx) return;
                              const features = [...(editingClassForm.identification_features ?? [])];
                              const [moved] = features.splice(draggingFeatureIndex, 1);
                              features.splice(idx, 0, moved);
                              setEditingClassForm({ ...editingClassForm, identification_features: features });
                              setDraggingFeatureIndex(idx);
                              featureDragCurrentIndex.current = idx;
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDraggingFeatureIndex(null);
                              featureDragStartY.current = null;
                              featureDragCurrentIndex.current = null;
                            }}
                          >
                            <button
                              type="button"
                              draggable
                              aria-label={`拖曳調整 ${feat} 的優先順序`}
                              title="按住拖曳調整順序"
                              onDragStart={(e) => {
                                setDraggingFeatureIndex(idx);
                                featureDragCurrentIndex.current = idx;
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragEnd={() => {
                                setDraggingFeatureIndex(null);
                                featureDragStartY.current = null;
                                featureDragCurrentIndex.current = null;
                              }}
                              onTouchStart={(e) => {
                                featureDragStartY.current = e.touches[0].clientY;
                                featureDragCurrentIndex.current = idx;
                                setDraggingFeatureIndex(idx);
                              }}
                              onTouchMove={(e) => {
                                if (featureDragStartY.current === null || featureDragCurrentIndex.current === null) return;
                                const touchY = e.touches[0].clientY;
                                const element = document.elementFromPoint(e.touches[0].clientX, touchY);
                                const row = element?.closest('[data-feature-index]') as HTMLElement | null;
                                if (!row) return;
                                const targetIndex = Number(row.dataset.featureIndex);
                                const currentIndex = featureDragCurrentIndex.current;
                                if (!Number.isFinite(targetIndex) || targetIndex === currentIndex) return;

                                const features = [...(editingClassForm.identification_features ?? [])];
                                const [moved] = features.splice(currentIndex, 1);
                                features.splice(targetIndex, 0, moved);
                                featureDragCurrentIndex.current = targetIndex;
                                setDraggingFeatureIndex(targetIndex);
                                setEditingClassForm(prev => ({ ...prev, identification_features: features }));
                              }}
                              onTouchEnd={() => {
                                setDraggingFeatureIndex(null);
                                featureDragStartY.current = null;
                                featureDragCurrentIndex.current = null;
                              }}
                              className={`shrink-0 min-w-[38px] min-h-[42px] rounded-lg border flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none text-lg tracking-[-0.15em] ${currentTheme.btnSecondary}`}
                            >
                              ≡
                            </button>

                            <span
                              data-feature-index={idx}
                              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-mono font-black ${
                                idx < 3
                                  ? (themeMode === 'red' ? 'bg-red-950 text-red-300 border border-red-700' : 'bg-cyan-950 text-cyan-300 border border-cyan-700')
                                  : currentTheme.badge
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span data-feature-index={idx} className="min-w-0 flex-1 break-words">{feat}</span>

                            <button
                              type="button"
                              onClick={() => {
                                const updated = (editingClassForm.identification_features ?? []).filter((_, i) => i !== idx);
                                setEditingClassForm({ ...editingClassForm, identification_features: updated });
                              }}
                              className="text-red-400 hover:text-red-300 px-2.5 min-h-[38px] font-bold shrink-0"
                            >
                              刪除
                            </button>
                          </div>
                        </React.Fragment>
                      ))}
                      {(editingClassForm.identification_features?.length ?? 0) > 0 && (
                        <p className={`px-1 pt-1 text-[11px] ${currentTheme.textMuted}`}>
                          按住左側 ≡ 上下拖曳調整優先順序；前 3 項會顯示在首頁艦型小卡。
                        </p>
                      )}
                    </div>

                    <div className={`grid grid-cols-2 gap-2 pt-2 border-t ${currentTheme.border}`}>
                      <div>
                        <label className={`block mb-1 ${currentTheme.textMuted}`}>查證狀態標籤</label>
                        <select
                          value={editingClassForm.identification_status}
                          onChange={e => setEditingClassForm({ ...editingClassForm, identification_status: e.target.value as any })}
                          className={`w-full min-h-[48px] rounded-xl px-3 text-sm ${currentTheme.input}`}
                        >
                          <option value="unverified">待查證</option>
                          <option value="incomplete">資料未完整</option>
                          <option value="verified">已查證</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block mb-1 ${currentTheme.textMuted}`}>情報資料來源</label>
                        <input
                          type="text"
                          placeholder="例: 人工戰情審查"
                          value={editingClassForm.identification_source || ''}
                          onChange={e => setEditingClassForm({ ...editingClassForm, identification_source: e.target.value })}
                          className={`w-full min-h-[44px] rounded-xl px-2.5 text-xs ${currentTheme.input}`}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={`block mb-1 ${currentTheme.textMuted}`}>艦型代號 (例: 052D)</label>
                        <input
                          required
                          value={editingClassForm.code || ''}
                          onChange={e => setEditingClassForm({ ...editingClassForm, code: e.target.value })}
                          className={`w-full min-h-[44px] rounded-xl px-3 font-mono ${currentTheme.input}`}
                        />
                      </div>
                      <div>
                        <label className={`block mb-1 ${currentTheme.textMuted}`}>艦型全名</label>
                        <input
                          required
                          value={editingClassForm.name_zh || ''}
                          onChange={e => setEditingClassForm({ ...editingClassForm, name_zh: e.target.value })}
                          className={`w-full min-h-[44px] rounded-xl px-3 ${currentTheme.input}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block mb-1 ${currentTheme.textMuted}`}>官方照片網址</label>
                      <input
                        type="url"
                        value={editingClassForm.image_url || ''}
                        onChange={e => setEditingClassForm({ ...editingClassForm, image_url: e.target.value })}
                        className={`w-full min-h-[44px] rounded-xl px-3 ${currentTheme.input}`}
                      />
                    </div>

                    <div>
                      <label className={`block mb-1 ${currentTheme.textMuted}`}>艦型概述</label>
                      <textarea
                        rows={3}
                        value={editingClassForm.overview || ''}
                        onChange={e => setEditingClassForm({ ...editingClassForm, overview: e.target.value })}
                        className={`w-full rounded-xl p-2.5 ${currentTheme.input}`}
                      />
                    </div>

                    <div className={`space-y-2 pt-2 border-t ${currentTheme.border}`}>
                      <span className="font-bold block">技術指標 (以 Shift+Enter 分項)</span>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea rows={2} placeholder="艦種" value={editingClassForm.category || ''} onChange={e => setEditingClassForm({ ...editingClassForm, category: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                        <textarea rows={2} placeholder="目前狀態" value={editingClassForm.current_status || ''} onChange={e => setEditingClassForm({ ...editingClassForm, current_status: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea rows={2} placeholder="排水量" value={editingClassForm.displacement || ''} onChange={e => setEditingClassForm({ ...editingClassForm, displacement: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                        <textarea rows={2} placeholder="長度" value={editingClassForm.length || ''} onChange={e => setEditingClassForm({ ...editingClassForm, length: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea rows={2} placeholder="型寬" value={editingClassForm.beam || ''} onChange={e => setEditingClassForm({ ...editingClassForm, beam: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                        <textarea rows={2} placeholder="吃水" value={editingClassForm.draft || ''} onChange={e => setEditingClassForm({ ...editingClassForm, draft: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea rows={2} placeholder="動力輸出" value={editingClassForm.power_output || ''} onChange={e => setEditingClassForm({ ...editingClassForm, power_output: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                        <textarea rows={2} placeholder="動力方式" value={editingClassForm.propulsion || ''} onChange={e => setEditingClassForm({ ...editingClassForm, propulsion: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea rows={2} placeholder="最高速度" value={editingClassForm.max_speed || ''} onChange={e => setEditingClassForm({ ...editingClassForm, max_speed: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                        <textarea rows={2} placeholder="乘員" value={editingClassForm.crew || ''} onChange={e => setEditingClassForm({ ...editingClassForm, crew: e.target.value })} className={`rounded-xl p-2 ${currentTheme.input}`} />
                      </div>
                      <textarea rows={3} placeholder="搜索／偵搜系統 (雷達/聲納)" value={editingClassForm.radar_systems || ''} onChange={e => setEditingClassForm({ ...editingClassForm, radar_systems: e.target.value })} className={`w-full rounded-xl p-2 ${currentTheme.input}`} />
                      <textarea rows={3} placeholder="武器系統" value={editingClassForm.weapons_summary || ''} onChange={e => setEditingClassForm({ ...editingClassForm, weapons_summary: e.target.value })} className={`w-full rounded-xl p-2 ${currentTheme.input}`} />
                      <textarea rows={3} placeholder="電戰系統" value={editingClassForm.electronic_warfare || ''} onChange={e => setEditingClassForm({ ...editingClassForm, electronic_warfare: e.target.value })} className={`w-full rounded-xl p-2 ${currentTheme.input}`} />
                      <textarea rows={3} placeholder="艦載機" value={editingClassForm.aircraft || ''} onChange={e => setEditingClassForm({ ...editingClassForm, aircraft: e.target.value })} className={`w-full rounded-xl p-2 ${currentTheme.input}`} />
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmSaveClass}
                      className={`w-full min-h-[48px] rounded-xl font-bold text-sm shadow-lg active:scale-95 transition ${currentTheme.accentBg}`}
                    >
                      儲存至雲端與本機資料庫
                    </button>
                  </div>
                </div>
              )}

              {adminActiveTab === 'ship_add' && (
                <form
                  onSubmit={async e => {
                    e.preventDefault();
                    if (!supabase) return;
                    const sid = editingShipId || `s-${newShipForm.hull_number.trim()}`;
                    const { error } = await supabase.from('ships').upsert([{
                      id: sid,
                      class_id: newShipForm.class_id,
                      hull_number: newShipForm.hull_number.trim(),
                      name_zh: newShipForm.name_zh.trim(),
                      commissioned_year: newShipForm.commissioned_year.trim(),
                      commission_precision: newShipForm.commission_precision,
                      fleet: newShipForm.fleet.trim(),
                      squadron: newShipForm.squadron.trim(),
                      status_code: newShipForm.status_code,
                      status: getStatusLabel(newShipForm.status_code).label
                    }]);
                    if (error) return alert(`新增單艦失敗: ${error.message}`);
                    alert(`單艦【${newShipForm.hull_number} ${newShipForm.name_zh}】已成功${editingShipId ? '修改' : '寫入'}！`);
                    setEditingShipId(null);
                    setShowAdmin(false);
                    await fetchData();
                  }}
                  className="space-y-3"
                >
                  <div className={`p-3.5 rounded-2xl border space-y-3 ${currentTheme.subPanelBg}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className={`font-bold block ${currentTheme.accentText}`}>批次管理單艦</span>
                        <span className={currentTheme.textMuted}>已勾選 {selectedShipIds.length}／{ships.length} 艘</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedShipIds(ships.map(ship => ship.id))}
                          className={`min-h-[40px] px-3 rounded-lg border font-bold ${currentTheme.btnSecondary}`}
                        >
                          全選
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedShipIds([])}
                          className={`min-h-[40px] px-3 rounded-lg border font-bold ${currentTheme.btnSecondary}`}
                        >
                          取消全選
                        </button>
                      </div>
                    </div>

                    <div className={`max-h-60 overflow-y-auto rounded-xl border divide-y ${currentTheme.border}`}>
                      {ships.length === 0 ? (
                        <div className={`p-4 text-center ${currentTheme.textMuted}`}>目前沒有單艦資料</div>
                      ) : ships.map(ship => {
                        const parentClass = classes.find(item => item.id === ship.class_id);
                        const checked = selectedShipIds.includes(ship.id);
                        return (
                          <label key={ship.id} className="min-h-[48px] px-3 py-2 flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setSelectedShipIds(prev => checked ? prev.filter(id => id !== ship.id) : [...prev, ship.id])}
                              className="w-5 h-5 accent-cyan-500 shrink-0"
                            />
                            <span className={`font-mono font-black ${currentTheme.accentText}`}>{ship.hull_number}</span>
                            <span className="font-bold flex-1">{ship.name_zh}</span>
                            <span className={`text-[11px] ${currentTheme.textMuted}`}>{parentClass?.code || '未分類'}</span>
                          </label>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      disabled={selectedShipIds.length === 0}
                      onClick={handleDeleteSelectedShips}
                      className="w-full min-h-[46px] rounded-xl border border-red-500/60 bg-red-950 text-red-200 font-bold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] transition"
                    >
                      刪除勾選的單艦（{selectedShipIds.length}）
                    </button>
                  </div>

                  <div className={`p-3.5 rounded-2xl border space-y-2.5 ${currentTheme.subPanelBg}`}>
                    <span className={`font-bold block ${currentTheme.accentText}`}>Wikipedia 單艦資料匯入</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="輸入單艦名稱、舷號或維基網址"
                        value={shipWikiQuery}
                        onChange={e => setShipWikiQuery(e.target.value)}
                        className={`flex-1 min-h-[44px] rounded-xl px-3 text-xs ${currentTheme.input}`}
                      />
                      <button
                        type="button"
                        disabled={isFetchingShipWiki}
                        onClick={handleFetchWikiForShip}
                        className={`min-h-[44px] px-3.5 font-bold rounded-xl active:scale-95 transition ${currentTheme.accentBg}`}
                      >
                        {isFetchingShipWiki ? '解析中...' : '匯入'}
                      </button>
                    </div>
                    {wikiShipBatch.length > 0 && (
                      <div className={`rounded-xl border p-3 space-y-2 ${currentTheme.cardBg}`}>
                        <div className="flex items-center justify-between">
                          <span className="font-bold">本級單艦列表預覽 ({wikiShipBatch.length})</span>
                          <button type="button" onClick={() => setWikiShipBatch([])} className={`text-xs ${currentTheme.textMuted}`}>清除</button>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1 text-xs">
                          {wikiShipBatch.map(ship => (
                            <div key={ship.hull_number} className="border-b last:border-0 py-1">
                              <div className="flex justify-between">
                                <span className="font-mono font-bold">{ship.hull_number}</span>
                                <span>{ship.name_zh}</span>
                              </div>
                              <div className={`text-[11px] ${currentTheme.textMuted}`}>
                                {ship.commissioned_year || '服役時間未載明'} · {ship.fleet || '艦隊未載明'}{ship.squadron ? ` · ${ship.squadron}` : ''} · {getStatusLabel(ship.status_code).label}
                              </div>
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={handleImportShipBatch} className={`w-full min-h-[42px] rounded-lg font-bold ${currentTheme.accentBg}`}>
                          匯入本級單艦列表
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={`block mb-1 ${currentTheme.textMuted}`}>所屬艦型</label>
                    <select
                      required
                      value={newShipForm.class_id}
                      onChange={e => setNewShipForm({ ...newShipForm, class_id: e.target.value })}
                      className={`w-full min-h-[44px] rounded-xl px-3 ${currentTheme.input}`}
                    >
                      <option value="">-- 請選擇所屬艦型 --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name_zh}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block mb-1 ${currentTheme.textMuted}`}>舷號 (例: 172)</label>
                      <input
                        required
                        value={newShipForm.hull_number}
                        onChange={e => setNewShipForm({ ...newShipForm, hull_number: e.target.value })}
                        className={`w-full min-h-[44px] rounded-xl px-3 font-mono ${currentTheme.input}`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-1 ${currentTheme.textMuted}`}>艦名 (例: 昆明)</label>
                      <input
                        required
                        value={newShipForm.name_zh}
                        onChange={e => setNewShipForm({ ...newShipForm, name_zh: e.target.value })}
                        className={`w-full min-h-[44px] rounded-xl px-3 ${currentTheme.input}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block mb-1 ${currentTheme.textMuted}`}>服役時間格式</label>
                      <select
                        value={newShipForm.commission_precision}
                        onChange={e => setNewShipForm({ ...newShipForm, commission_precision: e.target.value as any })}
                        className={`w-full min-h-[48px] rounded-xl px-3 text-sm ${currentTheme.input}`}
                      >
                        <option value="exact">完整年月日 (YYYY-MM-DD)</option>
                        <option value="year">僅年份 (YYYY)</option>
                        <option value="unknown">日期不明</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block mb-1 ${currentTheme.textMuted}`}>服役時間</label>
                      <input
                        placeholder={newShipForm.commission_precision === 'exact' ? '2014-03-21' : newShipForm.commission_precision === 'year' ? '2014' : '日期不明'}
                        value={newShipForm.commissioned_year}
                        onChange={e => setNewShipForm({ ...newShipForm, commissioned_year: e.target.value })}
                        className={`w-full min-h-[44px] rounded-xl px-3 font-mono ${currentTheme.input}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`block mb-1 ${currentTheme.textMuted}`}>所屬艦隊</label>
                      <input
                        placeholder="例: 南部戰區海軍"
                        value={newShipForm.fleet}
                        onChange={e => setNewShipForm({ ...newShipForm, fleet: e.target.value })}
                        className={`w-full min-h-[44px] rounded-xl px-3 ${currentTheme.input}`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-1 ${currentTheme.textMuted}`}>所屬支隊</label>
                      <input
                        placeholder="例: 驅逐艦第9支隊"
                        value={newShipForm.squadron}
                        onChange={e => setNewShipForm({ ...newShipForm, squadron: e.target.value })}
                        className={`w-full min-h-[44px] rounded-xl px-3 ${currentTheme.input}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block mb-1 ${currentTheme.textMuted}`}>標準化艦況 (Enum)</label>
                    <select
                      value={newShipForm.status_code}
                      onChange={e => setNewShipForm({ ...newShipForm, status_code: e.target.value as any })}
                      className={`w-full min-h-[48px] rounded-xl px-3 text-sm ${currentTheme.input}`}
                    >
                      <option value="active">現役</option>
                      <option value="retired">退役</option>
                      <option value="unknown">未知</option>
                      <option value="sea_trial">海試</option>
                      <option value="planned">計畫</option>
                      <option value="under_construction">建造中</option>
                      <option value="fitting_out">舾裝中</option>
                      <option value="refit">改裝中</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    {editingShipId && (
                      <button
                        type="button"
                        onClick={handleDeleteEditingShip}
                        className="min-h-[48px] px-5 rounded-xl border border-red-500/60 bg-red-950 text-red-200 font-bold text-sm active:scale-95 transition"
                      >
                        刪除單艦
                      </button>
                    )}
                    <button
                      type="submit"
                      className={`flex-1 min-h-[48px] rounded-xl font-bold text-sm shadow-lg active:scale-95 transition ${currentTheme.accentBg}`}
                    >
                      {editingShipId ? '儲存單艦修改' : '新增單艦履歷'}
                    </button>
                  </div>
                </form>
              )}

              {adminActiveTab === 'banner' && (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    placeholder="輸入訊息（清空儲存則自動隱藏）"
                    value={adminBannerInput}
                    onChange={e => setAdminBannerInput(e.target.value)}
                    className={`w-full rounded-xl p-3 ${currentTheme.input}`}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAdminBannerInput('')}
                      className={`min-h-[44px] px-4 rounded-xl ${currentTheme.btnSecondary}`}
                    >
                      清空
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!supabase) return alert('Supabase 尚未連線，無法發布全域通報。');
                        const nextBanner = adminBannerInput.trim();
                        const { error } = await supabase
                          .from('app_settings')
                          .update({ banner_text: nextBanner })
                          .eq('id', 'global');
                        if (error) {
                          console.error('Global banner publish failed:', error);
                          return alert(`訊息發布失敗：${error.message}`);
                        }
                        setBannerText(nextBanner);
                        localStorage.setItem('tn_banner_text', nextBanner);
                        alert(nextBanner ? '訊息已發布！' : '訊息已清除。');
                      }}
                      className={`flex-1 min-h-[44px] rounded-xl font-bold ${currentTheme.accentBg}`}
                    >
                      發布通報
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
