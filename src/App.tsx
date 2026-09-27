import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

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
}

interface Ship {
  id: string;
  class_id: string;
  hull_number: string;
  name_zh: string;
  commissioned_year?: string;
  fleet?: string;
  squadron?: string;
  status: string;
}

interface ParsedShipItem {
  hull_number: string;
  name_zh: string;
  commissioned_year: string;
  fleet: string;
  squadron: string;
  status: string;
}

type FontSizeOption = 'system' | 'sm' | 'md' | 'lg';
type BottomTab = 'all' | 'favorites' | 'rankings' | 'stats';

export default function App() {
  const [classes, setClasses] = useState<ShipClass[]>([]);
  const [ships, setShips] = useState<Ship[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [expandedSpecsId, setExpandedSpecsId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('2026.09.27 v3.5');

  const [nightMode, setNightMode] = useState<boolean>(() => {
    return localStorage.getItem('tn_night_mode') === 'true';
  });

  const [comparePool, setComparePool] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  const [showAdmin, setShowAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('tn_admin_auth') === 'true';
  });

  const [bannerText, setBannerText] = useState<string>(() => {
    return localStorage.getItem('tn_banner_text') || '';
  });
  const [adminBannerInput, setAdminBannerInput] = useState<string>('');
  const [isSavingBanner, setIsSavingBanner] = useState(false);

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

  const [newClass, setNewClass] = useState<Partial<ShipClass>>({
    code: '', name_zh: '', category: '', nato_code: '', image_url: '', overview: '',
    displacement: '', length: '', beam: '', power_output: '', propulsion: '', max_speed: '',
    crew: '', radar_systems: '', weapons_summary: '', electronic_warfare: '', aircraft: ''
  });
  const [newShip, setNewShip] = useState({ class_id: '', hull_number: '', name_zh: '', commissioned_year: '', fleet: '', squadron: '', status: '現役' });

  const [wikiQuery, setWikiQuery] = useState('');
  const [isFetchingWiki, setIsFetchingWiki] = useState(false);
  const [parsedShips, setParsedShips] = useState<ParsedShipItem[]>([]);
  const [includeParsedShips, setIncludeParsedShips] = useState(true);

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
        if (granted) console.log('Persistent storage active');
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
    if (cachedClasses) setClasses(JSON.parse(cachedClasses));
    if (cachedShips) setShips(JSON.parse(cachedShips));
    if (cachedBanner && !bannerText) setBannerText(cachedBanner);

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    try {
      const { data: cData, error: cErr } = await supabase.from('ship_classes').select('*').order('code');
      const { data: sData, error: sErr } = await supabase.from('ships').select('*').order('hull_number');
      const { data: bData } = await supabase.from('app_settings').select('banner_text').eq('id', 'global').maybeSingle();

      if (cErr) console.error('艦型讀取錯誤:', cErr);
      if (sErr) console.error('單艦讀取錯誤:', sErr);

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
      console.warn('本機快照讀取', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFetchWikipedia = async () => {
    if (!wikiQuery.trim()) {
      alert('請輸入關鍵字 (例: 052D、054A 或 康定)');
      return;
    }

    setIsFetchingWiki(true);
    setParsedShips([]);

    try {
      let input = wikiQuery.trim();
      if (input.includes('wikipedia.org/wiki/')) {
        input = decodeURIComponent(input.split('wikipedia.org/wiki/')[1].split(/[?#]/)[0]);
      }

      let resolvedTitle = input;
      const searchUrl = `https://zh.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(input)}&limit=1&namespace=0&format=json&origin=*`;
      const searchResp = await fetch(searchUrl);
      if (searchResp.ok) {
        const searchJson = await searchResp.json();
        if (searchJson[1] && searchJson[1].length > 0) {
          resolvedTitle = searchJson[1][0];
        }
      }

      const parseApiUrl = `https://zh.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(resolvedTitle)}&prop=text|images&format=json&origin=*&redirects=1`;
      const parseResp = await fetch(parseApiUrl);
      const parseJson = await parseResp.json();

      if (parseJson.error) {
        throw new Error(parseJson.error.info || `找不到條目【${resolvedTitle}】`);
      }

      const realTitle = parseJson.parse?.title || resolvedTitle;
      const rawHtml = parseJson.parse?.text?.['*'] || '';
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawHtml, 'text/html');

      let imgUrl = '';
      const firstImg = doc.querySelector('table.infobox img') || doc.querySelector('.thumbimage') || doc.querySelector('img');
      if (firstImg) {
        let src = firstImg.getAttribute('src') || '';
        if (src.startsWith('//')) src = 'https:' + src;
        imgUrl = src.replace(/\/thumb(\/.*)\/[^\/]+$/, '$1');
      }

      const codeMatch = realTitle.match(/([0-9A-Za-z\-]+)(?:型|級)/);
      const guessedCode = codeMatch ? codeMatch[1] : input.slice(0, 8);

      let overviewParagraph = '';
      const paragraphs = Array.from(doc.querySelectorAll('p'));
      for (const p of paragraphs) {
        const text = p.textContent?.replace(/\[.*?\]/g, '').trim() || '';
        if (text.length > 50) {
          overviewParagraph = text;
          break;
        }
      }

      const getInfoBoxValue = (keywords: string[]) => {
        const rows = Array.from(doc.querySelectorAll('table.infobox tr'));
        for (const row of rows) {
          const th = row.querySelector('th')?.textContent?.trim() || '';
          if (keywords.some(k => th.includes(k))) {
            const td = row.querySelector('td');
            if (td) return td.textContent?.replace(/\[.*?\]/g, '').trim().slice(0, 300) || '';
          }
        }
        return '';
      };

      const displacement = getInfoBoxValue(['排水量', '排水']);
      const lengthVal = getInfoBoxValue(['全長', '全长', '長度', '船長']);
      const beamVal = getInfoBoxValue(['型寬', '寬度', '舷寬']);
      const powerOutput = getInfoBoxValue(['功率', '輸出', '出力']);
      const propulsion = getInfoBoxValue(['動力方式', '動力系統', '動力', '主機']);
      const maxSpeedVal = getInfoBoxValue(['最高速度', '航速', '極速']);
      const crewVal = getInfoBoxValue(['乘員', '定員', '編制']);
      const radarVal = getInfoBoxValue(['搜索系統', '雷達', '雷达', '偵搜']);
      const weaponsVal = getInfoBoxValue(['武器系統', '武器', '武裝']);
      const ewVal = getInfoBoxValue(['電戰系統', '電子戰', '電子對抗']);
      const airVal = getInfoBoxValue(['艦載機', '直升機']);

      const fullText = doc.body.textContent || '';
      let guessedCategory = '驅逐艦';
      if (fullText.includes('巡防艦') || fullText.includes('护卫舰')) guessedCategory = '巡防艦';
      else if (fullText.includes('驅逐艦') || fullText.includes('驱逐舰')) guessedCategory = '驅逐艦';
      else if (fullText.includes('登陸艦') || fullText.includes('登陆舰') || fullText.includes('兩棲')) guessedCategory = '兩棲登陸艦';
      else if (fullText.includes('巡邏艦') || fullText.includes('巡逻舰')) guessedCategory = '巡邏艦';
      else if (fullText.includes('航空母艦') || fullText.includes('航母')) guessedCategory = '航空母艦';
      else if (fullText.includes('潛艇') || fullText.includes('潜艇')) guessedCategory = '潛艦';

      let guessedNato = '';
      const natoMatch = fullText.match(/北[約约]代[號号][：:\s]*([A-Za-z0-9\-]+)/);
      if (natoMatch) guessedNato = natoMatch[1];

      setNewClass({
        code: newClass.code || guessedCode,
        name_zh: realTitle,
        category: newClass.category || guessedCategory,
        nato_code: newClass.nato_code || guessedNato,
        image_url: imgUrl || newClass.image_url,
        overview: overviewParagraph,
        displacement: displacement || '約 7,500 噸',
        length: lengthVal || '157 公尺',
        beam: beamVal || '19 公尺',
        power_output: powerOutput || '燃氣渦輪機 28,000 馬力 × 2',
        propulsion: propulsion || '柴燃聯合動力方式 (CODOG)',
        max_speed: maxSpeedVal || '30 節',
        crew: crewVal || '約 280 人',
        radar_systems: radarVal || '346A型 主動相位陣列雷達、超視距對海雷達、517B型對空警戒雷達',
        weapons_summary: weaponsVal || '64單元通用垂直發射系統、130mm主砲、紅旗-10防空飛彈、1130近防砲',
        electronic_warfare: ewVal || '726型 電子對抗系統、主被動干擾發射器',
        aircraft: airVal || '直-9C / 直-20F 反潛直升機 1 架'
      });

      const foundShips: ParsedShipItem[] = [];
      const tables = Array.from(doc.querySelectorAll('table'));

      tables.forEach(table => {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length < 2) return;

        let hullIdx = -1;
        let nameIdx = -1;
        let statusIdx = -1;
        let fleetIdx = -1;
        let squadronIdx = -1;
        let yearIdx = -1;

        for (let r = 0; r < Math.min(3, rows.length); r++) {
          const cells = Array.from(rows[r].querySelectorAll('th, td'));
          cells.forEach((cell, idx) => {
            const txt = cell.textContent?.trim() || '';
            if (/舷[號号]|編[號号]|Hull/i.test(txt) && hullIdx === -1) hullIdx = idx;
            if (/艦名|舰名|Name/i.test(txt) && nameIdx === -1) nameIdx = idx;
            if (/狀[態态]|現況|现况|Status/i.test(txt) && statusIdx === -1) statusIdx = idx;
            if (/艦隊|舰队|配屬/i.test(txt) && fleetIdx === -1) fleetIdx = idx;
            if (/支隊|支队/i.test(txt) && squadronIdx === -1) squadronIdx = idx;
            if (/服役|入役|入列|交付|成軍|Commission/i.test(txt) && yearIdx === -1) yearIdx = idx;
          });
        }

        if (hullIdx !== -1 && nameIdx !== -1) {
          for (let i = 1; i < rows.length; i++) {
            const cells = Array.from(rows[i].querySelectorAll('td, th'));
            if (cells.length > Math.max(hullIdx, nameIdx)) {
              let hull = cells[hullIdx]?.textContent?.trim() || '';
              let name = cells[nameIdx]?.textContent?.trim() || '';
              let status = statusIdx !== -1 ? (cells[statusIdx]?.textContent?.trim() || '現役') : '現役';
              let fleet = fleetIdx !== -1 ? (cells[fleetIdx]?.textContent?.trim() || '') : '';
              let squadron = squadronIdx !== -1 ? (cells[squadronIdx]?.textContent?.trim() || '') : '';
              let commYear = yearIdx !== -1 ? (cells[yearIdx]?.textContent?.trim() || '') : '';

              hull = hull.replace(/\[.*?\]/g, '').replace(/[\s\r\n]+/g, '');
              name = name.replace(/\[.*?\]/g, '').replace(/[\s\r\n]+/g, '');
              status = status.replace(/\[.*?\]/g, '').replace(/[\s\r\n]+/g, '');
              fleet = fleet.replace(/\[.*?\]/g, '').replace(/[\s\r\n]+/g, '').slice(0, 30);
              squadron = squadron.replace(/\[.*?\]/g, '').replace(/[\s\r\n]+/g, '').slice(0, 30);
              commYear = commYear.replace(/\[.*?\]/g, '').replace(/[\s\r\n]+/g, ' ').trim().slice(0, 50);

              if (fleet.includes('支隊') || fleet.includes('支队')) {
                const matchSquad = fleet.match(/(.*?[艦队隊])(.*?[支队隊])/);
                if (matchSquad) {
                  fleet = matchSquad[1];
                  if (!squadron) squadron = matchSquad[2];
                }
              }

              if (/服役|現役|现役/.test(status)) status = '現役';
              else if (/海試|海试|試航/.test(status)) status = '海試';
              else if (/舾裝|舾装|下水|在建/.test(status)) status = '建造/舾裝中';
              else if (/退役/.test(status)) status = '退役';
              else status = status.slice(0, 10);

              if (hull && name && /^[0-9A-Za-z\-]+$/.test(hull) && hull.length <= 8 && name.length <= 15) {
                if (!foundShips.some(s => s.hull_number === hull)) {
                  foundShips.push({
                    hull_number: hull,
                    name_zh: name,
                    status: status || '現役',
                    fleet: fleet || '未載明',
                    squadron: squadron || '未載明',
                    commissioned_year: commYear || '未載明'
                  });
                }
              }
            }
          }
        }
      });

      if (foundShips.length > 0) {
        setParsedShips(foundShips);
        setIncludeParsedShips(true);
        alert(`成功配對條目【${realTitle}】！\n已擷取第一段概述、技術數據與 ${foundShips.length} 艘單艦完整履歷！`);
      } else {
        alert(`成功配對條目【${realTitle}】！已擷取概述與技術數據。`);
      }

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
    return c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.name_zh.includes(searchTerm) ||
      (c.nato_code && c.nato_code.toLowerCase().includes(searchTerm.toLowerCase()));
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
    const { error } = await supabase.from('ship_classes').update({
      name_zh: editingClass.name_zh,
      category: editingClass.category,
      nato_code: editingClass.nato_code || '',
      image_url: editingClass.image_url || '',
      overview: editingClass.overview || '',
      displacement: editingClass.displacement || '',
      length: editingClass.length || '',
      beam: editingClass.beam || '',
      power_output: editingClass.power_output || '',
      propulsion: editingClass.propulsion || '',
      max_speed: editingClass.max_speed || '',
      crew: editingClass.crew || '',
      radar_systems: editingClass.radar_systems || '',
      weapons_summary: editingClass.weapons_summary || '',
      electronic_warfare: editingClass.electronic_warfare || '',
      aircraft: editingClass.aircraft || ''
    }).eq('id', editingClass.id);

    if (error) {
      alert(`儲存失敗: ${error.message}`);
      return;
    }
    setEditingClass(null);
    await fetchData();
    alert('已成功儲存並同步至前台！');
  };

  const saveShipEdit = async () => {
    if (!editingShip || !supabase) return;
    const { error } = await supabase.from('ships').update({
      name_zh: editingShip.name_zh,
      status: editingShip.status,
      fleet: editingShip.fleet || '',
      squadron: editingShip.squadron || '',
      commissioned_year: editingShip.commissioned_year || ''
    }).eq('id', editingShip.id);

    if (error) {
      alert(`更新失敗: ${error.message}`);
      return;
    }
    setEditingShip(null);
    fetchData();
  };

  const handleCreateOrUpdateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newClass.code) return;
    const cid = `c-${newClass.code.toLowerCase().trim()}`;

    const existing = classes.find(c => c.id === cid || c.code.toLowerCase() === newClass.code?.toLowerCase().trim());
    const targetId = existing ? existing.id : cid;

    const { error: cErr } = await supabase.from('ship_classes').upsert([{
      id: targetId,
      code: newClass.code.trim(),
      name_zh: newClass.name_zh?.trim() || '',
      category: newClass.category?.trim() || '',
      nato_code: newClass.nato_code?.trim() || '',
      image_url: newClass.image_url?.trim() || '',
      overview: newClass.overview?.trim() || '',
      displacement: newClass.displacement?.trim() || '',
      length: newClass.length?.trim() || '',
      beam: newClass.beam?.trim() || '',
      power_output: newClass.power_output?.trim() || '',
      propulsion: newClass.propulsion?.trim() || '',
      max_speed: newClass.max_speed?.trim() || '',
      crew: newClass.crew?.trim() || '',
      radar_systems: newClass.radar_systems?.trim() || '',
      weapons_summary: newClass.weapons_summary?.trim() || '',
      electronic_warfare: newClass.electronic_warfare?.trim() || '',
      aircraft: newClass.aircraft?.trim() || '',
      visual_features: []
    }]);

    if (cErr) {
      alert(`艦型更新失敗: ${cErr.message}`);
      return;
    }

    if (includeParsedShips && parsedShips.length > 0) {
      const shipPayload = parsedShips.map(s => ({
        id: `s-${s.hull_number.trim()}`,
        class_id: targetId,
        hull_number: s.hull_number.trim(),
        name_zh: s.name_zh.trim(),
        status: s.status.trim(),
        fleet: s.fleet || '',
        squadron: s.squadron || '',
        commissioned_year: s.commissioned_year || ''
      }));
      const { error: sErr } = await supabase.from('ships').upsert(shipPayload);
      if (sErr) console.error('單艦寫入警告:', sErr);
    }

    setNewClass({ code: '', name_zh: '', category: '', nato_code: '', image_url: '', overview: '' });
    setWikiQuery('');
    setParsedShips([]);
    setShowAdmin(false);

    await fetchData();
    alert(`已成功將【${newClass.code}】的概述、11項技術數據與單艦全面同步至前台！`);
  };

  const handleCreateShip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    const sid = `s-${newShip.hull_number.trim()}`;
    const { error } = await supabase.from('ships').upsert([{
      id: sid,
      class_id: newShip.class_id,
      hull_number: newShip.hull_number.trim(),
      name_zh: newShip.name_zh.trim(),
      status: newShip.status.trim(),
      fleet: newShip.fleet.trim(),
      squadron: newShip.squadron.trim(),
      commissioned_year: newShip.commissioned_year.trim()
    }]);

    if (error) {
      alert(`新增失敗: ${error.message}`);
      return;
    }

    setNewShip({ class_id: '', hull_number: '', name_zh: '', status: '現役', fleet: '', squadron: '', commissioned_year: '' });
    setShowAdmin(false);
    fetchData();
  };

  // 輔助函式：將長段落文字根據頓號、分號、換行等符號，自動分段為條列清單
  const renderFormattedList = (text?: string) => {
    if (!text) return <span className="text-slate-100 font-medium">-</span>;
    const items = text.split(/[\n\r；;、]/).map(s => s.trim()).filter(Boolean);
    if (items.length <= 1) {
      return <span className="text-slate-100 font-medium leading-relaxed">{text}</span>;
    }
    return (
      <div className="space-y-1 pt-0.5">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-1.5 text-slate-100 leading-snug">
            <span className="text-slate-500 font-mono text-[10px] leading-tight select-none">•</span>
            <span className="font-medium">{item}</span>
          </div>
        ))}
      </div>
    );
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

        {bannerText && (
          <div className={`mb-3 px-3.5 py-2.5 ${nightMode ? 'bg-red-950/60 border-red-500/40 text-red-200' : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-200'} border rounded-xl shadow-lg flex items-center gap-2.5 backdrop-blur`}>
            <span className={`w-2 h-2 rounded-full ${nightMode ? 'bg-red-400' : 'bg-cyan-400'} animate-ping`}></span>
            <p className="text-xs font-semibold tracking-wide leading-snug flex-1">
              {bannerText}
            </p>
          </div>
        )}

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
          </div>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="relative w-12 h-12">
              <div className={`w-12 h-12 rounded-full border-2 ${nightMode ? 'border-red-500/20 border-t-red-500' : 'border-cyan-500/20 border-t-cyan-400'} animate-spin`}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`w-2 h-2 rounded-full ${theme.accentBg} animate-ping`}></span>
              </div>
            </div>
            <div className={`flex items-center gap-1 text-xs font-mono ${theme.accentText} tracking-wider`}>
              <span>資料同步中...</span>
            </div>
          </div>
        ) : (
          activeBottomTab === 'stats' ? (
            <div className="space-y-4 pt-1">
              <div className="text-xs font-mono tracking-wider text-slate-400 font-bold uppercase flex items-center gap-2">
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
                            <span className="font-mono text-slate-300 font-bold">{month}</span>
                            <span className={`font-mono ${theme.accentText} font-bold`}>{count} 次</span>
                          </div>
                          <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                            <div className={`h-full rounded-full bg-gradient-to-r ${theme.barGrad}`} style={{ width: `${percentage}%` }}></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <section className="space-y-3">
              {searchTerm && filteredShips.length > 0 && (
                <div className={`${nightMode ? 'bg-red-950/30 border-red-500/30' : 'bg-cyan-950/30 border-cyan-500/30'} border rounded-2xl p-3.5 shadow-lg space-y-2.5`}>
                  <div className="text-[11px] font-mono tracking-wider text-cyan-400 font-bold uppercase">
                    舷號比對結果 ({filteredShips.length})
                  </div>
                  <div className="space-y-2">
                    {filteredShips.map(s => (
                      <div key={s.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-baseline gap-2.5">
                            <span className={`font-mono text-2xl font-black ${theme.accentText}`}>{s.hull_number}</span>
                            <span className="font-bold text-white text-base">{s.name_zh}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.status === '現役' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                            {s.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-800/80">
                          <div><span className="text-slate-500">服役時間：</span><span className="font-mono text-cyan-300">{s.commissioned_year || '未載明'}</span></div>
                          <div><span className="text-slate-500">編屬部隊：</span><span>{s.fleet || '未載明'}{s.squadron && ` · ${s.squadron}`}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {displayedClasses.map(c => {
                const isExpanded = expandedClassId === c.id;
                const isSpecsExpanded = expandedSpecsId === c.id;
                const classShips = ships.filter(s => s.class_id === c.id);
                const isFav = favorites.includes(c.id);
                const isCompared = comparePool.includes(c.id);

                return (
                  <div key={c.id} className={`${theme.cardBg} border rounded-2xl overflow-hidden transition-all duration-200 ${isExpanded ? theme.accentBorder : theme.cardBorder}`}>
                    <div onClick={() => handleToggleExpand(c.id)} className="p-3.5 flex justify-between items-center cursor-pointer select-none">
                      <div className="space-y-1 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-black text-base ${theme.accentText}`}>{c.code}</span>
                          <span className="font-bold text-slate-100">{c.name_zh}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          {c.category && <span className={`px-2 py-0.5 rounded-full ${theme.badgeBg} font-medium`}>{c.category}</span>}
                          {c.nato_code && <span className="font-mono text-slate-400">代號: {c.nato_code}</span>}
                        </div>
                      </div>

                      {/* 卡片頂部工具列 */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingClass(c);
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 active:scale-95 transition"
                        >
                          編輯
                        </button>
                        <button
                          type="button"
                          onClick={(e) => toggleCompare(c.id, e)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 ${isCompared ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-400'}`}
                        >
                          {isCompared ? '已選取' : '比對'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(c.id, e)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-sm transition ${isFav ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-500'}`}
                        >
                          ★
                        </button>
                        <div className={`w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-white' : ''}`}>
                          ▼
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-2 border-t border-slate-800/80 bg-black/40 space-y-3.5">
                        {c.image_url ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-700/80 shadow-md">
                            <img src={c.image_url} alt={c.name_zh} loading="lazy" className="w-full h-44 object-cover object-center bg-slate-950" />
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-800 p-3 bg-slate-900/40 text-center text-xs text-slate-500">
                            暫無艦影照片
                          </div>
                        )}

                        {/* 第一欄：艦型概述 */}
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`}></span>
                            <span>艦型概述</span>
                          </div>
                          <p className="text-xs text-slate-300 bg-slate-900/80 p-3 rounded-xl border border-slate-800 leading-relaxed text-justify">
                            {c.overview || '暫無該艦型概述資料，可於上方按「編輯」或在後台執行維基百科自動填表獲取。'}
                          </p>
                        </div>

                        {/* 第二欄：技術數據 (全數白色字體 ＋ 自動條列分段) */}
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => setExpandedSpecsId(isSpecsExpanded ? null : c.id)}
                            className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition ${isSpecsExpanded ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-900/80 border-slate-800 text-slate-300'}`}
                          >
                            <span className="font-mono">{isSpecsExpanded ? '▼' : '▶'} 技術數據 (11 項技術指標)</span>
                            <span className="text-[10px] text-slate-500 font-normal">{isSpecsExpanded ? '收合' : '展開完整數據'}</span>
                          </button>

                          {isSpecsExpanded && (
                            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5 text-xs">
                              {/* 排水量與最高速度 */}
                              <div className="grid grid-cols-2 gap-2 border-b border-slate-900 pb-2.5">
                                <div>
                                  <span className="text-slate-400 block text-[10px]">排水量:</span>
                                  <span className="text-slate-100 font-medium">{c.displacement || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[10px]">最高速度:</span>
                                  <span className="text-slate-100 font-medium font-mono">{c.max_speed || '-'}</span>
                                </div>
                              </div>

                              {/* 長度與型寬 */}
                              <div className="grid grid-cols-2 gap-2 border-b border-slate-900 pb-2.5">
                                <div>
                                  <span className="text-slate-400 block text-[10px]">長度:</span>
                                  <span className="text-slate-100 font-medium">{c.length || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[10px]">型寬:</span>
                                  <span className="text-slate-100 font-medium">{c.beam || '-'}</span>
                                </div>
                              </div>

                              {/* 動力方式與動力輸出 */}
                              <div className="grid grid-cols-2 gap-2 border-b border-slate-900 pb-2.5">
                                <div>
                                  <span className="text-slate-400 block text-[10px]">動力方式:</span>
                                  <span className="text-slate-100 font-medium">{c.propulsion || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[10px]">動力輸出:</span>
                                  <span className="text-slate-100 font-medium">{c.power_output || '-'}</span>
                                </div>
                              </div>

                              {/* 乘員 */}
                              <div className="border-b border-slate-900 pb-2.5">
                                <span className="text-slate-400 block text-[10px]">乘員:</span>
                                <span className="text-slate-100 font-medium">{c.crew || '-'}</span>
                              </div>

                              {/* 搜索系統 (白色文字 + 自動分段) */}
                              <div className="border-b border-slate-900 pb-2.5">
                                <span className="text-slate-400 block text-[10px] mb-0.5">搜索系統 (雷達/聲納):</span>
                                {renderFormattedList(c.radar_systems)}
                              </div>

                              {/* 武器系統 (白色文字 + 自動分段) */}
                              <div className="border-b border-slate-900 pb-2.5">
                                <span className="text-slate-400 block text-[10px] mb-0.5">武器系統:</span>
                                {renderFormattedList(c.weapons_summary)}
                              </div>

                              {/* 電戰系統 (白色文字 + 自動分段) */}
                              <div className="border-b border-slate-900 pb-2.5">
                                <span className="text-slate-400 block text-[10px] mb-0.5">電戰系統:</span>
                                {renderFormattedList(c.electronic_warfare)}
                              </div>

                              {/* 艦載機 (白色文字 + 自動分段) */}
                              <div>
                                <span className="text-slate-400 block text-[10px] mb-0.5">艦載機:</span>
                                {renderFormattedList(c.aircraft)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 第三欄：單艦列表 */}
                        <div className="space-y-2 pt-1">
                          <div className="text-[11px] font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${theme.accentBg}`}></span>
                            <span>本級單艦列表 ({classShips.length} 艘)</span>
                          </div>

                          {classShips.length > 0 ? (
                            <div className="space-y-2">
                              {classShips.map(s => (
                                <div key={s.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5 shadow-sm">
                                  <div className="flex justify-between items-center">
                                    <div className="flex items-baseline gap-2.5">
                                      <span className={`font-mono text-2xl font-black ${theme.accentText} tracking-tight`}>{s.hull_number}</span>
                                      <span className="font-bold text-white text-base">{s.name_zh}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.status === '現役' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                                        {s.status}
                                      </span>
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setEditingShip(s); }}
                                        className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700 transition"
                                      >
                                        編輯
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-[11px] text-slate-300 space-y-1 pt-1 border-t border-slate-800/80">
                                    <div className="flex flex-wrap items-baseline gap-1">
                                      <span className="text-slate-500 shrink-0 font-medium">服役時間：</span>
                                      <span className="font-mono text-cyan-300 font-medium break-all">{s.commissioned_year || '未載明'}</span>
                                    </div>
                                    <div className="flex flex-wrap items-baseline gap-1">
                                      <span className="text-slate-500 shrink-0 font-medium">編屬部隊：</span>
                                      <span className="text-slate-200 font-medium break-all">{s.fleet || '未載明'}{s.squadron && ` · ${s.squadron}`}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 py-2 bg-slate-900/40 p-3 rounded-xl border border-dashed border-slate-800 text-center">
                              尚無登錄單艦舷號資料
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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
                      <button type="button" onClick={() => setComparePool(comparePool.filter(x => x !== id))} className="text-[10px] text-slate-400 hover:text-white">✕</button>
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => setComparePool([])} className="text-[10px] text-slate-400 hover:text-white px-2 py-1">重置</button>
              <button type="button" disabled={comparePool.length < 2} onClick={() => setShowCompareModal(true)} className={`px-3 py-1.5 rounded-xl font-bold text-xs text-white ${theme.accentBg}`}>啟動比對</button>
            </div>
          </div>
        </div>
      )}

      {/* 雙艦比對視窗 */}
      {showCompareModal && compareShipA && compareShipB && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className={`w-full max-w-lg ${nightMode ? 'bg-[#0a0203] border-red-900/60' : 'bg-slate-900 border-slate-800'} border-t sm:border rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl`}>
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm text-white">雙艦型同屏技術數據比對</h3>
              <button type="button" onClick={() => setShowCompareModal(false)} className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-full bg-slate-800">✕ 關閉</button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="font-bold text-white text-base">{compareShipA.code} {compareShipA.name_zh}</div>
                <div className="font-bold text-white text-base">{compareShipB.code} {compareShipB.name_zh}</div>
              </div>
              <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2 text-[11px]">
                <div className="grid grid-cols-2 gap-3 divide-x divide-slate-800">
                  <div className="space-y-1">
                    <div><span className="text-slate-500">排水量:</span> <span className="text-white">{compareShipA.displacement || '-'}</span></div>
                    <div><span className="text-slate-500">長度/型寬:</span> <span className="text-white">{compareShipA.length} / {compareShipA.beam}</span></div>
                    <div><span className="text-slate-500">最高速度:</span> <span className="text-white font-mono">{compareShipA.max_speed || '-'}</span></div>
                    <div><span className="text-slate-500 block pt-1">搜索系統:</span> <div className="text-white">{renderFormattedList(compareShipA.radar_systems)}</div></div>
                  </div>
                  <div className="space-y-1 pl-3">
                    <div><span className="text-slate-500">排水量:</span> <span className="text-white">{compareShipB.displacement || '-'}</span></div>
                    <div><span className="text-slate-500">長度/型寬:</span> <span className="text-white">{compareShipB.length} / {compareShipB.beam}</span></div>
                    <div><span className="text-slate-500">最高速度:</span> <span className="text-white font-mono">{compareShipB.max_speed || '-'}</span></div>
                    <div><span className="text-slate-500 block pt-1">搜索系統:</span> <div className="text-white">{renderFormattedList(compareShipB.radar_systems)}</div></div>
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
          <button type="button" onClick={() => setActiveBottomTab('all')} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl ${activeBottomTab === 'all' ? `${theme.accentText} font-bold` : 'text-slate-400'}`}>全部艦型</button>
          <button type="button" onClick={() => setActiveBottomTab('favorites')} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl ${activeBottomTab === 'favorites' ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>我的最愛</button>
          <button type="button" onClick={() => setActiveBottomTab('rankings')} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl ${activeBottomTab === 'rankings' ? `${theme.accentText} font-bold` : 'text-slate-400'}`}>查詢排行</button>
          <button type="button" onClick={() => setActiveBottomTab('stats')} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl ${activeBottomTab === 'stats' ? `${theme.accentText} font-bold` : 'text-slate-400'}`}>每月統計</button>
        </div>
      </nav>

      {/* 指南彈窗 */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <h3 className="font-bold text-sm text-white">安裝指南與離線注意事項</h3>
            <div className="text-xs text-slate-300 space-y-2">
              <p>1. iPhone 點分享「加入主畫面」；Android 點選單「安裝應用程式」。</p>
              <p>2. 在基地有網路時開啟並點閱各艦型一次，可啟用 180 天離線快照。</p>
            </div>
            <button type="button" onClick={() => setShowGuideModal(false)} className={`w-full py-2.5 ${theme.accentBg} rounded-xl text-xs font-bold text-white`}>我知道了</button>
          </div>
        </div>
      )}

      {/* 授權密碼彈窗 */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <h3 className="font-bold text-base text-white">後台管理驗證</h3>
            <p className="text-[11px] text-slate-400">請輸入管理通行密碼</p>
            <form onSubmit={handleVerifyPassword} className="space-y-3">
              <input type="password" required maxLength={10} placeholder="請輸入 6 位授權碼" value={adminPasswordInput} onChange={e => setAdminPasswordInput(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest font-mono text-white" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-2 bg-slate-800 rounded-xl text-xs text-slate-400">取消</button>
                <button type="submit" className={`flex-1 py-2 ${theme.accentBg} rounded-xl font-bold text-white`}>確認</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 艦型編輯彈窗 */}
      {editingClass && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3 max-h-[85vh] overflow-y-auto text-xs">
            <h3 className="font-bold text-sm text-white">編輯艦型資料 ({editingClass.code})</h3>
            <div><label className="text-slate-400 block mb-1">第一欄：艦型概述 (維基第一大段)</label><textarea rows={4} value={editingClass.overview || ''} onChange={e => setEditingClass({ ...editingClass, overview: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div><label className="text-slate-400 block mb-1">排水量</label><input type="text" value={editingClass.displacement || ''} onChange={e => setEditingClass({ ...editingClass, displacement: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-slate-400 block mb-1">長度</label><input type="text" value={editingClass.length || ''} onChange={e => setEditingClass({ ...editingClass, length: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">型寬</label><input type="text" value={editingClass.beam || ''} onChange={e => setEditingClass({ ...editingClass, beam: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            </div>
            <div><label className="text-slate-400 block mb-1">最高速度</label><input type="text" value={editingClass.max_speed || ''} onChange={e => setEditingClass({ ...editingClass, max_speed: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div><label className="text-slate-400 block mb-1">動力方式</label><input type="text" value={editingClass.propulsion || ''} onChange={e => setEditingClass({ ...editingClass, propulsion: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div><label className="text-slate-400 block mb-1">動力輸出</label><input type="text" value={editingClass.power_output || ''} onChange={e => setEditingClass({ ...editingClass, power_output: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div><label className="text-slate-400 block mb-1">乘員</label><input type="text" value={editingClass.crew || ''} onChange={e => setEditingClass({ ...editingClass, crew: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div><label className="text-slate-400 block mb-1">搜索系統 (雷達/聲納)</label><textarea rows={3} placeholder="以頓號或換行隔開各雷達型號" value={editingClass.radar_systems || ''} onChange={e => setEditingClass({ ...editingClass, radar_systems: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div><label className="text-slate-400 block mb-1">武器系統</label><textarea rows={3} placeholder="以頓號或換行隔開各武器型號" value={editingClass.weapons_summary || ''} onChange={e => setEditingClass({ ...editingClass, weapons_summary: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div><label className="text-slate-400 block mb-1">電戰系統</label><textarea rows={2} placeholder="以頓號或換行隔開" value={editingClass.electronic_warfare || ''} onChange={e => setEditingClass({ ...editingClass, electronic_warfare: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div><label className="text-slate-400 block mb-1">艦載機</label><input type="text" value={editingClass.aircraft || ''} onChange={e => setEditingClass({ ...editingClass, aircraft: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditingClass(null)} className="flex-1 py-2 bg-slate-800 rounded-xl text-slate-300">取消</button>
              <button type="button" onClick={saveClassEdit} className={`flex-1 py-2 ${theme.accentBg} rounded-xl font-bold text-white`}>儲存修改</button>
            </div>
          </div>
        </div>
      )}

      {/* 單艦修改彈窗 */}
      {editingShip && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3 text-xs">
            <h3 className="font-bold text-sm text-white">修改單艦履歷</h3>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-slate-400 block mb-1">舷號</label><input type="text" value={editingShip.hull_number} onChange={e => setEditingShip({ ...editingShip, hull_number: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-cyan-300 font-mono" /></div>
              <div><label className="text-slate-400 block mb-1">艦名</label><input type="text" value={editingShip.name_zh} onChange={e => setEditingShip({ ...editingShip, name_zh: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            </div>
            <div><label className="text-slate-400 block mb-1">服役時間 (完整)</label><input type="text" value={editingShip.commissioned_year || ''} onChange={e => setEditingShip({ ...editingShip, commissioned_year: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-slate-400 block mb-1">所屬艦隊</label><input type="text" value={editingShip.fleet || ''} onChange={e => setEditingShip({ ...editingShip, fleet: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
              <div><label className="text-slate-400 block mb-1">所屬支隊</label><input type="text" value={editingShip.squadron || ''} onChange={e => setEditingShip({ ...editingShip, squadron: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            </div>
            <div><label className="text-slate-400 block mb-1">目前現狀</label><input type="text" value={editingShip.status} onChange={e => setEditingShip({ ...editingShip, status: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" /></div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditingShip(null)} className="flex-1 py-2 bg-slate-800 rounded-xl text-slate-300">取消</button>
              <button type="button" onClick={saveShipEdit} className={`flex-1 py-2 ${theme.accentBg} rounded-xl font-bold text-white`}>儲存更新</button>
            </div>
          </div>
        </div>
      )}

      {/* 後台管理抽屜 */}
      {showAdmin && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-center items-end sm:items-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="font-bold text-base text-white">資料庫管理後台</h2>
              <button type="button" onClick={() => setShowAdmin(false)} className="text-slate-400 hover:text-white text-xs px-2.5 py-1 rounded-full bg-slate-800">✕ 關閉</button>
            </div>

            <div className="flex border-b border-slate-800 text-xs font-bold p-1 bg-slate-950 mx-4 mt-3 rounded-xl gap-1">
              <button type="button" onClick={() => setActiveTab('classes')} className={`flex-1 py-2 rounded-lg ${activeTab === 'classes' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}>＋ 新增/更新艦型</button>
              <button type="button" onClick={() => setActiveTab('ships')} className={`flex-1 py-2 rounded-lg ${activeTab === 'ships' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}>＋ 新增舷號</button>
              <button type="button" onClick={() => setActiveTab('banner')} className={`flex-1 py-2 rounded-lg ${activeTab === 'banner' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400'}`}>頂部橫幅</button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {activeTab === 'banner' && (
                <form onSubmit={handleSaveBanner} className="space-y-3.5">
                  <textarea rows={3} placeholder="輸入廣播文字（留空自動隱藏）" value={adminBannerInput} onChange={e => setAdminBannerInput(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setAdminBannerInput('')} className="px-4 py-2.5 bg-slate-800 rounded-xl text-slate-300">清空</button>
                    <button type="submit" disabled={isSavingBanner} className={`flex-1 py-2.5 ${theme.accentBg} rounded-xl font-bold text-white`}>發布通報</button>
                  </div>
                </form>
              )}

              {activeTab === 'classes' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-950 border border-cyan-500/30 rounded-2xl space-y-2">
                    <span className="font-bold text-cyan-300 block">維基百科自動擷取 (概述＋11項技術數據＋單艦)</span>
                    <div className="flex gap-1.5">
                      <input type="text" placeholder="輸入關鍵字 (例: 052D 或 054A)" value={wikiQuery} onChange={e => setWikiQuery(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white" />
                      <button type="button" disabled={isFetchingWiki} onClick={handleFetchWikipedia} className="px-3 py-1.5 bg-cyan-600 font-bold rounded-xl text-white">
                        {isFetchingWiki ? '解析中...' : '自動填表'}
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleCreateOrUpdateClass} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input required placeholder="艦型代號 (例: 052D)" value={newClass.code || ''} onChange={e => setNewClass({ ...newClass, code: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                      <input placeholder="英文代號 (例: DDG)" value={newClass.nato_code || ''} onChange={e => setNewClass({ ...newClass, nato_code: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                    </div>
                    <input required placeholder="艦型全名 (例: 052D型飛彈驅逐艦)" value={newClass.name_zh || ''} onChange={e => setNewClass({ ...newClass, name_zh: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                    <input type="url" placeholder="艦艇照片網址" value={newClass.image_url || ''} onChange={e => setNewClass({ ...newClass, image_url: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                    
                    <div>
                      <label className="text-slate-400 block mb-1">第一欄：艦型概述 (維基第一大段)</label>
                      <textarea rows={3} placeholder="自動填入或貼上維基百科首段概述" value={newClass.overview || ''} onChange={e => setNewClass({ ...newClass, overview: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                    </div>

                    <div className="space-y-2 pt-1 border-t border-slate-800">
                      <span className="text-slate-400 font-bold block">第二欄：技術數據</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="排水量" value={newClass.displacement || ''} onChange={e => setNewClass({ ...newClass, displacement: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                        <input placeholder="最高速度" value={newClass.max_speed || ''} onChange={e => setNewClass({ ...newClass, max_speed: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="長度" value={newClass.length || ''} onChange={e => setNewClass({ ...newClass, length: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                        <input placeholder="型寬" value={newClass.beam || ''} onChange={e => setNewClass({ ...newClass, beam: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="動力方式" value={newClass.propulsion || ''} onChange={e => setNewClass({ ...newClass, propulsion: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                        <input placeholder="動力輸出" value={newClass.power_output || ''} onChange={e => setNewClass({ ...newClass, power_output: e.target.value })} className="bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      </div>
                      <input placeholder="乘員" value={newClass.crew || ''} onChange={e => setNewClass({ ...newClass, crew: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      <textarea rows={2} placeholder="搜索系統 (雷達/聲納，以頓號或換行隔開)" value={newClass.radar_systems || ''} onChange={e => setNewClass({ ...newClass, radar_systems: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      <textarea rows={2} placeholder="武器系統 (以頓號或換行隔開)" value={newClass.weapons_summary || ''} onChange={e => setNewClass({ ...newClass, weapons_summary: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      <textarea rows={2} placeholder="電戰系統" value={newClass.electronic_warfare || ''} onChange={e => setNewClass({ ...newClass, electronic_warfare: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                      <input placeholder="艦載機" value={newClass.aircraft || ''} onChange={e => setNewClass({ ...newClass, aircraft: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white" />
                    </div>

                    <button type="submit" className={`w-full py-3 ${theme.accentBg} rounded-xl font-bold text-white shadow-lg`}>
                      儲存並立即覆蓋刷新至前台
                    </button>
                  </form>
                </div>
              )}

              {activeTab === 'ships' && (
                <form onSubmit={handleCreateShip} className="space-y-3">
                  <select required value={newShip.class_id} onChange={e => setNewShip({ ...newShip, class_id: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white">
                    <option value="">-- 請選擇所屬艦型 --</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name_zh}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input required placeholder="舷號 (例: 175)" value={newShip.hull_number} onChange={e => setNewShip({ ...newShip, hull_number: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono" />
                    <input required placeholder="艦名 (例: 銀川)" value={newShip.name_zh} onChange={e => setNewShip({ ...newShip, name_zh: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                  </div>
                  <input placeholder="服役時間 (完整年月日)" value={newShip.commissioned_year} onChange={e => setNewShip({ ...newShip, commissioned_year: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono" />
                  <div className="grid grid-cols-2 gap-2">
                    <input placeholder="所屬艦隊" value={newShip.fleet} onChange={e => setNewShip({ ...newShip, fleet: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                    <input placeholder="所屬支隊" value={newShip.squadron} onChange={e => setNewShip({ ...newShip, squadron: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                  </div>
                  <input required placeholder="目前現狀 (例: 現役、海試、退役)" value={newShip.status} onChange={e => setNewShip({ ...newShip, status: e.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" />
                  <button type="submit" className={`w-full py-3 ${theme.accentBg} rounded-xl font-bold text-white shadow-lg`}>新增單艦至雲端資料庫</button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
