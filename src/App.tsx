import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

interface ShipClass {
  id: string;
  code: string;
  name_zh: string;
  category: string;
  nato_code?: string;
  visual_features: string[];
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

  const [newClass, setNewClass] = useState({ id: '', code: '', name_zh: '', category: '驅逐艦', nato_code: '', visual_features: '', weapons_summary: '' });
  const [newShip, setNewShip] = useState({ id: '', class_id: '', hull_number: '', name_zh: '', status: '現役' });

  const fetchData = async () => {
    if (!supabase) return;
    try {
      const { data: cData } = await supabase.from('ship_classes').select('*').order('code');
      const { data: sData } = await supabase.from('ships').select('*').order('hull_number');
      if (cData) setClasses(cData);
      if (sData) setShips(sData);
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
    c.nato_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const saveClassEdit = async () => {
    if (!editingClass || !supabase) return;
    await supabase.from('ship_classes').update({
      name_zh: editingClass.name_zh,
      weapons_summary: editingClass.weapons_summary,
      visual_features: editingClass.visual_features
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
    const cid = newClass.id || `c-${newClass.code.toLowerCase()}`;
    await supabase.from('ship_classes').insert([{
      id: cid,
      code: newClass.code,
      name_zh: newClass.name_zh,
      category: newClass.category,
      nato_code: newClass.nato_code,
      visual_features: newClass.visual_features.split(/[,，]/).map(s => s.trim()).filter(Boolean),
      weapons_summary: newClass.weapons_summary
    }]);
    setNewClass({ id: '', code: '', name_zh: '', category: '驅逐艦', nato_code: '', visual_features: '', weapons_summary: '' });
    fetchData();
    alert('艦型新增成功！');
  };

  const handleCreateShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const sid = newShip.id || `s-${newShip.hull_number}`;
    await supabase.from('ships').insert([{
      id: sid,
      class_id: newShip.class_id,
      hull_number: newShip.hull_number,
      name_zh: newShip.name_zh,
      status: newShip.status
    }]);
    setNewShip({ id: '', class_id: '', hull_number: '', name_zh: '', status: '現役' });
    fetchData();
    alert('單艦新增成功！');
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center overflow-x-hidden select-none">
      <main className="w-full max-w-lg px-4 py-3 flex flex-col flex-1 pb-24 overflow-x-hidden">
        
        {/* 頂部 Header & 資料版本日期 */}
        <header className="flex justify-between items-center py-2 border-b border-slate-800">
          <div>
            <h1 className="text-xl font-bold tracking-wider text-cyan-400">SHIP ID // REF</h1>
            <p className="text-[11px] text-slate-400">資料庫版本：<span className="text-emerald-400 font-mono">{lastUpdated}</span></p>
          </div>
          <button 
            onClick={() => setShowAdmin(!showAdmin)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 text-cyan-300 active:scale-95 transition"
          >
            ⚙️ 後台管理
          </button>
        </header>

        {/* 搜尋列 */}
        <div className="mt-4 sticky top-2 z-20">
          <input
            type="text"
            placeholder="🔍 輸入舷號 (如 172)、艦名或艦型 (052D)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500 shadow-lg text-white placeholder-slate-500"
          />
        </div>

        {/* 內容區塊（純單頁往下滾動，不跨頁） */}
        <section className="mt-5 space-y-4">
          {searchTerm && filteredShips.length > 0 && (
            <div className="bg-slate-900/80 border border-cyan-900/40 rounded-xl p-3">
              <h2 className="text-xs font-semibold text-cyan-400 tracking-wider mb-2">舷號比對結果 ({filteredShips.length})</h2>
              <div className="space-y-2">
                {filteredShips.map(s => (
                  <div key={s.id} className="bg-slate-800/80 p-2.5 rounded-lg flex justify-between items-center border border-slate-700/60">
                    <div>
                      <span className="text-cyan-300 font-mono font-bold text-base mr-2">{s.hull_number}</span>
                      <span className="font-medium text-white">{s.name_zh}</span>
                      <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{s.status}</span>
                    </div>
                    <button 
                      onClick={() => setEditingShip(s)}
                      className="text-xs bg-slate-700/80 hover:bg-cyan-600/30 text-cyan-300 px-2.5 py-1 rounded border border-cyan-500/30 flex items-center gap-1"
                    >
                      ✏️ 立即修改
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 艦型清單 */}
          <div className="space-y-3">
            <h2 className="text-xs font-semibold text-slate-400 tracking-wider">艦型資料庫 ({filteredClasses.length})</h2>
            {filteredClasses.map(c => {
              const isExpanded = expandedClassId === c.id;
              const classShips = ships.filter(s => s.class_id === c.id);

              return (
                <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                  <div 
                    onClick={() => setExpandedClassId(isExpanded ? null : c.id)}
                    className="p-3.5 flex justify-between items-center cursor-pointer hover:bg-slate-800/50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-cyan-400">{c.code}</span>
                        <span className="font-semibold text-slate-200">{c.name_zh}</span>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {c.category} {c.nato_code && `· NATO: ${c.nato_code}`}
                      </div>
                    </div>
                    <span className="text-slate-500 text-sm">{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {isExpanded && (
                    <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800/80 bg-slate-950/40 space-y-3 text-xs">
                      <div>
                        <div className="text-slate-400 font-semibold mb-1">🔍 辨識特徵：</div>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                          {c.visual_features?.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>

                      {c.weapons_summary && (
                        <div>
                          <div className="text-slate-400 font-semibold mb-1">⚔️ 武裝配置：</div>
                          <p className="text-slate-300 leading-relaxed">{c.weapons_summary}</p>
                        </div>
                      )}

                      <div>
                        <div className="text-slate-400 font-semibold mb-1">⚓️ 已知在役單艦 ({classShips.length})：</div>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {classShips.map(s => (
                            <div key={s.id} className="bg-slate-800/60 px-2 py-1.5 rounded flex justify-between items-center">
                              <span><strong className="text-cyan-300 font-mono">{s.hull_number}</strong> {s.name_zh}</span>
                              <button onClick={() => setEditingShip(s)} className="text-[10px] text-cyan-400 hover:underline">修改</button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button 
                          onClick={() => setEditingClass(c)}
                          className="px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-medium flex items-center gap-1.5"
                        >
                          ✏️ 立即修改此艦型 (Wiki)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-8 text-center text-[11px] text-slate-500 pb-6 border-t border-slate-900 pt-4">
          SHIP ID 資料庫 · 離線優先架構 · 最後維護：{lastUpdated}
        </footer>
      </main>

      {/* 單艦立即修改彈窗 */}
      {editingShip && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3">
            <h3 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
              ✏️ 立即修改單艦：{editingShip.hull_number}
            </h3>
            <div>
              <label className="text-xs text-slate-400">艦名</label>
              <input
                type="text"
                value={editingShip.name_zh}
                onChange={e => setEditingShip({ ...editingShip, name_zh: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm mt-1 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">狀態</label>
              <select
                value={editingShip.status}
                onChange={e => setEditingShip({ ...editingShip, status: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm mt-1 text-white"
              >
                <option value="現役">現役</option>
                <option value="海試">海試</option>
                <option value="下水舾裝">下水舾裝</option>
                <option value="退役">退役</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingShip(null)} className="flex-1 py-2 bg-slate-800 rounded-lg text-xs text-slate-300">取消</button>
              <button onClick={saveShipEdit} className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-bold text-white">儲存更新</button>
            </div>
          </div>
        </div>
      )}

      {/* 艦型立即修改彈窗 */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3">
            <h3 className="font-bold text-sm text-cyan-400 flex items-center gap-2">
              ✏️ 立即修改艦型：{editingClass.code}
            </h3>
            <div>
              <label className="text-xs text-slate-400">全名</label>
              <input
                type="text"
                value={editingClass.name_zh}
                onChange={e => setEditingClass({ ...editingClass, name_zh: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm mt-1 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">辨識特徵 (逗號隔開)</label>
              <textarea
                rows={3}
                value={editingClass.visual_features?.join('，')}
                onChange={e => setEditingClass({ ...editingClass, visual_features: e.target.value.split(/[,，]/) })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm mt-1 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">武裝總結</label>
              <input
                type="text"
                value={editingClass.weapons_summary || ''}
                onChange={e => setEditingClass({ ...editingClass, weapons_summary: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-sm mt-1 text-white"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingClass(null)} className="flex-1 py-2 bg-slate-800 rounded-lg text-xs text-slate-300">取消</button>
              <button onClick={saveClassEdit} className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-xs font-bold text-white">儲存發布</button>
            </div>
          </div>
        </div>
      )}

      {/* 後台管理面板抽屜 */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-base text-cyan-400">⚙️ 資料庫後台管理</h2>
              <button onClick={() => setShowAdmin(false)} className="text-slate-400 hover:text-white text-sm px-2 py-1">✕ 關閉</button>
            </div>

            <div className="flex border-b border-slate-800 text-xs font-bold">
              <button 
                onClick={() => setActiveTab('classes')}
                className={`flex-1 py-3 text-center ${activeTab === 'classes' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/40' : 'text-slate-400'}`}
              >
                ＋ 新增艦型
              </button>
              <button 
                onClick={() => setActiveTab('ships')}
                className={`flex-1 py-3 text-center ${activeTab === 'ships' ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-800/40' : 'text-slate-400'}`}
              >
                ＋ 新增單艦舷號
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {activeTab === 'classes' ? (
                <form onSubmit={handleCreateClass} className="space-y-3">
                  <div>
                    <label className="text-slate-400">艦型代號 (如: 052D)</label>
                    <input 
                      required 
                      value={newClass.code} 
                      onChange={e => setNewClass({ ...newClass, code: e.target.value })} 
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1" 
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">艦型全名 (如: 052D型飛彈驅逐艦)</label>
                    <input 
                      required 
                      value={newClass.name_zh} 
                      onChange={e => setNewClass({ ...newClass, name_zh: e.target.value })} 
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400">艦種分類</label>
                      <select 
                        value={newClass.category} 
                        onChange={e => setNewClass({ ...newClass, category: e.target.value })} 
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1"
                      >
                        <option value="驅逐艦">驅逐艦</option>
                        <option value="護衛艦">護衛艦</option>
                        <option value="登陸艦">登陸艦</option>
                        <option value="補給艦">補給艦</option>
                        <option value="潛艦">潛艦</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400">NATO 代號 (選填)</label>
                      <input 
                        value={newClass.nato_code} 
                        onChange={e => setNewClass({ ...newClass, nato_code: e.target.value })} 
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400">外型辨識特徵 (請用逗號隔開)</label>
                    <textarea 
                      rows={2} 
                      value={newClass.visual_features} 
                      onChange={e => setNewClass({ ...newClass, visual_features: e.target.value })} 
                      placeholder="相控陣雷達, 封閉式艦橋, 64單元VLS" 
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1" 
                    />
                  </div>
                  <div>
                    <label className="text-slate-400">主要武裝概要</label>
                    <input 
                      value={newClass.weapons_summary} 
                      onChange={e => setNewClass({ ...newClass, weapons_summary: e.target.value })} 
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1" 
                    />
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-bold text-white mt-2">
                    新增艦型至資料庫
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCreateShip} className="space-y-3">
                  <div>
                    <label className="text-slate-400">所屬艦型</label>
                    <select 
                      required 
                      value={newShip.class_id} 
                      onChange={e => setNewShip({ ...newShip, class_id: e.target.value })} 
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1"
                    >
                      <option value="">-- 請選擇所屬艦型 --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.code} - {c.name_zh}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400">舷號 (如: 175)</label>
                      <input 
                        required 
                        value={newShip.hull_number} 
                        onChange={e => setNewShip({ ...newShip, hull_number: e.target.value })} 
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1" 
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">艦名 (如: 銀川)</label>
                      <input 
                        required 
                        value={newShip.name_zh} 
                        onChange={e => setNewShip({ ...newShip, name_zh: e.target.value })} 
                        className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-400">現況狀態</label>
                    <select 
                      value={newShip.status} 
                      onChange={e => setNewShip({ ...newShip, status: e.target.value })} 
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mt-1"
                    >
                      <option value="現役">現役</option>
                      <option value="海試">海試</option>
                      <option value="下水舾裝">下水舾裝</option>
                      <option value="退役">退役</option>
                    </select>
                  </div>
                  <button type="submit" className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg font-bold text-white mt-2">
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
