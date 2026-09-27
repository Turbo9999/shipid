import React, { useState, useEffect } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('2026.09.27');

  // 後台通行碼授權狀態 (750120)
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('tn_admin_auth') === 'true';
  });

  // 安裝與離線注意事項狀態
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isStandalone] = useState<boolean>(() => {
    return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  });

  // 底部導航分頁
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('all');

  // 1. 字體大小設定 (依手機設定 / 小 / 中 / 大)
  const [fontSize, setFontSize] = useState<FontSizeOption>(() => {
    return (localStorage.getItem('tn_font_size') as FontSizeOption) || 'system';
  });

  // 2. 我的最愛 (儲存 class_id 陣列)
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('tn_favorites');
    return saved ? JSON.parse(saved) : [];
  });

  // 3. 查詢點閱排行 (Key: class_id, Value: 點擊次數)
  const [queryCounts, setQueryCounts] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('tn_query_counts');
    return saved ? JSON.parse(saved) : {};
  });

  // 4. 每月使用次數統計 (Key: "YYYY-MM", Value: 次數)
  const [monthlyUsage, setMonthlyUsage] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('tn_monthly_usage');
    return saved ? JSON.parse(saved) : {};
  });

  const [activeTab, setActiveTab] = useState<'classes' | 'ships'>('classes');
  const [editingClass, setEditingClass] = useState<ShipClass | null>(null);
  const [editingShip, setEditingShip] = useState<Ship | null>(null);

  const [newClass, setNewClass] = useState({ code: '', name_zh: '', category: '', nato_code: '', image_url: '', visual_features: '', weapons_summary: '' });
  const [newShip, setNewShip] = useState({ class_id: '', hull_number: '', name_zh: '', status: '現役' });

  // 記錄每月使用量（每次打開 App 自動累加一次）
  useEffect(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const saved = localStorage.getItem('tn_monthly_usage');
    const currentMap = saved ? JSON.parse(saved) : {};
    currentMap[currentMonthKey] = (currentMap[currentMonthKey] || 0) + 1;
    localStorage.setItem('tn_monthly_usage', JSON.stringify(currentMap));
    setMonthlyUsage(currentMap);
  }, []);

  // 鎖定標題並向手機請求長效儲存配額
  useEffect(() => {
    document.title = "TAIWAN NAVY";
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(granted => {
        if (granted) console.log('✅ Persistent storage: 已獲得系統長效儲存保護');
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

  // 雙重離線備援資料抓取
  const fetchData = async () => {
    const cachedClasses = localStorage.getItem('tn_cache_classes');
    const cachedShips = localStorage.getItem('tn_cache_ships');
    if (cachedClasses && classes.length === 0) setClasses(JSON.parse(cachedClasses));
    if (cachedShips && ships.length === 0) setShips(JSON.parse(cachedShips));

    if (!supabase) return;
    try {
      const { data: cData } = await supabase.from('ship_classes').select('*').order('code');
      const { data: sData } = await supabase.from('ships').select('*').order('hull_number');
      if (cData) {
        setClasses(cData as ShipClass[]);
        localStorage.setItem('tn_cache_classes', JSON.stringify(cData));
      }
      if (sData) {
        setShips(sData as Ship[]);
        localStorage.setItem('tn_cache_ships', JSON.stringify(sData));
      }
      setLastUpdated(new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }));
    } catch (e) {
      console.warn('離線環境：自動啟用本機長效快照資料庫', e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 切換最愛
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

  // 點擊卡片展開時自動累加查詢計數
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

  // 切換字體大小
  const handleSetFontSize = (size: FontSizeOption) => {
    setFontSize(size);
    localStorage.setItem('tn_font_size', size);
  };

  // 根據字體設定產生全站根樣式 Class
  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-[13px] leading-normal';
      case 'md': return 'text-[15px] leading-relaxed';
      case 'lg': return 'text-[17px] leading-loose';
      default: return 'text-sm leading-normal'; // 依手機系統預設
    }
  };

  const handleOpenAdmin = () => {
    if (isAuthenticated) {
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
      setShowAdmin(true);
    } else {
      alert('授權碼錯誤，請重新輸入！');
      setAdminPasswordInput('');
    }
  };

  const filteredShips = ships.filter(s => 
    s.hull_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.name_zh.includes(searchTerm)
  );

  let displayedClasses = classes.filter(c =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name_zh.includes(searchTerm) ||
    (c.nato_code && c.nato_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 我的最愛篩選
  if (activeBottomTab === 'favorites') {
    displayedClasses = displayedClasses.filter(c => favorites.includes(c.id));
  }

  // 查詢排行排序（降冪）
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

  return (
    <div className={`w-full min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col items-center overflow-x-hidden antialiased selection:bg-cyan-500/30 ${getFontSizeClass()}`}>
      <main className="w-full max-w-md px-4 pt-12 pb-32 flex flex-col flex-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.2rem)" }}>
        
        {/* 頂部安裝與離線提醒橫幅 */}
        {!isStandalone && (
          <div className="mb-3 bg-cyan-950/70 border border-cyan-500/40 rounded-2xl p-3 flex items-center justify-between shadow-lg backdrop-blur">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="text-base">📲</span>
              <div>
                <div className="font-bold text-cyan-300">安裝為桌面 App</div>
                <div className="text-[10px] text-slate-400">加入主畫面可啟用 180 天長效離線資料庫</div>
              </div>
            </div>
            <button
              onClick={() => setShowGuideModal(true)}
              className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] rounded-xl active:scale-95 transition shadow-sm"
            >
              操作指南
            </button>
          </div>
        )}

        {/* 頂部 Header & 快速工具列 */}
        <header className="flex justify-between items-center pb-3 pt-1">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
              <h1 className="text-base font-black tracking-wider text-slate-100 uppercase">TAIWAN NAVY</h1>
            </div>
            <p className="text-[10px] font-mono text-slate-400 pl-4.5">
              DB BUILD <span className="text-cyan-400 font-semibold">{lastUpdated}</span>
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* 字體調整切換鈕 */}
            <div className="bg-slate-900 border border-slate-800 rounded-full p-0.5 flex text-[10px] font-bold">
              {(['system', 'sm', 'md', 'lg'] as FontSizeOption[]).map(size => (
                <button
                  key={size}
                  onClick={() => handleSetFontSize(size)}
                  className={`px-2 py-1 rounded-full transition ${fontSize === size ? 'bg-cyan-500 text-black shadow-sm font-black' : 'text-slate-400 hover:text-white'}`}
                >
                  {size === 'system' ? '預設' : size === 'sm' ? '小' : size === 'md' ? '中' : '大'}
                </button>
              ))}
            </div>

            <button 
              onClick={handleOpenAdmin}
              className="p-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-full text-slate-300 hover:text-cyan-400 shadow-sm active:scale-95 transition-all backdrop-blur"
              title="管理後台"
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* 搜尋框 (僅在非統計頁面顯示) */}
        {activeBottomTab !== 'stats' && (
          <div className="sticky top-2 z-20 mt-1 mb-4">
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="搜尋舷號、艦名或代號 (例: 172、052D)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-2 focus:ring-cyan-500/20 shadow-md text-white placeholder-slate-500 transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 text-xs bg-slate-800 text-slate-400 hover:text-white px-2 py-0.5 rounded-full"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* 主內容區切換 */}
        {activeBottomTab === 'stats' ? (
          /* --- 使用次數統計頁面 --- */
          <div className="space-y-4 pt-1">
            <div className="text-xs font-mono tracking-wider text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <span>📊</span> 每月使用與查詢統計報表
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-bold text-white flex justify-between">
                <span>📅 活躍月份</span>
                <span>系統開啟次數</span>
              </div>
              <div className="space-y-2">
                {Object.keys(monthlyUsage).sort().reverse().map(month => (
                  <div key={month} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                    <span className="font-mono text-cyan-300 font-bold">{month}</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/30 text-cyan-400 font-mono font-bold text-xs">
                      {monthlyUsage[month]} 次
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="text-xs font-bold text-white flex justify-between">
                <span>🏆 總累計查詢點閱數</span>
                <span>{Object.values(queryCounts).reduce((a, b) => a + b, 0)} 次</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                每次於艦型清單點開檢視或搜尋該艦，系統將自動寫入本地統計數據，供艦艇出勤與辨識頻率分析使用。
              </p>
            </div>
          </div>
        ) : (
          /* --- 艦型列表 / 我的最愛 / 排行榜 --- */
          <section className="space-y-3">
            {searchTerm && filteredShips.length > 0 && (
              <div className="bg-gradient-to-b from-cyan-950/30 to-slate-900/80 border border-cyan-500/30 rounded-2xl p-3.5 shadow-lg">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-[11px] font-mono tracking-wider text-cyan-400 font-bold uppercase">舷號比對結果 ({filteredShips.length})</span>
                </div>
                <div className="space-y-2">
                  {filteredShips.map(s => (
                    <div key={s.id} className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center transition shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg font-black text-cyan-400 tracking-tight">{s.hull_number}</span>
                        <div>
                          <div className="font-bold text-white text-xs">{s.name_zh}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{s.status}</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setEditingShip(s)}
                        className="px-2 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition active:scale-95"
                      >
                        ✏️ 修改
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center px-1">
              <div className="text-[11px] font-mono tracking-wider text-slate-400 font-bold uppercase">
                {activeBottomTab === 'favorites' ? `⭐ 我的最愛收藏 (${displayedClasses.length})` : activeBottomTab === 'rankings' ? `🏆 查詢熱門排行榜 (${displayedClasses.length})` : `艦型清單 INDEX (${displayedClasses.length})`}
              </div>
              {isStandalone && (
                <button
                  onClick={() => setShowGuideModal(true)}
                  className="text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 bg-slate-900/60 px-2 py-0.5 rounded-full border border-slate-800"
                >
                  <span>ℹ️</span> 離線須知
                </button>
              )}
            </div>

            {displayedClasses.length === 0 ? (
              <div className="text-center py-10 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs">
                {activeBottomTab === 'favorites' ? '尚未加入任何艦型至「我的最愛」⭐' : '查無符合條件的艦艇資料'}
              </div>
            ) : (
              displayedClasses.map((c, index) => {
                const isExpanded = expandedClassId === c.id;
                const classShips = ships.filter(s => s.class_id === c.id);
                const isFav = favorites.includes(c.id);
                const count = queryCounts[c.id] || 0;

                return (
                  <div 
                    key={c.id} 
                    className={`bg-slate-900/80 border rounded-2xl transition-all duration-200 shadow-sm overflow-hidden ${isExpanded ? 'border-cyan-500/50 bg-slate-900 shadow-md' : 'border-slate-800 hover:border-slate-700'}`}
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
                          <span className="font-mono font-black text-base text-cyan-400">{c.code}</span>
                          <span className="font-bold text-slate-100">{c.name_zh}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          {c.category && <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">{c.category}</span>}
                          {c.nato_code && <span className="font-mono text-slate-400">代號: {c.nato_code}</span>}
                          {count > 0 && <span className="text-[10px] font-mono text-cyan-400/80">👀 {count} 次</span>}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* 星號收藏鈕 */}
                        <button
                          onClick={(e) => toggleFavorite(c.id, e)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition active:scale-75 ${isFav ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-800/80 text-slate-500 hover:text-amber-400'}`}
                        >
                          {isFav ? '★' : '☆'}
                        </button>
                        <div className={`w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-cyan-950 text-cyan-400' : ''}`}>
                          ▼
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-950/40 space-y-3.5">
                        {/* 官方艦影 */}
                        {c.image_url ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-700/80 shadow-md">
                            <img 
                              src={c.image_url} 
                              alt={c.name_zh} 
                              loading="lazy"
                              className="w-full h-44 object-cover object-center bg-slate-950" 
                            />
                            <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur text-[10px] font-mono text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                              <span>⚓️</span> 官方艦影
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-800 p-3 bg-slate-900/40 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                            <span>📷</span> <span>暫無艦影照片（可在下方編輯資料設定網址）</span>
                          </div>
                        )}

                        {/* 視覺辨識特徵 */}
                        {c.visual_features && c.visual_features.length > 0 && (
                          <div>
                            <div className="text-[11px] font-bold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1.5">
                              <span>🔍</span> 視覺辨識特徵
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {c.visual_features.map((f, i) => (
                                <span key={i} className="text-xs bg-slate-800/80 border border-slate-700/60 text-slate-200 px-2 py-0.5 rounded-lg">
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 武裝配置 */}
                        {c.weapons_summary && (
                          <div>
                            <div className="text-[11px] font-bold text-slate-400 tracking-wider mb-1 flex items-center gap-1.5">
                              <span>⚔️</span> 武裝配置
                            </div>
                            <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                              {c.weapons_summary}
                            </p>
                          </div>
                        )}

                        {/* 單艦清單 */}
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><span>⚓️</span> 已建檔單艦 ({classShips.length})</span>
                          </div>
                          {classShips.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {classShips.map(s => (
                                <div key={s.id} className="bg-slate-900/90 border border-slate-800/80 p-2 rounded-xl flex justify-between items-center">
                                  <div>
                                    <div className="font-mono font-bold text-cyan-300 text-xs">{s.hull_number}</div>
                                    <div className="text-[11px] text-slate-300">{s.name_zh}</div>
                                  </div>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setEditingShip(s); }}
                                    className="text-[10px] text-slate-400 hover:text-cyan-300 px-2 py-1 rounded bg-slate-800"
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
                            onClick={() => setEditingClass(c)}
                            className="px-3 py-1.5 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                          >
                            ✏️ 編輯艦型資料 / 照片
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>
        )}

        <footer className="mt-8 text-center text-xs text-slate-500 space-y-1">
          <p className="font-mono text-[10px] tracking-widest uppercase">戰術艦艇辨識系統</p>
          <p className="text-[11px]">全端同步 · 180天長效離線架構</p>
        </footer>
      </main>

      {/* --- 底部常駐橫向功能導航列 (iOS 底部安全距離適配) --- */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 flex justify-center shadow-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom, 0.5rem)" }}>
        <div className="w-full max-w-md flex justify-around items-center px-2 py-2 text-xs">
          <button
            onClick={() => setActiveBottomTab('all')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeBottomTab === 'all' ? 'text-cyan-400 font-bold bg-cyan-950/40' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="text-base">🚢</span>
            <span>全部艦型</span>
          </button>

          <button
            onClick={() => setActiveBottomTab('favorites')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeBottomTab === 'favorites' ? 'text-amber-400 font-bold bg-amber-950/40' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="text-base">⭐</span>
            <span>我的最愛</span>
          </button>

          <button
            onClick={() => setActiveBottomTab('rankings')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeBottomTab === 'rankings' ? 'text-cyan-400 font-bold bg-cyan-950/40' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="text-base">🏆</span>
            <span>查詢排行</span>
          </button>

          <button
            onClick={() => setActiveBottomTab('stats')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${activeBottomTab === 'stats' ? 'text-cyan-400 font-bold bg-cyan-950/40' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <span className="text-base">📊</span>
            <span>每月統計</span>
          </button>
        </div>
      </nav>

      {/* 注意事項說明彈窗 */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📱</span>
                <h3 className="font-bold text-sm text-white">安裝指南與離線注意事項</h3>
              </div>
              <button onClick={() => setShowGuideModal(false)} className="text-slate-400 hover:text-white text-xs px-2 py-1">✕</button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                  <span>1.</span> 加入主畫面（獨立 App）
                </div>
                <p className="text-slate-400 text-[11px]">
                  • <b>iPhone (Safari)</b>：點擊底部分享按鈕 ➔ 選擇<b>「加入主畫面」</b>。<br/>
                  • <b>Android (Chrome)</b>：點右上角選單 ➔ 點<b>「安裝應用程式」</b>。
                </p>
              </div>

              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-1">
                <div className="font-bold text-cyan-400 flex items-center gap-1.5">
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
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-cyan-950 active:scale-95 transition"
            >
              我知道了
            </button>
          </div>
        </div>
      )}

      {/* 授權密碼彈窗 (750120) */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center mx-auto text-xl text-cyan-400">
                🔒
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest font-mono text-white focus:outline-none focus:border-cyan-500"
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
                  className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-cyan-950 active:scale-95 transition"
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
                ✏️ 編輯艦型 <span className="font-mono text-cyan-400 font-bold">{editingClass.code}</span>
              </h3>
              <button onClick={() => setEditingClass(null)} className="text-slate-400 hover:text-white text-xs px-2 py-1">✕</button>
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
                <label className="text-[11px] font-bold text-cyan-300 mb-1 block">🔗 官方照片網址 (全體同步 + 自動離線快取)</label>
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
              <button onClick={() => setEditingClass(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300">取消</button>
              <button onClick={saveClassEdit} className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-cyan-950">發布修改至雲端</button>
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
                ✏️ 修改單艦 <span className="font-mono text-cyan-400 font-bold">{editingShip.hull_number}</span>
              </h3>
              <button onClick={() => setEditingShip(null)} className="text-slate-400 hover:text-white text-xs px-2 py-1">✕</button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">艦名</label>
                <input
                  type="text"
                  value={editingShip.name_zh}
                  onChange={e => setEditingShip({ ...editingShip, name_zh: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">服役狀態</label>
                <input
                  type="text"
                  placeholder="例如：現役、海試、退役"
                  value={editingShip.status}
                  onChange={e => setEditingShip({ ...editingShip, status: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingShip(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300">取消</button>
              <button onClick={saveShipEdit} className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-cyan-950">儲存更新</button>
            </div>
          </div>
        </div>
      )}

      {/* 後台管理抽屜 */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mt-3 mb-1"></div>
            
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-base text-white flex items-center gap-2">
                <span>⚙️</span> 資料庫管理後台
              </h2>
              <button onClick={() => setShowAdmin(false)} className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-full bg-slate-800">✕ 關閉</button>
            </div>

            <div className="flex border-b border-slate-800 text-xs font-bold p-1 bg-slate-950/60 mx-4 mt-3 rounded-xl">
              <button 
                onClick={() => setActiveTab('classes')}
                className={`flex-1 py-2 rounded-lg text-center transition ${activeTab === 'classes' ? 'text-cyan-400 bg-slate-800 shadow-sm' : 'text-slate-400'}`}
              >
                ＋ 新增艦型
              </button>
              <button 
                onClick={() => setActiveTab('ships')}
                className={`flex-1 py-2 rounded-lg text-center transition ${activeTab === 'ships' ? 'text-cyan-400 bg-slate-800 shadow-sm' : 'text-slate-400'}`}
              >
                ＋ 新增單艦舷號
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {activeTab === 'classes' ? (
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
                    <label className="text-slate-400 font-bold mb-1 block">艦艇照片網址 (選填，全體同步)</label>
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
                  <button type="submit" className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold text-white shadow-lg shadow-cyan-950 active:scale-95 transition">
                    新增艦型至雲端資料庫
                  </button>
                </form>
              ) : (
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
                  <button type="submit" className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 rounded-xl font-bold text-white shadow-lg shadow-cyan-950 active:scale-95 transition">
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
