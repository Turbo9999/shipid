import React, { useState, useEffect } from 'react';
import { Search, Compass, Wifi, WifiOff, ShieldCheck } from 'lucide-react';
import { db } from './lib/db';

async function initData() {
  if (await db.ship_classes.count() === 0) {
    await db.ship_classes.bulkPut([
      { id: 'c1', code: '052D', name_zh: '052D型飛彈驅逐艦', category: '驅逐艦', nato_code: 'Luyang III', visual_features: ['346A型相控陣雷達', '64單元通用VLS', '八角隱身艦炮', '切角艦橋'] },
      { id: 'c2', code: '055', name_zh: '055型飛彈驅逐艦', category: '驅逐艦', nato_code: 'Renhai', visual_features: ['雙波段雷達封閉桅桿', '112單元大型VLS', '封閉式隱身艦橋'] },
      { id: 'c3', code: '054A', name_zh: '054A型飛彈護衛艦', category: '護衛艦', nato_code: 'Jiangkai II', visual_features: ['頂板382型雷達頂置', '32單元垂直發射', '外飄平甲板'] },
      { id: 'c4', code: '075', name_zh: '075型兩棲攻擊艦', category: '登陸艦', nato_code: 'Yushen', visual_features: ['全通直通甲板', '右舷島式艦橋', '艦艉大型塢艙'] }
    ]);
    await db.ships.bulkPut([
      { id: 's1', class_id: 'c1', hull_number: '172', name_zh: '昆明', status: '現役' },
      { id: 's2', class_id: 'c1', hull_number: '173', name_zh: '長沙', status: '現役' },
      { id: 's3', class_id: 'c2', hull_number: '101', name_zh: '南昌', status: '現役' },
      { id: 's4', class_id: 'c2', hull_number: '105', name_zh: '大連', status: '現役' },
      { id: 's5', class_id: 'c4', hull_number: '31', name_zh: '海南', status: '現役' }
    ]);
  }
}

export default function App() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    initData();
    const handleOn = () => setOnline(true);
    const handleOff = () => setOnline(false);
    window.addEventListener('online', handleOn);
    window.addEventListener('offline', handleOff);
    return () => {
      window.removeEventListener('online', handleOn);
      window.removeEventListener('offline', handleOff);
    };
  }, []);

  const search = async (val: string) => {
    setQ(val);
    const key = val.trim().toUpperCase().replace(/[-_ ]/g, '').replace(/[型艦]$/g, '');
    if (!key) return setResults([]);

    const ships = await db.ships.filter(s => s.hull_number.includes(key) || s.name_zh.includes(val.trim())).toArray();
    const classes = await db.ship_classes.filter(c => c.code.replace('-', '').includes(key) || c.name_zh.includes(val.trim())).toArray();
    
    const res: any[] = [];
    for (const s of ships) {
      const parent = await db.ship_classes.get(s.class_id);
      res.push({ title: s.hull_number, sub: s.name_zh, tag: parent?.name_zh, feats: parent?.visual_features, cat: parent?.category });
    }
    for (const c of classes) {
      res.push({ title: c.code, sub: c.name_zh, tag: c.nato_code, feats: c.visual_features, cat: c.category });
    }
    setResults(res);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-12 select-none">
      <header className="px-5 py-4 flex justify-between items-center border-b border-slate-800 bg-slate-900/60 sticky top-0 z-10 backdrop-blur">
        <div className="flex items-center space-x-2">
          <Compass className="w-5 h-5 text-emerald-400" />
          <span className="font-mono text-sm tracking-widest font-semibold">SHIP ID // REF</span>
        </div>
        <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono ${online ? 'bg-slate-800 text-slate-400' : 'bg-amber-950 text-amber-300'}`}>
          {online ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
          <span>{online ? 'ONLINE' : 'OFFLINE MODE'}</span>
        </div>
      </header>

      <main className="p-4 max-w-lg mx-auto w-full">
        <div className="relative mb-4">
          <input
            type="text"
            value={q}
            onChange={e => search(e.target.value)}
            placeholder="輸入舷號、艦名或型號 (例: 172, 052D, 52D)"
            className="w-full h-14 pl-12 pr-4 bg-slate-900 border-2 border-slate-700 focus:border-emerald-500 rounded-lg text-lg text-slate-100 placeholder-slate-500 outline-none"
            autoFocus
          />
          <Search className="w-6 h-6 text-slate-400 absolute left-3.5 top-4" />
        </div>

        <div className="space-y-2">
          {results.map((item, idx) => (
            <div key={idx} className="p-3.5 bg-slate-900 border border-slate-800 rounded-lg">
              <div className="flex justify-between items-baseline">
                <span className="font-mono text-xl font-bold text-emerald-400">{item.title}</span>
                <span className="text-xs font-mono px-2 py-0.5 bg-slate-950 rounded text-slate-400">{item.cat}</span>
              </div>
              <div className="text-base font-medium text-slate-200">{item.sub}</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">{item.tag}</div>
              {item.feats && (
                <div className="mt-2 pt-2 border-t border-slate-800/80">
                  <div className="text-[11px] font-mono text-emerald-500 flex items-center space-x-1 mb-1">
                    <ShieldCheck className="w-3 h-3" /> <span>識別特徵</span>
                  </div>
                  <div className="text-xs text-slate-300">{item.feats.join(' · ')}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
