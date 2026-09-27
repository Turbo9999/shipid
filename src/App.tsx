import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';

interface ShipClass {
  id: string;
  code: string;
  name_zh: string;
  category: string;
  nato_code?: string;
  image_url?: string;
  visual_features?: string[];
  weapons_summary?: string;
}

interface Ship {
  id: string;
  class_id: string;
  hull_number: string;
  name_zh: string;
  status: string;
}

type FontSizeOption = 'system' | 'sm' | 'md' | 'lg';
type BottomTab = 'all' | 'favorites' | 'rankings' | 'stats';

export default function App() {
  const [classes, setClasses] = useState<ShipClass[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('2026.09.27');

  // 夜戰暗紅光模式切換
  const [nightMode, setNightMode] = useState<boolean>(() => {
    return localStorage.getItem('tn_night_mode') === 'true';
  });

  // 雙艦快速比對池
  const [comparePool, setComparePool] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // 後台通行碼授權狀態 (750120)
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('tn_admin_auth') === 'true';
  });

  // 頂部戰術公告/廣告橫幅文字
  const [bannerText, setBannerText] = useState<string>(() => {
    return localStorage.getItem('tn_banner_text') || '';
  });
  const [adminBannerInput, setAdminBannerInput] = useState<string>('');
  const [isSavingBanner, setIsSavingBanner] = useState(false);

  // 安裝與離線注意事項狀態
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isStandalone] = useState<boolean>(() => {
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  });

  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('all');

  const [fontSize, setFontSize] = useState<FontSizeOption>(() => {
    return (localStorage.getItem('tn_font_size') as FontSizeOption) || 'system';
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

  const [activeTab, setActiveTab] = useState<'classes' | 'ships' | 'banner'>('classes');
  const [editingClass, setEditingClass] = useState<ShipClass | null>(null);
  const [editingShip, setEditingShip] = useState<Ship | null>(null);

  const [newClass, setNewClass] = useState({ code: '', name_zh: '', category: '', nato_code: '', image_url: '', visual_features: '', weapons_summary: '' });
  const [newShip, setNewShip] = useState({ class_id: '', hull_number: '', name_zh: '', status: '現役' });

  // 維基百科抓取狀態
  const [wikiQuery, setWikiQuery] = useState('');
  const [isFetchingWiki, setIsFetchingWiki] = useState(false);

  useEffect(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const saved = localStorage.getItem('tn_monthly_usage');
    const currentMap = saved ? JSON.parse(saved) : {};
    currentMap[currentMonthKey] = (currentMap[currentMonthKey] || 0) + 1;
    localStorage.setItem('tn_monthly_usage', JSON.stringify(currentMap));
    setMonthlyUsage(currentMap);
  }, []);

  useEffect(() => {
    document.title = "TAIWAN NAVY";
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(granted => {
        if (granted) console.log('✅ Persistent storage granted');
      });
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (showAdmin || editingClass || editingShip) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [showAdmin, editingClass, editingShip]);

  const toggleNightMode = () => {
    const next = !nightMode;
    setNightMode(next);
    localStorage.setItem('tn_night_mode', String(next));
  };

  const fetchData = async () => {
    setIsLoading(true);
    const cachedClasses = localStorage.getItem('tn_cache_classes');
    const cachedShips = localStorage.getItem('tn_cache_ships');
    const cachedBanner = localStorage.getItem('tn_banner_text');
    if (cachedClasses && classes.length === 0) setClasses(JSON.parse(cachedClasses));
    if (cachedShips && ships.length === 0) setShips(JSON.parse(cachedShips));
    if (cachedBanner && !bannerText) setBannerText(cachedBanner);

    if (!supabase) {
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
      if (bData && bData.banner_text !== undefined) {
        const text = bData.banner_text || '';
        setBannerText(text);
        setAdminBannerInput(text);
        localStorage.setItem('tn_banner_text', text);
      }
      setLastUpdated(new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }));
    } catch (e) {
      console.warn('離線環境：啟用本機快照', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const allVisualFeatures = useMemo(() => {
    const set = new Set<string>();
    classes.forEach(c => {
      c.visual_features?.forEach(f => {
        const trimmed = f.trim();
        if (trimmed) set.add(trimmed);
      });
    });
    return Array.from(set);
  }, [classes]);

  // 🌐 維基百科自動擷取功能
  const handleFetchWikipedia = async () => {
    if (!wikiQuery.trim()) {
      alert('請先輸入維基條目名稱或網址 (例: 052D型导弹驱逐舰 或 054A)');
      return;
    }

    setIsFetchingWiki(true);
    try {
      // 若使用者直接貼網址，自動解析出條目 title
      let title = wikiQuery.trim();
      if (title.includes('wikipedia.org/wiki/')) {
        title = decodeURIComponent(title.split('wikipedia.org/wiki/')[1].split(/[?#]/)[0]);
      }

      // 呼叫維基百科 REST API
      const res = await fetch(`https://zh.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
      if (!res.ok) {
        throw new Error('找不到該條目，請確認條目名稱是否正確！');
      }

      const data = await res.json();
      const extractText = data.extract || '';

      // 智能推估艦型代號 (例: 從 052D型... 提取 052D)
      const codeMatch = title.match(/([0-9A-Za-z\-]+)(?:型|級)/);
      const guessedCode = codeMatch ? codeMatch[1] : title.slice(0, 6);

      // 智能推估艦種分類
      let guessedCategory = '驅逐艦';
      if (extractText.includes('巡防艦') || extractText.includes('护卫舰')) guessedCategory = '巡防艦';
      else if (extractText.includes('驅逐艦') || extractText.includes('驱逐舰')) guessedCategory = '驅逐艦';
      else if (extractText.includes('登陸艦') || extractText.includes('登陆舰') || extractText.includes('兩棲')) guessedCategory = '兩棲登陸艦';
      else if (extractText.includes('巡邏艦') || extractText.includes('巡逻舰')) guessedCategory = '巡邏艦';
      else if (extractText.includes('航空母艦') || extractText.includes('航母')) guessedCategory = '航空母艦';
      else if (extractText.includes('潛艇') || extractText.includes('潜艇')) guessedCategory = '潛艦';

      // 智能推估北約/英文代號
      let guessedNato = '';
      if (extractText.includes('北約代號') || extractText.includes('北约代号')) {
        const natoMatch = extractText.match(/北[約约]代[號号][：:\s]*([A-Za-z0-9\-]+)/);
        if (natoMatch) guessedNato = natoMatch[1];
      }

      // 智能提取武裝關鍵字
      let weaponsSummary = '';
      const weaponKeywords = ['垂直發射', '垂直发射', '艦砲', '舰炮', '防空導彈', '防空导弹', '反艦導彈', '反舰导弹', '魚雷', '鱼雷'];
      const sentences = extractText.split(/[。；;]/);
      const matchedSentences = sentences.filter((s: string) => weaponKeywords.some(k => s.includes(k)));
      if (matchedSentences.length > 0) {
        weaponsSummary = matchedSentences.join('；').slice(0, 100);
      }

      // 帶入表單輸入框供審核
      setNewClass({
        code: newClass.code || guessedCode,
        name_zh: data.title || '',
        category: newClass.category || guessedCategory,
        nato_code: newClass.nato_code || guessedNato,
        image_url: data.originalimage?.source || data.thumbnail?.source || '',
        visual_features: newClass.visual_features || '相控陣雷達, 封閉式艦橋',
        weapons_summary: weaponsSummary || extractText.slice(0, 80)
      });

      alert(`✅ 成功抓取維基百科【${data.title}】資訊！請檢視下方欄位後按發布。`);
    } catch (err: any) {
      alert(`抓取失敗：${err.message || '連線逾時'}`);
    } finally {
      setIsFetchingWiki(false);
    }
  };

  const toggleCompare = (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (comparePool.includes(classId)) {
      setComparePool(comparePool.filter(id => id !== classId));
    } else {
      if (comparePool.length >= 2) {
        setComparePool([comparePool[1], classId]);
      } else {
        setComparePool([...comparePool, classId]);
      }
    }
  };

  const toggleFavorite = (classId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    let updated: string[];
    if (favorites.includes(classId)) {
      updated = favorites.filter(id => id !== classId);
    } else {
      updated = [...favorites, classId];
    }
    setFavorites(updated);
    localStorage.setItem('tn_favorites', JSON.stringify(updated));
  };

  const handleToggleExpand = (classId: string) => {
    if (expandedClassId !== classId) {
      const updatedCounts = { ...queryCounts, [classId]: (queryCounts[classId] || 0) + 1 };
      setQueryCounts(updatedCounts);
      localStorage.setItem('tn_query_counts', JSON.stringify(updatedCounts));
      setExpandedClassId(classId);
    } else {
      setExpandedClassId(null);
    }
  };

  const handleSetFontSize = (size: FontSizeOption) => {
    setFontSize(size);
    localStorage.setItem('tn_font_size', size);
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-[13px] leading-normal';
      case 'md': return 'text-[15px] leading-relaxed';
      case 'lg': return 'text-[17px] leading-loose';
      default: return 'text-sm leading-normal';
    }
  };

  const handleOpenAdmin = () => {
    if (isAuthenticated) {
      setAdminBannerInput(bannerText);
      setShowAdmin(true);
    } else {
      setAdminPasswordInput('');
      setShowPasswordModal(true);
    }
  };

  const handleVerifyPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasswordInput.trim() === '750120') {
      localStorage.setItem('tn_admin_auth', 'true');
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setAdminBannerInput(bannerText);
      setShowAdmin(true);
    } else {
      alert('授權碼錯誤，請重新輸入！');
      setAdminPasswordInput('');
    }
  };

  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setIsSavingBanner(true);
    try {
      await supabase.from('app_settings').upsert({
        id: 'global',
        banner_text: adminBannerInput.trim(),
        updated_at: new Date().toISOString()
      });
      setBannerText(adminBannerInput.trim());
      localStorage.setItem('tn_banner_text', adminBannerInput.trim());
      setIsSavingBanner(false);
      alert('戰術通報橫幅已發布');
    } catch (err) {
      console.error(err);
      setIsSavingBanner(false);
      alert('更新失敗，請檢查網路');
    }
  };

  const filteredShips = ships.filter(s => 
    s.hull_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.name_zh.includes(searchTerm)
  );

  let displayedClasses = classes.filter(c => {
    const matchSearch = 
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name_zh.includes(searchTerm) ||
      (c.nato_code && c.nato_code.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchFeature = !selectedFeature || (c.visual_features && c.visual_features.includes(selectedFeature));
    return matchSearch && matchFeature;
  });

  if (activeBottomTab === 'favorites') {
    displayedClasses = displayedClasses.filter(c => favorites.includes(c.id));
  }

  if (activeBottomTab === 'rankings') {
    displayedClasses = [...displayedClasses].sort((a, b) => {
      const countA = queryCounts[a.id] || 0;
      const countB = queryCounts[b.id] || 0;
      return countB - countA;
    });
  }

  const saveClassEdit = async () => {
    if (!editingClass || !supabase) return;
    await supabase.from('ship_classes').update({
      name_zh: editingClass.name_zh,
      category: editingClass.category,
      nato_code: editingClass.nato_code || '',
      image_url: editingClass.image_url || '',
      weapons_summary: editingClass.weapons_summary || '',
      visual_features: editingClass.visual_features || []
    }).eq('id', editingClass.id);
    setEditingClass(null);
    fetchData();
  };

  const saveShipEdit = async () => {
    if (!editingShip || !supabase) return;
    await supabase.from('ships').update({
      name_zh: editingShip.name_zh,
      status: editingShip.status
    }).eq('id', editingShip.id);
    setEditingShip(null);
    fetchData();
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const cid = `c-${newClass.code.toLowerCase().trim()}`;
    await supabase.from('ship_classes').insert([{
      id: cid,
      code: newClass.code.trim(),
      name_zh: newClass.name_zh.trim(),
      category: newClass.category.trim(),
      nato_code: newClass.nato_code.trim(),
      image_url: newClass.image_url.trim(),
      visual_features: newClass.visual_features.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      weapons_summary: newClass.weapons_summary.trim()
    }]);
    setNewClass({ code: '', name_zh: '', category: '', nato_code: '', image_url: '', visual_features: '', weapons_summary: '' });
    setWikiQuery('');
    setShowAdmin(false);
    fetchData();
  };

  const handleCreateShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const sid = `s-${newShip.hull_number.trim()}`;
    await supabase.from('ships').insert([{
      id: sid,
      class_id: newShip.class_id,
      hull_number: newShip.hull_number.trim(),
      name_zh: newShip.name_zh.trim(),
      status: newShip.status.trim()
    }]);
    setNewShip({ class_id: '', hull_number: '', name_zh: '', status: '現役' });
    setShowAdmin(false);
    fetchData();
  };

  const sortedMonths = Object.keys(monthlyUsage).sort().reverse();
  const maxUsageCount = Math.max(...Object.values(monthlyUsage), 1);

  const compareShipA = classes.find(c => c.id === comparePool[0]);
  const compareShipB = classes.find(c => c.id === comparePool[1]);

  const theme = {
    bg: nightMode ? 'bg-[#080203]' : 'bg-[#0b0f17]',
    cardBg: nightMode ? 'bg-red-950/20' : 'bg-slate-900/80',
    cardBorder: nightMode ? 'border-red-900/40' : 'border-slate-800',
    accentText: nightMode ? 'text-red-500' : 'text-cyan-400',
    accentBg: nightMode ? 'bg-red-600' : 'bg-cyan-600',
    accentHover: nightMode ? 'hover:bg-red-500' : 'hover:bg-cyan-500',
    accentBorder: nightMode ? 'border-red-500/50' : 'border-cyan-500/50',
    pulseDot: nightMode ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]',
    barGrad: nightMode ? 'from-red-800 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]',
    badgeBg: nightMode ? 'bg-red-950 border-red-800/60 text-red-300' : 'bg-slate-800 border-slate-700/60 text-slate-200'
  };

  return (
    <div className={`w-full min-h-screen ${theme.bg} ${nightMode ? 'text-red-100' : 'text-slate-100'} flex flex-col items-center overflow-x-hidden antialiased transition-colors duration-300 ${getFontSizeClass()}`}>
      <main className="w-full max-w-md px-4 pt-12 pb-36 flex flex-col flex-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.2rem)" }}>
        
        {/* 頂部安裝與離線提醒橫幅 */}
        {!isStandalone && (
          <div className={`mb-3 ${nightMode ? 'bg-red-950/50 border-red-500/40' : 'bg-cyan-950/70 border-cyan-500/40'} border rounded-2xl p-3 flex items-center justify-between shadow-lg backdrop-blur`}>
            <div className="flex items-center gap-2.5 text-xs">
              <svg className={`w-4 h-4 ${theme.accentText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
              <div>
                <div className={`font-bold ${theme.accentText}`}>安裝為桌面 App</div>
                <div className="text-[10px] text-slate-400">加入主畫面可啟用 180 天長效離線資料庫</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className={`px-2.5 py-1.5 ${theme.accentBg} ${theme.accentHover} text-white font-bold text-[11px] rounded-xl active:scale-95 transition shadow-sm`}
            >
              操作指南
            </button>
          </div>
        )}

        {/* 頂部 Header & 快速工具列 */}
        <header className="flex justify-between items-center pb-3 pt-1">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${theme.pulseDot} animate-pulse`}></span>
              <h1 className="text-base font-black tracking-wider uppercase">TAIWAN NAVY</h1>
            </div>
            <p className="text-[10px] font-mono text-slate-400 pl-4.5">
              DB BUILD <span className={`font-semibold ${theme.accentText}`}>{lastUpdated}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleNightMode}
              className={`p-1.5 rounded-full border transition-all active:scale-95 ${nightMode ? 'bg-red-950 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'}`}
              title={nightMode ? "切換常規模式" : "切換夜戰紅光模式"}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            </button>

            <div className="bg-slate-900 border border-slate-800 rounded-full p-0.5 flex text-[10px] font-bold">
              {(['system', 'sm', 'md', 'lg'] as FontSizeOption[]).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleSetFontSize(size)}
                  className={`px-2 py-1 rounded-full transition ${fontSize === size ? (nightMode ? 'bg-red-600 text-white font-black' : 'bg-cyan-500 text-black font-black') : 'text-slate-400 hover:text-white'}`}
                >
                  {size === 'system' ? '預設' : size === 'sm' ? '小' : size === 'md' ? '中' : '大'}
                </button>
              ))}
            </div>

            <button 
              type="button"
              onClick={handleOpenAdmin}
              className="p-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-full text-slate-300 shadow-sm active:scale-95 transition-all backdrop-blur"
              title="管理後台"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </header>

        {/* 頂部戰術公告/廣告橫幅區域 */}
        {bannerText && (
          <div className={`mb-3 px-3.5 py-2.5 ${nightMode ? 'bg-red-950/60 border-red-500/40 text-red-200' : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-200'} border rounded-xl shadow-lg flex items-center gap-2.5 backdrop-blur`}>
            <span className={`w-2 h-2 rounded-full ${nightMode ? 'bg-red-400' : 'bg-cyan-400'} animate-ping`}></span>
            <p className="text-xs font-semibold tracking-wide leading-snug flex-1">
              {bannerText}
            </p>
          </div>
        )}

        {/* 搜尋框與特徵標籤篩選盤 */}
        {activeBottomTab !== 'stats' && (
          <div className="sticky top-2 z-20 mt-1 mb-3 space-y-2">
            <div className="relative flex items-center">
              <svg className="w-4 h-4 absolute left-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                placeholder="搜尋舷號、艦名或代號 (例: 172、052D)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full ${nightMode ? 'bg-black/90 border-red-900/60 focus:border-red-500' : 'bg-slate-900/90 border-slate-700/60 focus:border-cyan-500'} backdrop-blur-xl border rounded-2xl pl-9 pr-8 py-2.5 text-sm focus:outline-none shadow-md text-white placeholder-slate-500 transition-all`}
              />
              {searchTerm && (
                <button 
                  type="button"
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 text-xs bg-slate-800 text-slate-400 hover:text-white px-2 py-0.5 rounded-full"
                >
                  ✕
                </button>
              )}
            </div>

            {allVisualFeatures.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                <button
                  type="button"
                  onClick={() => setSelectedFeature(null)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg shrink-0 font-medium transition ${!selectedFeature ? (nightMode ? 'bg-red-600 text-white font-bold' : 'bg-cyan-500 text-black font-bold') : 'bg-slate-900 border border-slate-800 text-slate-400'}`}
                >
                  全部特徵
                </button>
                {allVisualFeatures.map(feature => (
                  <button
                    key={feature}
                    type="button"
                    onClick={() => setSelectedFeature(selectedFeature === feature ? null : feature)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg shrink-0 font-medium transition border ${selectedFeature === feature ? (nightMode ? 'bg-red-950 border-red-500 text-red-300 font-bold' : 'bg-cyan-950 border-cyan-400 text-cyan-300 font-bold') : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'}`}
                  >
                    {feature}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 載入狀態 */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative w-12 h-12">
              <div className={`w-12 h-12 rounded-full border-2 ${nightMode ? 'border-red-500/20 border-t-red-500' : 'border-cyan-500/20 border-t-cyan-400'} animate-spin`}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`w-2 h-2 rounded-full ${theme.accentBg} animate-ping`}></span>
              </div>
            </div>
            <div className={`flex items-center gap-1 text-xs font-mono ${theme.accentText} tracking-wider`}>
              <span>資料載入中</span>
              <span className="animate-pulse">.</span>
              <span className="animate-pulse delay-100">.</span>
              <span className="animate-pulse delay-200">.</span>
            </div>
          </div>
        ) : (
          activeBottomTab === 'stats' ? (
            <div className="space-y-4 pt-1">
              <div className="text-xs font-mono tracking-wider text-slate-400 font-bold uppercase flex items-center gap-2">
                <svg className={`w-4 h-4 ${theme.accentText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <span>每月使用頻率統計圖</span>
              </div>

              <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl p-4 space-y-4`}>
                <div className="space-y-3.5">
                  {sortedMonths.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">尚無活躍數據記錄</div>
                  ) : (
                    sortedMonths.map(month => {
                      const count = monthlyUsage[month] || 0;
                      const percentage = Math.max(Math.round((count / maxUsageCount) * 100), 6);

                      return (
                        <div key={month} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-mono text-slate-300 font-bold tracking-wide">{month}</span>
                            <span className={`font-mono ${theme.accentText} font-bold`}>{count} 次</span>
                          </div>
                          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                            <div 
                              className={`h-full rounded-full bg-gradient-to-r ${theme.barGrad} transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className={`${theme.cardBg} border ${theme.cardBorder} rounded-2xl p-4 flex justify-between items-center shadow-sm`}>
                <div>
                  <div className="text-xs font-bold tracking-wide">總累計查詢點閱次數</div>
                  <div className="text-[11px] text-slate-400 pt-0.5">離線本機即時累加統計</div>
                </div>
                <div className={`px-3.5 py-1.5 rounded-xl ${nightMode ? 'bg-red-950/80 border-red-500/40 text-red-400' : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-400'} border font-mono font-black text-sm`}>
                  {Object.values(queryCounts).reduce((a, b) => a + b, 0)} 次
                </div>
              </div>
            </div>
          ) : (
            <section className="space-y-3">
              {searchTerm && filteredShips.length > 0 && (
                <div className={`${nightMode ? 'bg-red-950/30 border-red-500/30' : 'bg-cyan-950/30 border-cyan-500/30'} border rounded-2xl p-3.5 shadow-lg`}>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className={`text-[11px] font-mono tracking-wider ${theme.accentText} font-bold uppercase`}>舷號比對結果 ({filteredShips.length})</span>
                  </div>
                  <div className="space-y-2">
                    {filteredShips.map(s => (
                      <div key={s.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center transition shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-lg font-black ${theme.accentText} tracking-tight`}>{s.hull_number}</span>
                          <div>
                            <div className="font-bold text-white text-xs">{s.name_zh}</div>
                            <div className="text-[10px] text-slate-400 font-medium">{s.status}</div>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setEditingShip(s)}
                          className={`px-2 py-1 text-xs font-semibold rounded-lg bg-slate-800 ${theme.accentText} border ${theme.cardBorder} transition active:scale-95`}
                        >
                          修改
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center px-1">
                <div className="text-[11px] font-mono tracking-wider text-slate-400 font-bold uppercase flex items-center gap-1.5">
                  {activeBottomTab === 'favorites' && (
                    <>
                      <svg className="w-3.5 h-3.5 text-amber-400 fill-current" viewBox="0 0 24 24">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                      </svg>
                      <span>我的最愛收藏 ({displayedClasses.length})</span>
                    </>
                  )}
                  {activeBottomTab === 'rankings' && (
                    <>
                      <svg className={`w-3.5 h-3.5 ${theme.accentText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.004 0V9.75m-6 0V6.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V9.75" />
                      </svg>
                      <span>查詢熱門排行榜 ({displayedClasses.length})</span>
                    </>
                  )}
                  {activeBottomTab === 'all' && (
                    <span>艦型清單 INDEX ({displayedClasses.length})</span>
                  )}
                </div>
                {isStandalone && (
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-800"
                  >
                    <span>離線須知</span>
                  </button>
                )}
              </div>

              {displayedClasses.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs">
                  {selectedFeature ? `無符合「${selectedFeature}」特徵之艦艇` : activeBottomTab === 'favorites' ? '尚未加入任何艦型至「我的最愛」' : '查無符合條件的艦艇資料'}
                </div>
              ) : (
                displayedClasses.map((c, index) => {
                  const isExpanded = expandedClassId === c.id;
                  const classShips = ships.filter(s => s.class_id === c.id);
                  const isFav = favorites.includes(c.id);
                  const isCompared = comparePool.includes(c.id);
                  const count = queryCounts[c.id] || 0;

                  return (
                    <div 
                      key={c.id} 
                      className={`${theme.cardBg} border rounded-2xl transition-all duration-200 shadow-sm overflow-hidden ${isExpanded ? `${theme.accentBorder} shadow-md` : `${theme.cardBorder}`}`}
                    >
                      <div 
                        onClick={() => handleToggleExpand(c.id)}
                        className="p-3.5 flex justify-between items-center cursor-pointer select-none"
                      >
                        <div className="space-y-1 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            {activeBottomTab === 'rankings' && (
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black font-mono ${index === 0 ? 'bg-amber-400 text-black' : index === 1 ? 'bg-slate-300 text-black' : index === 2 ? 'bg-amber-700 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                {index + 1}
                              </span>
                            )}
                            <span className={`font-mono font-black text-base ${theme.accentText}`}>{c.code}</span>
                            <span className="font-bold text-slate-100">{c.name_zh}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            {c.category && <span className={`px-2 py-0.5 rounded-full ${theme.badgeBg} font-medium`}>{c.category}</span>}
                            {c.nato_code && <span className="font-mono text-slate-400">代號: {c.nato_code}</span>}
                            {count > 0 && <span className={`text-[10px] font-mono ${theme.accentText}`}>查閱 {count} 次</span>}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => toggleCompare(c.id, e)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 active:scale-90 ${isCompared ? (nightMode ? 'bg-red-600 text-white shadow-sm' : 'bg-cyan-500 text-black shadow-sm') : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'}`}
                            title="加入雙艦比對"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                            </svg>
                            <span>{isCompared ? '已選取' : '比對'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => toggleFavorite(c.id, e)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition active:scale-75 ${isFav ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800/80 text-slate-500 hover:text-amber-400'}`}
                          >
                            <svg className="w-3.5 h-3.5" fill={isFav ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                            </svg>
                          </button>

                          <div className={`w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-white' : ''}`}>
                            ▼
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-black/40 space-y-3.5">
                          {c.image_url ? (
                            <div className="relative rounded-xl overflow-hidden border border-slate-700/80 shadow-md">
                              <img 
                                src={c.image_url} 
                                alt={c.name_zh} 
                                loading="lazy"
                                className="w-full h-44 object-cover object-center bg-slate-950" 
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-[10px] font-mono text-slate-300 border border-slate-700 flex items-center gap-1">
                                <span>艦影記錄</span>
                              </div>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-800 p-3 bg-slate-900/40 text-center text-xs text-slate-500">
                              <span>暫無艦影照片（可在下方編輯資料設定網址）</span>
                            </div>
                          )}

                          {c.visual_features && c.visual_features.length > 0 && (
                            <div>
                              <div className="text-[11px] font-bold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1.5">
                                <span>視覺辨識特徵</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {c.visual_features.map((f, i) => (
                                  <span key={i} className={`text-xs ${theme.badgeBg} border px-2 py-0.5 rounded-lg`}>
                                    {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {c.weapons_summary && (
                            <div>
                              <div className="text-[11px] font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1.5">
                                <span>武裝配置</span>
                              </div>
                              <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                                {c.weapons_summary}
                              </p>
                            </div>
                          )}

                          <div>
                            <div className="text-[11px] font-bold text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                              <span>已建檔單艦 ({classShips.length})</span>
                            </div>
                            {classShips.length > 0 ? (
                              <div className="grid grid-cols-2 gap-2">
                                {classShips.map(s => (
                                  <div key={s.id} className="bg-slate-900/90 border border-slate-800/80 p-2 rounded-xl flex justify-between items-center">
                                    <div>
                                      <div className={`font-mono font-bold ${theme.accentText} text-xs`}>{s.hull_number}</div>
                                      <div className="text-[11px] text-slate-300">{s.name_zh}</div>
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setEditingShip(s); }}
                                      className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
                                    >
                                      修改
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 py-1">尚無登錄單艦舷號</p>
                            )}
                          </div>

                          <div className="pt-1 flex justify-end">
                            <button 
                              type="button"
                              onClick={() => setEditingClass(c)}
                              className={`px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border ${theme.cardBorder} ${theme.accentText} rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95`}
                            >
                              編輯艦型資料 / 照片
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          )
        )}

        <footer className="mt-8 text-center text-xs text-slate-500 space-y-1">
          <p className="font-mono text-[10px] tracking-widest uppercase">戰術艦艇辨識系統</p>
          <p className="text-[11px]">全端同步 · 180天長效離線架構</p>
        </footer>
      </main>

      {/* 雙艦比對懸浮列 */}
      {comparePool.length > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
          <div className={`pointer-events-auto w-full max-w-sm ${nightMode ? 'bg-[#150406]/95 border-red-500/50' : 'bg-slate-900/95 border-cyan-500/50'} border backdrop-blur-xl p-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-2`}>
            <div className="flex items-center gap-2 overflow-hidden pl-1">
              <span className={`text-[10px] font-mono uppercase font-black ${theme.accentText}`}>比對池:</span>
              <div className="flex gap-1.5">
                {comparePool.map(id => {
                  const item = classes.find(c => c.id === id);
                  return (
                    <span key={id} className={`text-xs font-mono font-bold px-2 py-0.5 rounded-lg ${theme.badgeBg} border flex items-center gap-1`}>
                      <span>{item?.code || id}</span>
                      <button 
                        type="button" 
                        onClick={() => setComparePool(comparePool.filter(x => x !== id))}
                        className="text-[10px] text-slate-400 hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  );
                })}
                {comparePool.length === 1 && (
                  <span className="text-[11px] text-slate-500 italic pl-1">請再選 1 艘...</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setComparePool([])}
                className="text-[10px] text-slate-400 hover:text-white px-2 py-1"
              >
                重置
              </button>
              <button
                type="button"
                disabled={comparePool.length < 2}
                onClick={() => setShowCompareModal(true)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs text-white transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none ${theme.accentBg} ${theme.accentHover} shadow-md`}
              >
                啟動比對
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 雙艦比對視窗 */}
      {showCompareModal && compareShipA && compareShipB && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`w-full max-w-lg ${nightMode ? 'bg-[#0a0203] border-red-900/60' : 'bg-slate-900 border-slate-800'} border-t sm:border rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl`}>
            
            <div className="p-4 border-b border-slate-800 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <svg className={`w-4 h-4 ${theme.accentText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                </svg>
                <h3 className="font-bold text-sm text-white tracking-wide">雙艦型同屏快速比對</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowCompareModal(false)} 
                className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-full bg-slate-800"
              >
                ✕ 關閉
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black h-32 flex items-center justify-center">
                    {compareShipA.image_url ? (
                      <img src={compareShipA.image_url} alt={compareShipA.name_zh} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] text-slate-500">暫無照片</span>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono font-bold text-cyan-300">
                      {compareShipA.code}
                    </span>
                  </div>
                  <div className="font-bold text-white text-center text-sm">{compareShipA.name_zh}</div>
                </div>

                <div className="space-y-1.5">
                  <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-black h-32 flex items-center justify-center">
                    {compareShipB.image_url ? (
                      <img src={compareShipB.image_url} alt={compareShipB.name_zh} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] text-slate-500">暫無照片</span>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono font-bold text-cyan-300">
                      {compareShipB.code}
                    </span>
                  </div>
                  <div className="font-bold text-white text-center text-sm">{compareShipB.name_zh}</div>
                </div>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2.5">
                <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider text-center">
                  CLASSIFICATION & NATO CODE
                </div>
                <div className="grid grid-cols-2 gap-3 text-center divide-x divide-slate-800">
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[11px]">艦種分類</div>
                    <div className="font-bold text-white">{compareShipA.category || '-'}</div>
                    <div className="text-slate-400 text-[11px] pt-1">英文代號</div>
                    <div className={`font-mono font-bold ${theme.accentText}`}>{compareShipA.nato_code || '-'}</div>
                  </div>
                  <div className="space-y-1 pl-3">
                    <div className="text-slate-400 text-[11px]">艦種分類</div>
                    <div className="font-bold text-white">{compareShipB.category || '-'}</div>
                    <div className="text-slate-400 text-[11px] pt-1">英文代號</div>
                    <div className={`font-mono font-bold ${theme.accentText}`}>{compareShipB.nato_code || '-'}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`}></span>
                  <span>視覺辨識特徵對照</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
                    <div className="font-mono text-[10px] text-cyan-400 font-bold">{compareShipA.code} 特徵:</div>
                    <div className="flex flex-wrap gap-1">
                      {compareShipA.visual_features?.map((f, i) => (
                        <span key={i} className={`text-[10px] ${theme.badgeBg} border px-1.5 py-0.5 rounded`}>{f}</span>
                      )) || <span className="text-slate-500 text-[10px]">無紀錄</span>}
                    </div>
                  </div>

                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
                    <div className="font-mono text-[10px] text-cyan-400 font-bold">{compareShipB.code} 特徵:</div>
                    <div className="flex flex-wrap gap-1">
                      {compareShipB.visual_features?.map((f, i) => (
                        <span key={i} className={`text-[10px] ${theme.badgeBg} border px-1.5 py-0.5 rounded`}>{f}</span>
                      )) || <span className="text-slate-500 text-[10px]">無紀錄</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`}></span>
                  <span>武裝火力配置對照</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 leading-relaxed">
                    <div className="font-mono text-[10px] text-cyan-400 font-bold mb-1">{compareShipA.code}:</div>
                    {compareShipA.weapons_summary || '無武裝資料'}
                  </div>
                  <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 text-[11px] text-slate-300 leading-relaxed">
                    <div className="font-mono text-[10px] text-cyan-400 font-bold mb-1">{compareShipB.code}:</div>
                    {compareShipB.weapons_summary || '無武裝資料'}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 底部導航列 */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 ${nightMode ? 'bg-[#080203]/95 border-red-900/50' : 'bg-[#0b0f17]/95 border-slate-800'} backdrop-blur-xl border-t flex justify-center shadow-2xl`} style={{ paddingBottom: "env(safe-area-inset-bottom, 0.5rem)" }}>
        <div className="w-full max-w-md flex justify-around items-center px-3 py-1.5 text-[11px] font-medium">
          
          <button
            type="button"
            onClick={() => setActiveBottomTab('all')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition relative ${activeBottomTab === 'all' ? `${theme.accentText} font-bold` : 'text-slate-400 hover:text-slate-200'}`}
          >
            {activeBottomTab === 'all' && (
              <span className={`absolute -top-1.5 w-6 h-0.5 ${nightMode ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'} rounded-full`}></span>
            )}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeBottomTab === 'all' ? 2.2 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span className="tracking-wider">全部艦型</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveBottomTab('favorites')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition relative ${activeBottomTab === 'favorites' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-slate-200'}`}
          >
            {activeBottomTab === 'favorites' && (
              <span className="absolute -top-1.5 w-6 h-0.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
            )}
            <svg className="w-5 h-5" fill={activeBottomTab === 'favorites' ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <span className="tracking-wider">我的最愛</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveBottomTab('rankings')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition relative ${activeBottomTab === 'rankings' ? `${theme.accentText} font-bold` : 'text-slate-400 hover:text-slate-200'}`}
          >
            {activeBottomTab === 'rankings' && (
              <span className={`absolute -top-1.5 w-6 h-0.5 ${nightMode ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'} rounded-full`}></span>
            )}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeBottomTab === 'rankings' ? 2.2 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.004 0V9.75m-6 0V6.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V9.75" />
            </svg>
            <span className="tracking-wider">查詢排行</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveBottomTab('stats')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition relative ${activeBottomTab === 'stats' ? `${theme.accentText} font-bold` : 'text-slate-400 hover:text-slate-200'}`}
          >
            {activeBottomTab === 'stats' && (
              <span className={`absolute -top-1.5 w-6 h-0.5 ${nightMode ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]'} rounded-full`}></span>
            )}
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={activeBottomTab === 'stats' ? 2.2 : 1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            <span className="tracking-wider">每月統計</span>
          </button>

        </div>
      </nav>

      {/* 指南彈窗 */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <svg className={`w-4 h-4 ${theme.accentText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                </svg>
                <h3 className="font-bold text-sm text-white">安裝指南與離線注意事項</h3>
              </div>
              <button type="button" onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-white text-xs px-2 py-1">✕</button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <div className={`font-bold ${theme.accentText} flex items-center gap-1.5`}>
                  <span>1.</span> 加入主畫面（獨立 App）
                </div>
                <p className="text-slate-400 text-[11px]">
                  • <b>iPhone (Safari)</b>：點擊底部分享按鈕 ➔ 選擇<b>「加入主畫面」</b>。<br/>
                  • <b>Android (Chrome)</b>：點右上角選單 ➔ 點<b>「安裝應用程式」</b>。
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <div className={`font-bold ${theme.accentText} flex items-center gap-1.5`}>
                  <span>2.</span> 出海前離線預載
                </div>
                <p className="text-slate-400 text-[11px]">
                  在基地有網路時，打開 App <b>滑動並展開各艦型一次</b>，系統會自動將資料庫與照片寫入手機硬碟（離線保護達 180 天）。
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <div className="font-bold text-amber-400 flex items-center gap-1.5">
                  <span>⚠️</span> 避免資料遺失
                </div>
                <p className="text-slate-400 text-[11px]">
                  • 斷網執行任務期間，<b>切勿手動清除手機瀏覽紀錄與快取資料</b>。
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className={`w-full py-2.5 ${theme.accentBg} ${theme.accentHover} rounded-xl text-xs font-bold text-white shadow-lg active:scale-95 transition`}
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* 授權密碼彈窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className={`w-12 h-12 rounded-2xl ${nightMode ? 'bg-red-950/80 border-red-500/30 text-red-400' : 'bg-cyan-950/80 border-cyan-500/30 text-cyan-400'} border flex items-center justify-center mx-auto`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
              <h3 className="font-bold text-base text-white tracking-wide pt-2">後台管理驗證</h3>
              <p className="text-[11px] text-slate-400">請輸入管理通行密碼以存取資料庫</p>
            </div>

            <form onSubmit={handleVerifyPassword} className="space-y-3">
              <input
                type="password"
                autoFocus
                required
                maxLength={10}
                placeholder="請輸入 6 位授權碼"
                value={adminPasswordInput}
                onChange={e => setAdminPasswordInput(e.target.value)}
                className={`w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest font-mono text-white focus:outline-none ${nightMode ? 'focus:border-red-500' : 'focus:border-cyan-500'}`}
              />
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-400"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2.5 ${theme.accentBg} ${theme.accentHover} rounded-xl text-xs font-bold text-white shadow-lg active:scale-95 transition`}
                >
                  確認驗證
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 艦型編輯彈窗 */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mb-2"></div>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>編輯艦型</span> <span className={`font-mono ${theme.accentText} font-bold`}>{editingClass.code}</span>
              </h3>
              <button type="button" onClick={() => setEditingClass(null)} className="text-slate-400 hover:text-white text-xs px-2 py-1">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">艦型全名</label>
                <input
                  type="text"
                  value={editingClass.name_zh}
                  onChange={e => setEditingClass({ ...editingClass, name_zh: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className={`text-[11px] font-bold ${theme.accentText} mb-1 block`}>官方照片網址 (全體同步 + 自動離線快取)</label>
                <input
                  type="url"
                  placeholder="https://.../ship.jpg"
                  value={editingClass.image_url || ''}
                  onChange={e => setEditingClass({ ...editingClass, image_url: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">艦種分類 (手動輸入)</label>
                  <input
                    type="text"
                    placeholder="例如：驅逐艦"
                    value={editingClass.category}
                    onChange={e => setEditingClass({ ...editingClass, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">英文代號</label>
                  <input
                    type="text"
                    placeholder="例: LHA、DDG、FFG"
                    value={editingClass.nato_code || ''}
                    onChange={e => setEditingClass({ ...editingClass, nato_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">視覺辨識特徵 (用逗號隔開)</label>
                <textarea
                  rows={3}
                  value={editingClass.visual_features?.join('，') || ''}
                  onChange={e => setEditingClass({ ...editingClass, visual_features: e.target.value.split(/[,，]/) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 leading-relaxed"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">武裝配置總結</label>
                <input
                  type="text"
                  value={editingClass.weapons_summary || ''}
                  onChange={e => setEditingClass({ ...editingClass, weapons_summary: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditingClass(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300">取消</button>
              <button type="button" onClick={saveClassEdit} className={`flex-1 py-2.5 ${theme.accentBg} ${theme.accentHover} rounded-xl text-xs font-bold text-white shadow-lg`}>發布修改至雲端</button>
            </div>
          </div>
        </div>
      )}

      {/* 單艦修改彈窗 */}
      {editingShip && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mb-2"></div>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>修改單艦</span> <span className={`font-mono ${theme.accentText} font-bold`}>{editingShip.hull_number}</span>
              </h3>
              <button type="button" onClick={() => setEditingShip(null)} className="text-slate-400 hover:text-white text-xs px-2 py-1">✕</button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">艦名</label>
                <input
                  type="text"
                  value={editingShip.name_zh}
                  onChange={e => setEditingShip({ ...editingShip, name_zh: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">服役狀態</label>
                <input
                  type="text"
                  placeholder="例如：現役、海試、退役"
                  value={editingShip.status}
                  onChange={e => setEditingShip({ ...editingShip, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button type="button" onClick={() => setEditingShip(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300">取消</button>
              <button type="button" onClick={saveShipEdit} className={`flex-1 py-2.5 ${theme.accentBg} ${theme.accentHover} rounded-xl text-xs font-bold text-white shadow-lg`}>儲存更新</button>
            </div>
          </div>
        </div>
      )}

      {/* 後台管理抽屜 (含維基百科一鍵匯入) */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mt-3 mb-1"></div>
            
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-base text-white flex items-center gap-2">
                <svg className={`w-4 h-4 ${theme.accentText}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>資料庫管理後台</span>
              </h2>
              <button type="button" onClick={() => setShowAdmin(false)} className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-full bg-slate-800">✕ 關閉</button>
            </div>

            <div className="flex border-b border-slate-800 text-xs font-bold p-1 bg-slate-950/60 mx-4 mt-3 rounded-xl gap-1">
              <button 
                type="button"
                onClick={() => setActiveTab('classes')}
                className={`flex-1 py-2 rounded-lg text-center transition ${activeTab === 'classes' ? `${theme.accentText} bg-slate-800 shadow-sm` : 'text-slate-400'}`}
              >
                ＋ 新增艦型
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('ships')}
                className={`flex-1 py-2 rounded-lg text-center transition ${activeTab === 'ships' ? `${theme.accentText} bg-slate-800 shadow-sm` : 'text-slate-400'}`}
              >
                ＋ 新增舷號
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('banner')}
                className={`flex-1 py-2 rounded-lg text-center transition ${activeTab === 'banner' ? `${theme.accentText} bg-slate-800 shadow-sm` : 'text-slate-400'}`}
              >
                頂部橫幅
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {activeTab === 'banner' && (
                <form onSubmit={handleSaveBanner} className="space-y-3.5">
                  <div>
                    <label className="text-slate-300 font-bold mb-1.5 block">頂部戰術公告 / 廣告橫幅內容</label>
                    <textarea 
                      rows={3}
                      placeholder="輸入欲廣播的文字（留空則自動隱藏橫幅）"
                      value={adminBannerInput} 
                      onChange={e => setAdminBannerInput(e.target.value)} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500 leading-relaxed" 
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      提示：此橫幅顯示於主頁「TAIWAN NAVY」下方。文字清空儲存後自動隱藏。
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setAdminBannerInput('')}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold"
                    >
                      清空文字
                    </button>
                    <button 
                      type="submit" 
                      disabled={isSavingBanner}
                      className={`flex-1 py-2.5 ${theme.accentBg} ${theme.accentHover} disabled:opacity-50 rounded-xl font-bold text-white shadow-lg active:scale-95 transition`}
                    >
                      {isSavingBanner ? '同步發布中...' : '發布通報至所有裝置'}
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'classes' && (
                <div className="space-y-4">
                  {/* 🌐 維基百科一鍵自動抓取面板 */}
                  <div className="p-3 bg-gradient-to-r from-cyan-950/40 to-slate-950 border border-cyan-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                        <span>維基百科一鍵自動擷取</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">MEDIAWIKI API</span>
                    </div>

                    <div className="flex gap-1.5">
                      <input 
                        type="text"
                        placeholder="輸入維基條目名或網址 (例: 052D型导弹驱逐舰)"
                        value={wikiQuery}
                        onChange={e => setWikiQuery(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        disabled={isFetchingWiki}
                        onClick={handleFetchWikipedia}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shrink-0 active:scale-95"
                      >
                        {isFetchingWiki ? '擷取中...' : '自動填表'}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      自動抓取維基官方艦影主圖、艦名、分類與武裝資訊，抓取後可手動微調再發布。
                    </p>
                  </div>

                  <form onSubmit={handleCreateClass} className="space-y-3">
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">艦型代號 (例: 052D)</label>
                      <input 
                        required 
                        placeholder="例: 052D"
                        value={newClass.code} 
                        onChange={e => setNewClass({ ...newClass, code: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">艦型全名 (例: 052D型飛彈驅逐艦)</label>
                      <input 
                        required 
                        placeholder="例: 052D型飛彈驅逐艦"
                        value={newClass.name_zh} 
                        onChange={e => setNewClass({ ...newClass, name_zh: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">艦艇照片網址 (維基自動帶入或手動輸入)</label>
                      <input 
                        type="url"
                        placeholder="例: https://.../ship.jpg"
                        value={newClass.image_url} 
                        onChange={e => setNewClass({ ...newClass, image_url: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 font-bold mb-1 block">艦種分類 (手動輸入)</label>
                        <input 
                          required 
                          placeholder="例: 驅逐艦、巡防艦" 
                          value={newClass.category} 
                          onChange={e => setNewClass({ ...newClass, category: e.target.value })} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 font-bold mb-1 block">英文代號</label>
                        <input 
                          placeholder="例: LHA、DDG、FFG"
                          value={newClass.nato_code} 
                          onChange={e => setNewClass({ ...newClass, nato_code: e.target.value })} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">外型辨識特徵 (請用逗號隔開)</label>
                      <textarea 
                        rows={2} 
                        value={newClass.visual_features} 
                        onChange={e => setNewClass({ ...newClass, visual_features: e.target.value })} 
                        placeholder="相控陣雷達, 封閉式艦橋, 64單元VLS" 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">武裝概要</label>
                      <input 
                        placeholder="例: 64單元通用垂直發射系統、130mm艦砲"
                        value={newClass.weapons_summary} 
                        onChange={e => setNewClass({ ...newClass, weapons_summary: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                    <button type="submit" className={`w-full py-3 ${theme.accentBg} ${theme.accentHover} rounded-xl font-bold text-white shadow-lg active:scale-95 transition`}>
                      新增艦型至雲端資料庫
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'ships' && (
                <form onSubmit={handleCreateShip} className="space-y-3">
                  <div>
                    <label className="text-slate-400 font-bold mb-1 block">所屬艦型</label>
                    <select 
                      required 
                      value={newShip.class_id} 
                      onChange={e => setNewShip({ ...newShip, class_id: e.target.value })} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                    >
                      <option value="">-- 請選擇所屬艦型 --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.code} - {c.name_zh}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">舷號 (例: 175)</label>
                      <input 
                        required 
                        placeholder="例: 175"
                        value={newShip.hull_number} 
                        onChange={e => setNewShip({ ...newShip, hull_number: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">艦名 (例: 銀川)</label>
                      <input 
                        required 
                        placeholder="例: 銀川"
                        value={newShip.name_zh} 
                        onChange={e => setNewShip({ ...newShip, name_zh: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400 font-bold mb-1 block">現況狀態 (手動輸入)</label>
                    <input 
                      required
                      placeholder="例: 現役、海試、下水舾裝、退役"
                      value={newShip.status} 
                      onChange={e => setNewShip({ ...newShip, status: e.target.value })} 
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                    />
                  </div>
                  <button type="submit" className={`w-full py-3 ${theme.accentBg} ${theme.accentHover} rounded-xl font-bold text-white shadow-lg active:scale-95 transition`}>
                    新增單艦至雲端資料庫
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
