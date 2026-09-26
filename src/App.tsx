import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

interface ShipClass {
  id: string;
  code: string;
  name_zh: string;
  category: string;
  nato_code?: string;
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

export default function App() {
  const [classes, setClasses] = useState<ShipClass[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('2026.09.27');

  const [showAdmin, setShowAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'classes' | 'ships'>('classes');

  const [editingClass, setEditingClass] = useState<ShipClass | null>(null);
  const [editingShip, setEditingShip] = useState<Ship | null>(null);

  const [newClass, setNewClass] = useState({ code: '', name_zh: '', category: '', nato_code: '', visual_features: '', weapons_summary: '' });
  const [newShip, setNewShip] = useState({ class_id: '', hull_number: '', name_zh: '', status: '現役' });

  useEffect(() => {
    document.title = "TAIWAN NAVY";
  }, []);

  const fetchData = async () => {
    if (!supabase) return;
    try {
      const { data: cData } = await supabase.from('ship_classes').select('*').order('code');
      const { data: sData } = await supabase.from('ships').select('*').order('hull_number');
      if (cData) setClasses(cData as ShipClass[]);
      if (sData) setShips(sData as Ship[]);
      setLastUpdated(new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredShips = ships.filter(s => 
    s.hull_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.name_zh.includes(searchTerm)
  );

  const filteredClasses = classes.filter(c =>
    c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.name_zh.includes(searchTerm) ||
    (c.nato_code && c.nato_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const saveClassEdit = async () => {
    if (!editingClass || !supabase) return;
    await supabase.from('ship_classes').update({
      name_zh: editingClass.name_zh,
      category: editingClass.category,
      nato_code: editingClass.nato_code || '',
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
      visual_features: newClass.visual_features.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      weapons_summary: newClass.weapons_summary.trim()
    }]);
    setNewClass({ code: '', name_zh: '', category: '', nato_code: '', visual_features: '', weapons_summary: '' });
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
    <div className="w-full min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col items-center overflow-x-hidden antialiased selection:bg-cyan-500/30">
      {/* 限制手機版寬度，iOS 安全邊距向下推避開瀏海/動態島 */}
      <main className="w-full max-w-md px-5 pt-14 pb-28 flex flex-col flex-1" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}>
        
        {/* 頂部 Header */}
        <header className="flex justify-between items-center pb-4 pt-1">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
              <h1 className="text-lg font-black tracking-wider text-slate-100 uppercase">TAIWAN NAVY</h1>
            </div>
            <p className="text-[11px] font-mono text-slate-400 pl-4.5">
              DB BUILD <span className="text-cyan-400 font-semibold">{lastUpdated}</span>
            </p>
          </div>

          <button 
            onClick={() => setShowAdmin(true)}
            className="px-3.5 py-1.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 rounded-full text-xs font-semibold text-slate-300 hover:text-cyan-400 shadow-sm active:scale-95 transition-all flex items-center gap-1.5 backdrop-blur"
          >
            <span>⚙️</span> 管理後台
          </button>
        </header>

        {/* 搜尋框 */}
        <div className="sticky top-3 z-20 mt-1 mb-5">
          <div className="relative flex items-center">
            <span className="absolute left-4 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="搜尋舷號、艦名或型號 (例: 172、052D)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-cyan-500/80 focus:ring-2 focus:ring-cyan-500/20 shadow-[0_8px_20px_rgba(0,0,0,0.4)] text-white placeholder-slate-500 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3.5 text-xs bg-slate-800 text-slate-400 hover:text-white px-2 py-0.5 rounded-full"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* 主內容區 */}
        <section className="space-y-4">
          {searchTerm && filteredShips.length > 0 && (
            <div className="bg-gradient-to-b from-cyan-950/30 to-slate-900/80 border border-cyan-500/30 rounded-2xl p-4 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-mono tracking-wider text-cyan-400 font-bold uppercase">舷號比對結果 ({filteredShips.length})</span>
              </div>
              <div className="space-y-2">
                {filteredShips.map(s => (
                  <div key={s.id} className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 rounded-xl p-3 flex justify-between items-center transition shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xl font-black text-cyan-400 tracking-tight">{s.hull_number}</span>
                      <div>
                        <div className="text-sm font-bold text-white">{s.name_zh}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{s.status}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setEditingShip(s)}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition active:scale-95"
                    >
                      ✏️ 修改
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 艦型清單 */}
          <div className="space-y-3">
            <div className="text-[11px] font-mono tracking-wider text-slate-500 font-bold uppercase px-1">
              艦型清單 INDEX ({filteredClasses.length})
            </div>

            {filteredClasses.map(c => {
              const isExpanded = expandedClassId === c.id;
              const classShips = ships.filter(s => s.class_id === c.id);

              return (
                <div 
                  key={c.id} 
                  className={`bg-slate-900/80 border rounded-2xl transition-all duration-200 shadow-md overflow-hidden ${isExpanded ? 'border-cyan-500/50 bg-slate-900' : 'border-slate-800 hover:border-slate-700'}`}
                >
                  <div 
                    onClick={() => setExpandedClassId(isExpanded ? null : c.id)}
                    className="p-4 flex justify-between items-center cursor-pointer select-none"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-black text-lg text-cyan-400">{c.code}</span>
                        <span className="font-bold text-slate-100 text-sm">{c.name_zh}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {c.category && <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">{c.category}</span>}
                        {c.nato_code && <span className="font-mono text-slate-400">英文代號: {c.nato_code}</span>}
                      </div>
                    </div>
                    
                    <div className={`w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-cyan-950 text-cyan-400' : ''}`}>
                      ▼
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-slate-950/40 space-y-4">
                      {c.visual_features && c.visual_features.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
                            <span>🔍</span> 視覺辨識特徵
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {c.visual_features.map((f, i) => (
                              <span key={i} className="text-xs bg-slate-800/80 border border-slate-700/60 text-slate-200 px-2.5 py-1 rounded-lg">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {c.weapons_summary && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 tracking-wider mb-1.5 flex items-center gap-1.5">
                            <span>⚔️</span> 武裝配置
                          </div>
                          <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                            {c.weapons_summary}
                          </p>
                        </div>
                      )}

                      <div>
                        <div className="text-[11px] font-bold text-slate-400 tracking-wider mb-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5"><span>⚓️</span> 已建檔單艦 ({classShips.length})</span>
                        </div>
                        {classShips.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {classShips.map(s => (
                              <div key={s.id} className="bg-slate-900/90 border border-slate-800/80 p-2.5 rounded-xl flex justify-between items-center">
                                <div>
                                  <div className="font-mono font-bold text-cyan-300 text-sm">{s.hull_number}</div>
                                  <div className="text-[11px] text-slate-300">{s.name_zh}</div>
                                </div>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setEditingShip(s); }}
                                  className="text-[11px] text-slate-400 hover:text-cyan-300 px-2 py-1 rounded bg-slate-800"
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

                      <div className="pt-2 flex justify-end">
                        <button 
                          onClick={() => setEditingClass(c)}
                          className="px-3.5 py-1.5 bg-cyan-950/50 hover:bg-cyan-900/50 border border-cyan-500/40 text-cyan-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                        >
                          ✏️ 編輯艦型資料 (Wiki)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-12 text-center text-xs text-slate-500 space-y-1">
          <p className="font-mono text-[10px] tracking-widest uppercase">TACTICAL NAVAL IDENTIFIER</p>
          <p className="text-[11px]">離線優先架構 · 資料庫同步正常</p>
        </footer>
      </main>

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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">服役狀態 (輸入文字，如現役、海試)</label>
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
              <button onClick={() => setEditingShip(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300">取消</button>
              <button onClick={saveShipEdit} className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-cyan-950">儲存更新</button>
            </div>
          </div>
        </div>
      )}

      {/* 艦型編輯彈窗 */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">英文代號</label>
                  <input
                    type="text"
                    placeholder="例如：Luyang III"
                    value={editingClass.nato_code || ''}
                    onChange={e => setEditingClass({ ...editingClass, nato_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button onClick={() => setEditingClass(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300">取消</button>
              <button onClick={saveClassEdit} className="flex-1 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white shadow-lg shadow-cyan-950">發布修改</button>
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
                <form onSubmit={handleCreateClass} className="space-y-3.5">
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
                        placeholder="例: Luyang III"
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
                    新增艦型至資料庫
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCreateShip} className="space-y-3.5">
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
                    新增單艦至資料庫
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
