import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

// 目前客戶端版本號
const CURRENT_APP_VERSION = '2026.09.27 v4.5';

// --- 資料型別定義 ---
interface ShipClass {
  id: string;
  code: string;
  name_zh: string;
  category: string;
  nato_code?: string;
  image_url?: string;
  overview?: string;
  displacement?: string;
  length?: string;
  beam?: string;
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
  status_code?: 'active' | 'sea_trial' | 'fitting_out' | 'under_construction' | 'retired' | 'unknown';
}

type FontSizeOption = 'sm' | 'default' | 'md' | 'lg';
type ThemeMode = 'dark' | 'red' | 'high_contrast';
type BottomTab = 'classes' | 'favorites' | 'compare' | 'more';

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

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem('tn_theme_mode') as ThemeMode) || 'dark';
  });
  const [fontSize, setFontSize] = useState<FontSizeOption>(() => {
    return (localStorage.getItem('tn_font_size') as FontSizeOption) || 'default';
  });

  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('classes');
  const [showMoreModal, setShowMoreModal] = useState<null | 'rankings' | 'stats' | 'guide' | 'sources' | 'update'>(null);

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

  const [showAdmin, setShowAdmin] = useState(false);
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

  const [editingClassForm, setEditingClassForm] = useState<Partial<ShipClass>>({
    code: '', name_zh: '', category: '驅逐艦', nato_code: '', image_url: '', overview: '',
    displacement: '', length: '', beam: '', power_output: '', propulsion: '', max_speed: '',
    crew: '', radar_systems: '', weapons_summary: '', electronic_warfare: '', aircraft: '',
    identification_features: [], identification_notes: '', similar_classes: [],
    identification_status: 'unverified', identification_source: ''
  });
  const [tempFeatureInput, setTempFeatureInput] = useState('');

  const [wikiQuery, setWikiQuery] = useState('');
  const [isFetchingWiki, setIsFetchingWiki] = useState(false);
  const [wikiPreviewClass, setWikiPreviewClass] = useState<Partial<ShipClass> | null>(null);

  const [newShipForm, setNewShipForm] = useState<{
    class_id: string;
    hull_number: string;
    name_zh: string;
    commissioned_year: string;
    commission_precision: 'exact' | 'year' | 'unknown';
    fleet: string;
    squadron: string;
    status_code: 'active' | 'sea_trial' | 'fitting_out' | 'under_construction' | 'retired' | 'unknown';
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
        if (granted) console.log('✅ Persistent storage active');
      });
    }
  }, []);

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
    switch (code) {
      case 'active': return { label: '現役', color: 'bg-emerald-950 text-emerald-300 border-emerald-500/40' };
      case 'sea_trial': return { label: '海試', color: 'bg-amber-950 text-amber-300 border-amber-500/40' };
      case 'fitting_out': return { label: '舾裝中', color: 'bg-blue-950 text-blue-300 border-blue-500/40' };
      case 'under_construction': return { label: '建造中', color: 'bg-purple-950 text-purple-300 border-purple-500/40' };
      case 'retired': return { label: '退役', color: 'bg-slate-800 text-slate-400 border-slate-700' };
      default: return { label: fallbackStatus || '現役', color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const getVerificationBadge = (status?: string) => {
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
    e?.stopPropagation();
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
    const updated = { ...queryCounts, [shipClass.id]: (queryCounts[shipClass.id] || 0) + 1 };
    setQueryCounts(updated);
    localStorage.setItem('tn_query_counts', JSON.stringify(updated));
  };

  const renderFormattedList = (text?: string) => {
    if (!text) return <span className="text-white font-medium">-</span>;
    const items = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (items.length <= 1) {
      return <span className="text-white font-medium leading-relaxed break-words">{text}</span>;
    }
    return (
      <div className="space-y-1.5 pt-0.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-2 text-white leading-relaxed">
            <span className="text-slate-500 select-none">•</span>
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
        headerBg: 'bg-[#120406]/95 border-red-900/60',
        cardBg: 'bg-[#150406] border-red-900/60 hover:border-red-600',
        accentText: 'text-red-400',
        accentBg: 'bg-red-700 hover:bg-red-600 text-white',
        border: 'border-red-900/50',
        badge: 'bg-red-950/80 text-red-300 border border-red-800/60',
        input: 'bg-black border-red-900/80 text-red-100 placeholder-red-900 focus:border-red-500'
      };
    }
    if (themeMode === 'high_contrast') {
      return {
        bg: 'bg-slate-950',
        headerBg: 'bg-slate-900 border-slate-600',
        cardBg: 'bg-slate-900 border-2 border-slate-400 shadow-md',
        accentText: 'text-cyan-300 font-black',
        accentBg: 'bg-cyan-500 hover:bg-cyan-400 text-black font-black',
        border: 'border-slate-500',
        badge: 'bg-slate-800 text-white border-2 border-slate-500 font-bold',
        input: 'bg-black border-2 border-cyan-400 text-white placeholder-slate-400 font-bold'
      };
    }
    return {
      bg: 'bg-[#070b12]',
      headerBg: 'bg-[#0c121e]/95 border-slate-800',
      cardBg: 'bg-[#0f1726] border-slate-800 hover:border-cyan-500/50',
      accentText: 'text-cyan-400',
      accentBg: 'bg-cyan-600 hover:bg-cyan-500 text-white',
      border: 'border-slate-800',
      badge: 'bg-slate-800/80 text-slate-200 border border-slate-700',
      input: 'bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus:border-cyan-400'
    };
  };

  const currentTheme = getThemeStyles();

  const getFontSizeStyles = () => {
    switch (fontSize) {
      case 'sm':
        return { root: 'text-[15px]', cardTitle: 'text-xl', cardSub: 'text-sm', header: 'text-sm', button: 'text-xs' };
      case 'md':
        return { root: 'text-[19px] leading-relaxed', cardTitle: 'text-2xl', cardSub: 'text-base', header: 'text-base', button: 'text-sm font-bold' };
      case 'lg':
        return { root: 'text-[22px] leading-loose', cardTitle: 'text-3xl', cardSub: 'text-lg', header: 'text-lg', button: 'text-base font-black' };
      default:
        return { root: 'text-[17px] leading-normal', cardTitle: 'text-2xl', cardSub: 'text-sm', header: 'text-sm', button: 'text-xs font-semibold' };
    }
  };

  const fontStyle = getFontSizeStyles();

  const handleFetchWikiForComparison = async () => {
    if (!wikiQuery.trim()) return alert('請輸入艦型關鍵字（例: 052D）');
    setIsFetchingWiki(true);
    setWikiPreviewClass(null);

    try {
      let input = wikiQuery.trim();
      if (input.includes('wikipedia.org/wiki/')) {
        input = decodeURIComponent(input.split('wikipedia.org/wiki/')[1].split(/[?#]/)[0]);
      }
      let resolvedTitle = input;
      const searchUrl = `https://zh.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(input)}&limit=1&namespace=0&format=json&origin=*`;
      const searchResp = await fetch(searchUrl);
      if (searchResp.ok) {
        const json = await searchResp.json();
        if (json[1]?.[0]) resolvedTitle = json[1][0];
      }

      const parseApiUrl = `https://zh.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(resolvedTitle)}&prop=text|images&format=json&origin=*&redirects=1`;
      const parseResp = await fetch(parseApiUrl);
      const parseJson = await parseResp.json();
      if (parseJson.error) throw new Error(parseJson.error.info || `查無條目`);

      const doc = new DOMParser().parseFromString(parseJson.parse?.text?.['*'] || '', 'text/html');

      let imgUrl = '';
      const firstImg = doc.querySelector('table.infobox img') || doc.querySelector('.thumbimage') || doc.querySelector('img');
      if (firstImg) {
        let src = firstImg.getAttribute('src') || '';
        if (src.startsWith('//')) src = 'https:' + src;
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
              return clone.textContent?.replace(/\[.*?\]/g, '').trim().slice(0, 500) || '';
            }
          }
        }
        return '';
      };

      let overviewP = '';
      for (const p of Array.from(doc.querySelectorAll('p'))) {
        const txt = p.textContent?.replace(/\[.*?\]/g, '').trim() || '';
        if (txt.length > 50) { overviewP = txt; break; }
      }

      const previewData: Partial<ShipClass> = {
        code: (resolvedTitle.match(/([0-9A-Za-z\-]+)(?:型|級)/)?.[1] || input).toUpperCase(),
        name_zh: resolvedTitle,
        category: doc.body.textContent?.includes('巡防艦') ? '巡防艦' : '驅逐艦',
        image_url: imgUrl,
        overview: overviewP,
        displacement: getVal(['排水量', '排水']),
        length: getVal(['全長', '全长', '長度']),
        beam: getVal(['型寬', '寬度', '舷寬']),
        power_output: getVal(['功率', '輸出', '出力']),
        propulsion: getVal(['動力方式', '主機']),
        max_speed: getVal(['最高速度', '航速']),
        crew: getVal(['乘員', '定員']),
        radar_systems: getVal(['搜索系統', '雷達', '雷达']),
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
    <div className={`w-full min-h-screen ${currentTheme.bg} text-slate-100 flex flex-col items-center select-none ${fontStyle.root}`}>
      
      {/* 戰術抬頭列 */}
      <header className={`w-full ${currentTheme.headerBg} border-b backdrop-blur-md px-4 pt-12 pb-4 flex flex-col items-center shadow-lg transition-all`}>
        <div className="w-full max-w-md flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`}></span>
              <h1 className="font-black tracking-widest text-lg font-mono">TAIWAN NAVY</h1>
            </div>
            <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5 pt-0.5">
              {isOnline ? (
                <span className="text-emerald-400 font-bold">✓ 離線資料已就緒</span>
              ) : (
                <span className="text-amber-400 font-black">● OFFLINE · 使用本機資料</span>
              )}
              <span className="text-slate-500">| {CURRENT_APP_VERSION}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {hasUpdateAvailable && (
              <button
                type="button"
                onClick={handleForceUpdateApp}
                className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs animate-bounce flex items-center gap-1 shadow-lg"
                title="點擊立即更新至最新版面"
              >
                <span>🚀 新版就緒</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const next: ThemeMode = themeMode === 'dark' ? 'red' : themeMode === 'red' ? 'high_contrast' : 'dark';
                setThemeMode(next);
                localStorage.setItem('tn_theme_mode', next);
              }}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-slate-300 active:scale-95 transition"
              title="切換顯示模式"
            >
              {themeMode === 'red' ? '🔴' : themeMode === 'high_contrast' ? '☀️' : '🌙'}
            </button>

            <button
              type="button"
              onClick={() => {
                const list: FontSizeOption[] = ['sm', 'default', 'md', 'lg'];
                const next = list[(list.indexOf(fontSize) + 1) % list.length];
                setFontSize(next);
                localStorage.setItem('tn_font_size', next);
              }}
              className="min-w-[44px] min-h-[44px] px-2.5 rounded-xl bg-slate-900 border border-slate-700 font-bold text-xs flex items-center justify-center text-slate-200 active:scale-95 transition"
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
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white active:scale-95 transition"
              title="資料庫後台"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>

        {bannerText && (
          <div className="w-full max-w-md mt-3 px-3 py-1.5 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="flex-1">{bannerText}</span>
          </div>
        )}
      </header>

      {/* 主內容區：依據底部導航 Tab 切換呈現，徹底保留一致的作戰設計語言 */}
      <main className="w-full max-w-md px-4 pt-4 pb-48 flex flex-col flex-1 gap-3">
        
        {/* TAB 1 & TAB 2：艦型列表與收藏列表 */}
        {(activeBottomTab === 'classes' || activeBottomTab === 'favorites') && (
          <>
            {searchTerm && matchingShips.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 space-y-2">
                <div className="text-xs font-mono font-bold text-cyan-400 uppercase">
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
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center cursor-pointer hover:border-cyan-400 transition"
                      >
                        <div className="flex items-baseline gap-2.5">
                          <span className="font-mono text-xl font-black text-cyan-300">{s.hull_number}</span>
                          <span className="font-bold text-white text-base">{s.name_zh}</span>
                          {parentClass && <span className="text-xs text-slate-400 font-mono">({parentClass.code})</span>}
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

            <section className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
                  {activeBottomTab === 'favorites' ? `我的最愛 (${displayedClasses.length})` : `作戰艦型清單 (${displayedClasses.length})`}
                </span>
              </div>

              {isLoading ? (
                <div className="text-center py-20 text-slate-500 font-mono text-xs animate-pulse">
                  載入離線艦艇資料庫中...
                </div>
              ) : displayedClasses.length === 0 ? (
                <div className="text-center py-16 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800 text-slate-400 text-xs">
                  查無符合條件的艦艇資料
                </div>
              ) : (
                displayedClasses.map(c => {
                  const isFav = favorites.includes(c.id);
                  const classShips = ships.filter(s => s.class_id === c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleOpenDetail(c)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between gap-3 ${currentTheme.cardBg}`}
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-baseline gap-2.5">
                          <span className={`font-mono font-black ${fontStyle.cardTitle} ${currentTheme.accentText}`}>
                            {c.code}
                          </span>
                          <span className={`font-bold text-white ${fontStyle.cardSub}`}>
                            {c.name_zh}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className={`px-2.5 py-0.5 rounded-md ${currentTheme.badge} font-medium`}>
                            {c.nato_code ? `${c.nato_code} · ${c.category}` : c.category}
                          </span>
                          <span>共登錄 {classShips.length} 艘</span>
                          {c.identification_status === 'verified' && (
                            <span className="text-emerald-400 font-bold">✓ 已查證</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={e => toggleFavorite(c.id, e)}
                          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-xl active:scale-90 transition"
                        >
                          {isFav ? <span className="text-amber-400">★</span> : <span className="text-slate-500">☆</span>}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDetail(c)}
                          className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-mono text-base active:scale-95 transition"
                        >
                          &gt;
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}

        {/* TAB 3：比對分頁（完全嵌入主畫面，與首頁設計語言 100% 統一，底部導航完全保留！） */}
        {activeBottomTab === 'compare' && (() => {
          const shipA = classes.find(c => c.id === comparePool[0]);
          const shipB = classes.find(c => c.id === comparePool[1]);

          return (
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2 px-1">
                <div>
                  <span className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase block">雙艦戰術數據比對</span>
                  <span className="text-[11px] text-slate-500">並排對照外觀特徵與作戰指標</span>
                </div>
                {comparePool.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setComparePool([]);
                      localStorage.removeItem('tn_compare_pool');
                    }}
                    className="text-xs font-bold text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-950/40 border border-red-900/60 transition"
                  >
                    重置比對池
                  </button>
                )}
              </div>

              {comparePool.length < 2 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-lg font-mono">
                    {comparePool.length}/2
                  </div>
                  <div className="space-y-1">
                    <p className="font-bold text-white text-sm">比對池尚未選滿 2 艘艦艇</p>
                    <p className="text-xs text-slate-400 leading-relaxed">請回「艦型清單」點選艦艇卡片進入詳細頁，按下「＋加入比對」即可啟動雙艦同屏比對！</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveBottomTab('classes')}
                    className="min-h-[44px] px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition"
                  >
                    前往艦型清單挑選
                  </button>
                </div>
              ) : shipA && shipB ? (
                <div className="space-y-3 text-xs">
                  {/* 主要外觀辨識特徵對照 (第一優先) */}
                  {(shipA.identification_features?.length || shipB.identification_features?.length) ? (
                    <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 space-y-2.5">
                      <span className="font-bold text-sm text-cyan-300 block border-b border-cyan-800/40 pb-1.5">👁 主要外觀辨識特徵對照</span>
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-cyan-400 block">{shipA.code}:</span>
                          {shipA.identification_features?.map((f, i) => (
                            <div key={i} className="text-white text-xs leading-snug">• {f}</div>
                          )) || <span className="text-slate-500 italic">無人工辨識資料</span>}
                        </div>
                        <div className="space-y-1 border-l border-cyan-800/40 pl-3">
                          <span className="font-mono font-bold text-cyan-400 block">{shipB.code}:</span>
                          {shipB.identification_features?.map((f, i) => (
                            <div key={i} className="text-white text-xs leading-snug">• {f}</div>
                          )) || <span className="text-slate-500 italic">無人工辨識資料</span>}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* 逐項指標對照卡（完全延續 App 的 cardBg 與高對比文字） */}
                  <div className={`p-4 rounded-2xl border ${currentTheme.cardBg} space-y-3.5`}>
                    <div className="grid grid-cols-2 gap-3 text-center border-b border-slate-800 pb-3">
                      <div>
                        <span className={`font-mono text-2xl font-black ${currentTheme.accentText} block`}>{shipA.code}</span>
                        <span className="font-bold text-white text-sm">{shipA.name_zh}</span>
                      </div>
                      <div className="border-l border-slate-800 pl-3">
                        <span className={`font-mono text-2xl font-black ${currentTheme.accentText} block`}>{shipB.code}</span>
                        <span className="font-bold text-white text-sm">{shipB.name_zh}</span>
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
                      <div key={idx} className="border-b border-slate-800/60 pb-2.5">
                        <span className="text-slate-400 font-bold block mb-1 text-[11px]">{row.label}</span>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-white">{renderFormattedList(row.valA)}</div>
                          <div className="text-white border-l border-slate-800 pl-3">{renderFormattedList(row.valB)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })()}

      </main>

      {/* 底部戰術控制底座（大拇指黃金操作區：搜尋欄 ＋ 底部導航一體化） */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center pointer-events-none">
        
        {/* 懸浮底部大字搜尋列（僅在艦型或收藏清單時顯示，比對時自動收起讓閱讀空間極大化） */}
        {(activeBottomTab === 'classes' || activeBottomTab === 'favorites') && (
          <div className="w-full max-w-md px-4 pb-2 pointer-events-auto">
            <div className="relative flex items-center shadow-2xl">
              <svg className="w-5 h-5 absolute left-3.5 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                  className="absolute right-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {!searchTerm && recentSearches.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1.5">
                <span className="text-[11px] text-slate-400 font-mono shrink-0">快搜:</span>
                {recentSearches.map(term => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => handleSelectRecentSearch(term)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900/90 backdrop-blur border border-slate-700 text-xs font-mono text-cyan-300 shrink-0 shadow-sm"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 底部 Navigation 列：4 個選項完整保留，設計風格 100% 統一 */}
        <nav className={`w-full ${currentTheme.headerBg} border-t backdrop-blur-xl flex justify-center shadow-2xl pointer-events-auto`} style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}>
          <div className="w-full max-w-md flex justify-around items-center px-3 py-1.5 text-xs font-bold">
            
            <button
              type="button"
              onClick={() => setActiveBottomTab('classes')}
              className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition ${activeBottomTab === 'classes' ? currentTheme.accentText : 'text-slate-400'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
              </svg>
              <span>艦型</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveBottomTab('favorites')}
              className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition ${activeBottomTab === 'favorites' ? 'text-amber-400' : 'text-slate-400'}`}
            >
              <svg className="w-5 h-5" fill={activeBottomTab === 'favorites' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
              <span>收藏</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveBottomTab('compare')}
              className={`min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition ${activeBottomTab === 'compare' ? currentTheme.accentText : 'text-slate-400'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
              <span>比對 ({comparePool.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowMoreModal('update')}
              className="min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-white transition relative"
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
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">次級資訊與系統設定</h3>
              <button type="button" onClick={() => setShowMoreModal(null)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex gap-1 bg-slate-950 p-1 rounded-xl text-xs font-bold overflow-x-auto no-scrollbar">
              <button type="button" onClick={() => setShowMoreModal('update')} className={`px-3 py-2 rounded-lg shrink-0 ${showMoreModal === 'update' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'}`}>版面更新</button>
              <button type="button" onClick={() => setShowMoreModal('rankings')} className={`px-3 py-2 rounded-lg shrink-0 ${showMoreModal === 'rankings' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'}`}>查詢排行</button>
              <button type="button" onClick={() => setShowMoreModal('stats')} className={`px-3 py-2 rounded-lg shrink-0 ${showMoreModal === 'stats' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'}`}>每月統計</button>
              <button type="button" onClick={() => setShowMoreModal('guide')} className={`px-3 py-2 rounded-lg shrink-0 ${showMoreModal === 'guide' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'}`}>離線說明</button>
              <button type="button" onClick={() => setShowMoreModal('sources')} className={`px-3 py-2 rounded-lg shrink-0 ${showMoreModal === 'sources' ? 'bg-slate-800 text-cyan-300' : 'text-slate-400'}`}>資料來源</button>
            </div>

            {showMoreModal === 'update' && (
              <div className="space-y-3.5 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-xs">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="text-slate-400">目前本機版本：</span>
                  <span className="font-mono text-cyan-300 font-bold">{CURRENT_APP_VERSION}</span>
                </div>
                <div className="text-slate-300 space-y-2 leading-relaxed">
                  <p className="font-bold text-white">為什麼有時候畫面沒有更新？</p>
                  <p>為了確保在海上斷網時能照常運作，手機會自動將畫面鎖存在本機快取中。若雲端發布了新版面但畫面卡住，可點擊下方按鈕強制清除本機快取並刷新。</p>
                </div>
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={handleForceUpdateApp}
                  className="w-full min-h-[48px] rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white text-sm shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                >
                  {isUpdating ? '正在清除快取並載入...' : '🔄 強制清除快取並更新至最新版面'}
                </button>
              </div>
            )}

            {showMoreModal === 'rankings' && (
              <div className="space-y-2 text-xs">
                {classes
                  .slice()
                  .sort((a, b) => (queryCounts[b.id] || 0) - (queryCounts[a.id] || 0))
                  .slice(0, 10)
                  .map((c, idx) => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500 font-bold">#{idx + 1}</span>
                        <span className="font-mono font-bold text-cyan-300">{c.code}</span>
                        <span className="text-white">{c.name_zh}</span>
                      </div>
                      <span className="font-mono text-slate-400 font-bold">{queryCounts[c.id] || 0} 次</span>
                    </div>
                  ))}
              </div>
            )}

            {showMoreModal === 'stats' && (
              <div className="space-y-2 text-xs">
                {Object.keys(monthlyUsage).sort().reverse().map(m => (
                  <div key={m} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                    <span className="font-mono text-slate-300">{m}</span>
                    <span className="font-mono text-cyan-400 font-bold">{monthlyUsage[m]} 次查詢</span>
                  </div>
                ))}
              </div>
            )}

            {showMoreModal === 'guide' && (
              <div className="space-y-2 text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <p>1. iPhone 點選分享按鈕 ➔ 選擇「加入主畫面」即可安裝為獨立 App。</p>
                <p>2. 出港前在基地有網路時，滑動瀏覽各級艦艇一次，即可啟動 180 天長效持久離線庫。</p>
                <p>3. 任務斷網期間，切勿手動清除 Safari / Chrome 快取與瀏覽紀錄。</p>
              </div>
            )}

            {showMoreModal === 'sources' && (
              <div className="space-y-2 text-xs text-slate-400 leading-relaxed bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
                <p>• 技術資料主要依據維基百科公開資料庫與國際公開軍事智庫手冊。</p>
                <p>• 外觀辨識特徵一律由管理員人工輸入查證，未驗證者均清楚標註。</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 授權驗證 Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <h3 className="font-bold text-base text-white">後台管理通行驗證</h3>
            <form onSubmit={handleVerifyPassword} className="space-y-3">
              <input
                type="password"
                required
                maxLength={10}
                placeholder="請輸入 6 位授權碼"
                value={adminPasswordInput}
                onChange={e => setAdminPasswordInput(e.target.value)}
                className="w-full min-h-[48px] bg-slate-950 border border-slate-700 rounded-xl text-center text-xl font-mono text-white tracking-widest focus:outline-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 min-h-[44px] rounded-xl bg-slate-800 text-slate-400 text-xs font-bold">取消</button>
                <button type="submit" className="flex-1 min-h-[44px] rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold">確認驗證</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 艦型詳細頁 Modal */}
      {selectedClassDetail && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-end sm:justify-center p-0 sm:p-4">
          <div className={`w-full max-w-lg h-[92vh] sm:h-[88vh] ${currentTheme.bg} border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-2xl font-black ${currentTheme.accentText}`}>
                  {selectedClassDetail.code}
                </span>
                <span className="font-bold text-white text-base truncate max-w-[200px]">
                  {selectedClassDetail.name_zh}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClassDetail(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold"
              >
                ✕ 關閉
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-sm">
              <div className="space-y-3">
                {selectedClassDetail.image_url ? (
                  <div className="w-full h-48 rounded-2xl overflow-hidden border border-slate-800 bg-black">
                    <img src={selectedClassDetail.image_url} alt={selectedClassDetail.name_zh} className="w-full h-full object-cover object-center" />
                  </div>
                ) : (
                  <div className="w-full h-24 rounded-2xl border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500">
                    暫無艦影照片
                  </div>
                )}

                <div className="flex justify-between items-center pt-1">
                  <div>
                    <h2 className="text-xl font-black text-white">{selectedClassDetail.name_zh}</h2>
                    <p className="text-xs text-slate-400 font-mono">
                      {selectedClassDetail.nato_code} · {selectedClassDetail.category}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleCompare(selectedClassDetail.id)}
                      className={`min-h-[44px] px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 ${
                        comparePool.includes(selectedClassDetail.id)
                          ? 'bg-cyan-500 text-black font-black'
                          : 'bg-slate-900 border border-slate-700 text-slate-300'
                      }`}
                    >
                      {comparePool.includes(selectedClassDetail.id) ? '已加入比對' : '＋加入比對'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(selectedClassDetail.id)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-900 border border-slate-700 text-lg"
                    >
                      {favorites.includes(selectedClassDetail.id) ? '★' : '☆'}
                    </button>
                  </div>
                </div>

                {selectedClassDetail.overview && (
                  <p className="text-xs text-slate-300 bg-slate-900/90 p-3 rounded-xl border border-slate-800 leading-relaxed text-justify">
                    {selectedClassDetail.overview}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                  <span className="font-bold text-base text-cyan-300 flex items-center gap-2">
                    <span>👁 外觀辨識</span>
                  </span>
                  {getVerificationBadge(selectedClassDetail.identification_status)}
                </div>

                {selectedClassDetail.identification_features && selectedClassDetail.identification_features.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedClassDetail.identification_features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-white">
                        <span className="text-cyan-400 font-mono font-bold">•</span>
                        <span className="font-medium leading-relaxed">{feature}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-1 italic">
                    目前尚未建立人工查證的外觀辨識資料
                  </p>
                )}

                {selectedClassDetail.identification_notes && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                    <span className="font-bold text-slate-300 block mb-0.5">辨識附註：</span>
                    {selectedClassDetail.identification_notes}
                  </div>
                )}
              </div>

              {selectedClassDetail.similar_classes && selectedClassDetail.similar_classes.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <span className="font-bold text-sm text-amber-300">⚠️ 容易混淆艦型 (點擊啟動比對)</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {selectedClassDetail.similar_classes.map(targetCode => {
                      const matched = classes.find(c => c.code.toLowerCase() === targetCode.toLowerCase());
                      return (
                        <button
                          key={targetCode}
                          type="button"
                          onClick={() => {
                            if (matched) {
                              setComparePool([selectedClassDetail.id, matched.id]);
                              setSelectedClassDetail(null);
                              setActiveBottomTab('compare');
                            } else {
                              alert(`資料庫中暫無【${targetCode}】之完整參數`);
                            }
                          }}
                          className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-200 font-mono font-bold text-xs flex items-center gap-1.5 active:scale-95 transition"
                        >
                          <span>{targetCode}</span>
                          <span className="text-[10px] text-slate-400">➔ 比對</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                <span className="font-bold text-base text-white block border-b border-slate-800 pb-2">
                  技術規格與裝備參數
                </span>

                <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-800/80 pb-3">
                  <div><span className="text-slate-400 block text-[11px] mb-0.5">排水量:</span>{renderFormattedList(selectedClassDetail.displacement)}</div>
                  <div><span className="text-slate-400 block text-[11px] mb-0.5">最高航速:</span>{renderFormattedList(selectedClassDetail.max_speed)}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-800/80 pb-3">
                  <div><span className="text-slate-400 block text-[11px] mb-0.5">長度:</span>{renderFormattedList(selectedClassDetail.length)}</div>
                  <div><span className="text-slate-400 block text-[11px] mb-0.5">型寬:</span>{renderFormattedList(selectedClassDetail.beam)}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs border-b border-slate-800/80 pb-3">
                  <div><span className="text-slate-400 block text-[11px] mb-0.5">動力方式:</span>{renderFormattedList(selectedClassDetail.propulsion)}</div>
                  <div><span className="text-slate-400 block text-[11px] mb-0.5">動力輸出:</span>{renderFormattedList(selectedClassDetail.power_output)}</div>
                </div>

                <div className="border-b border-slate-800/80 pb-3"><span className="text-slate-400 block text-[11px] mb-0.5">乘員編制:</span>{renderFormattedList(selectedClassDetail.crew)}</div>
                <div className="border-b border-slate-800/80 pb-3"><span className="text-slate-400 block text-[11px] mb-0.5">搜索系統 (雷達/聲納):</span>{renderFormattedList(selectedClassDetail.radar_systems)}</div>
                <div className="border-b border-slate-800/80 pb-3"><span className="text-slate-400 block text-[11px] mb-0.5">武器系統:</span>{renderFormattedList(selectedClassDetail.weapons_summary)}</div>
                <div className="border-b border-slate-800/80 pb-3"><span className="text-slate-400 block text-[11px] mb-0.5">電戰系統:</span>{renderFormattedList(selectedClassDetail.electronic_warfare)}</div>
                <div><span className="text-slate-400 block text-[11px] mb-0.5">艦載機:</span>{renderFormattedList(selectedClassDetail.aircraft)}</div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setExpandedShipList(!expandedShipList)}
                  className="w-full min-h-[48px] px-4 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-sm font-bold text-slate-200"
                >
                  <span>本級艦各艇名冊 ({ships.filter(s => s.class_id === selectedClassDetail.id).length} 艘)</span>
                  <span className="font-mono text-cyan-400">{expandedShipList ? '▲ 收合' : '▼ 展開'}</span>
                </button>

                {expandedShipList && (
                  <div className="space-y-2 pt-1">
                    {ships.filter(s => s.class_id === selectedClassDetail.id).map(s => {
                      const statusMeta = getStatusLabel(s.status_code, s.status);
                      return (
                        <div key={s.id} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
                          <div className="flex justify-between items-center">
                            <div className="flex items-baseline gap-2.5">
                              <span className="font-mono text-xl font-black text-cyan-300">{s.hull_number}</span>
                              <span className="font-bold text-white text-base">{s.name_zh}</span>
                            </div>
                            <span className={`text-xs px-2.5 py-0.5 rounded-md font-bold border ${statusMeta.color}`}>
                              {statusMeta.label}
                            </span>
                          </div>
                          <div className="text-xs text-slate-300 space-y-0.5 pt-1 border-t border-slate-800/60">
                            <div><span className="text-slate-500">服役時間：</span><span className="font-mono text-white">{s.commissioned_year || '未載明'}</span></div>
                            <div><span className="text-slate-500">編屬部隊：</span><span className="text-white">{s.fleet || '未載明'}{s.squadron && ` · ${s.squadron}`}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <div>資料來源：{selectedClassDetail.identification_source || 'Wikipedia 公開軍事情報資料庫'}</div>
                <div>最後維護：{selectedClassDetail.identification_updated_at ? new Date(selectedClassDetail.identification_updated_at).toLocaleDateString('zh-TW') : CURRENT_APP_VERSION}</div>
                <div>查證狀態：{selectedClassDetail.identification_status === 'verified' ? '已通過人工確認' : '尚待人工複核'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 資料庫管理後台 Modal */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-lg h-[92vh] sm:h-[88vh] bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="font-bold text-base text-white">資料庫管理與外觀特徵維護</h2>
              <button type="button" onClick={() => setShowAdmin(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="flex border-b border-slate-800 text-xs font-bold p-1 bg-slate-950 mx-4 mt-3 rounded-xl gap-1">
              <button type="button" onClick={() => setAdminActiveTab('class_edit')} className={`flex-1 min-h-[44px] rounded-lg ${adminActiveTab === 'class_edit' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}>艦型與外觀特徵</button>
              <button type="button" onClick={() => setAdminActiveTab('ship_add')} className={`flex-1 min-h-[44px] rounded-lg ${adminActiveTab === 'ship_add' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}>新增單艦與舷號</button>
              <button type="button" onClick={() => setAdminActiveTab('banner')} className={`flex-1 min-h-[44px] rounded-lg ${adminActiveTab === 'banner' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}>廣播通報</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {adminActiveTab === 'class_edit' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-2.5">
                    <span className="font-bold text-cyan-300 block">Wikipedia 資料比對與安全擷取</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="輸入艦型代號 (例: 052D)"
                        value={wikiQuery}
                        onChange={e => setWikiQuery(e.target.value)}
                        className="flex-1 min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-white text-xs"
                      />
                      <button
                        type="button"
                        disabled={isFetchingWiki}
                        onClick={handleFetchWikiForComparison}
                        className="min-h-[44px] px-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl active:scale-95 transition"
                      >
                        {isFetchingWiki ? '解析中...' : '擷取預覽'}
                      </button>
                    </div>

                    {wikiPreviewClass && (
                      <div className="p-3 rounded-xl bg-black/60 border border-cyan-500/30 space-y-2 mt-2">
                        <span className="font-bold text-cyan-400 block">新擷取資料比對預覽：</span>
                        <div className="text-xs text-slate-300 space-y-1">
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
                          className="min-h-[40px] w-full mt-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                        >
                          確認套用至編輯表單（不覆蓋外觀特徵）
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                    <span className="font-bold text-sm text-white block">👁 外觀辨識特徵人工管理</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="輸入單項特徵 (例: 封閉式雙面相控陣主桅)"
                        value={tempFeatureInput}
                        onChange={e => setTempFeatureInput(e.target.value)}
                        className="flex-1 min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-3 text-white text-xs"
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
                        className="min-h-[44px] px-3.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold rounded-xl border border-slate-700"
                      >
                        ＋新增
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {editingClassForm.identification_features?.map((feat, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                          <span className="text-white">{feat}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editingClassForm.identification_features?.filter((_, i) => i !== idx);
                              setEditingClassForm({ ...editingClassForm, identification_features: updated });
                            }}
                            className="text-red-400 hover:text-red-300 px-2.5 py-1 font-bold"
                          >
                            刪除
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                      <div>
                        <label className="text-slate-400 block mb-1">查證狀態標籤</label>
                        <select
                          value={editingClassForm.identification_status}
                          onChange={e => setEditingClassForm({ ...editingClassForm, identification_status: e.target.value as any })}
                          className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-2.5 text-white text-xs"
                        >
                          <option value="unverified">待查證</option>
                          <option value="incomplete">資料未完整</option>
                          <option value="verified">已查證</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">情報資料來源</label>
                        <input
                          type="text"
                          placeholder="例: 人工戰情審查"
                          value={editingClassForm.identification_source || ''}
                          onChange={e => setEditingClassForm({ ...editingClassForm, identification_source: e.target.value })}
                          className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-xl px-2.5 text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 block mb-1">艦型代號 (例: 052D)</label>
                        <input
                          required
                          value={editingClassForm.code || ''}
                          onChange={e => setEditingClassForm({ ...editingClassForm, code: e.target.value })}
                          className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 block mb-1">艦型全名</label>
                        <input
                          required
                          value={editingClassForm.name_zh || ''}
                          onChange={e => setEditingClassForm({ ...editingClassForm, name_zh: e.target.value })}
                          className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">官方照片網址</label>
                      <input
                        type="url"
                        value={editingClassForm.image_url || ''}
                        onChange={e => setEditingClassForm({ ...editingClassForm, image_url: e.target.value })}
                        className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">艦型概述</label>
                      <textarea
                        rows={3}
                        value={editingClassForm.overview || ''}
                        onChange={e => setEditingClassForm({ ...editingClassForm, overview: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <span className="font-bold text-slate-300 block">技術指標 (以 Shift+Enter 分項)</span>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea rows={2} placeholder="排水量" value={editingClassForm.displacement || ''} onChange={e => setEditingClassForm({ ...editingClassForm, displacement: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                        <textarea rows={2} placeholder="最高航速" value={editingClassForm.max_speed || ''} onChange={e => setEditingClassForm({ ...editingClassForm, max_speed: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <textarea rows={2} placeholder="長度" value={editingClassForm.length || ''} onChange={e => setEditingClassForm({ ...editingClassForm, length: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                        <textarea rows={2} placeholder="型寬" value={editingClassForm.beam || ''} onChange={e => setEditingClassForm({ ...editingClassForm, beam: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      </div>
                      <textarea rows={3} placeholder="搜索系統 (雷達/聲納)" value={editingClassForm.radar_systems || ''} onChange={e => setEditingClassForm({ ...editingClassForm, radar_systems: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      <textarea rows={3} placeholder="武器系統" value={editingClassForm.weapons_summary || ''} onChange={e => setEditingClassForm({ ...editingClassForm, weapons_summary: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                    </div>

                    <button
                      type="button"
                      onClick={handleConfirmSaveClass}
                      className="w-full min-h-[48px] rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white text-sm shadow-lg active:scale-95 transition"
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
                    const sid = `s-${newShipForm.hull_number.trim()}`;
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
                    alert(`單艦【${newShipForm.hull_number} ${newShipForm.name_zh}】已成功寫入！`);
                    setShowAdmin(false);
                    await fetchData();
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="text-slate-400 block mb-1">所屬艦型</label>
                    <select
                      required
                      value={newShipForm.class_id}
                      onChange={e => setNewShipForm({ ...newShipForm, class_id: e.target.value })}
                      className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white"
                    >
                      <option value="">-- 請選擇所屬艦型 --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name_zh}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">舷號 (例: 172)</label>
                      <input
                        required
                        value={newShipForm.hull_number}
                        onChange={e => setNewShipForm({ ...newShipForm, hull_number: e.target.value })}
                        className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">艦名 (例: 昆明)</label>
                      <input
                        required
                        value={newShipForm.name_zh}
                        onChange={e => setNewShipForm({ ...newShipForm, name_zh: e.target.value })}
                        className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">服役時間格式</label>
                      <select
                        value={newShipForm.commission_precision}
                        onChange={e => setNewShipForm({ ...newShipForm, commission_precision: e.target.value as any })}
                        className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-2.5 text-white"
                      >
                        <option value="exact">完整年月日 (YYYY-MM-DD)</option>
                        <option value="year">僅年份 (YYYY)</option>
                        <option value="unknown">日期不明</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">服役時間</label>
                      <input
                        placeholder={newShipForm.commission_precision === 'exact' ? '2014-03-21' : newShipForm.commission_precision === 'year' ? '2014' : '日期不明'}
                        value={newShipForm.commissioned_year}
                        onChange={e => setNewShipForm({ ...newShipForm, commissioned_year: e.target.value })}
                        className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 block mb-1">所屬艦隊</label>
                      <input
                        placeholder="例: 南部戰區海軍"
                        value={newShipForm.fleet}
                        onChange={e => setNewShipForm({ ...newShipForm, fleet: e.target.value })}
                        className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">所屬支隊</label>
                      <input
                        placeholder="例: 驅逐艦第9支隊"
                        value={newShipForm.squadron}
                        onChange={e => setNewShipForm({ ...newShipForm, squadron: e.target.value })}
                        className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">標準化艦況 (Enum)</label>
                    <select
                      value={newShipForm.status_code}
                      onChange={e => setNewShipForm({ ...newShipForm, status_code: e.target.value as any })}
                      className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-3 text-white"
                    >
                      <option value="active">現役 (active)</option>
                      <option value="sea_trial">海試 (sea_trial)</option>
                      <option value="fitting_out">舾裝中 (fitting_out)</option>
                      <option value="under_construction">建造中 (under_construction)</option>
                      <option value="retired">退役 (retired)</option>
                      <option value="unknown">未知 (unknown)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full min-h-[48px] rounded-xl bg-cyan-600 hover:bg-cyan-500 font-bold text-white text-sm shadow-lg active:scale-95 transition"
                  >
                    新增單艦履歷
                  </button>
                </form>
              )}

              {adminActiveTab === 'banner' && (
                <div className="space-y-3">
                  <textarea
                    rows={3}
                    placeholder="輸入戰術通報廣播文字（清空儲存則自動隱藏）"
                    value={adminBannerInput}
                    onChange={e => setAdminBannerInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAdminBannerInput('')}
                      className="min-h-[44px] px-4 rounded-xl bg-slate-800 text-slate-300"
                    >
                      清空
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!supabase) return;
                        await supabase.from('app_settings').upsert({ id: 'global', banner_text: adminBannerInput.trim() });
                        setBannerText(adminBannerInput.trim());
                        localStorage.setItem('tn_banner_text', adminBannerInput.trim());
                        alert('戰術通報已廣播發布！');
                      }}
                      className="flex-1 min-h-[44px] rounded-xl bg-cyan-600 font-bold text-white"
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
