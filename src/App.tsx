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
  displacement?: string;
  dimensions?: string;
  propulsion?: string;
  max_speed?: string;
  crew?: string;
  radar_systems?: string;
  electronic_warfare?: string;
  aircraft?: string;
}

interface Ship {
  id: string;
  class_id: string;
  hull_number: string;
  name_zh: string;
  commissioned_year?: string; // 服役時間
  fleet?: string;             // 所屬艦隊
  squadron?: string;          // 所屬支隊
  status: string;             // 目前現狀
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
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [expandedSpecsId, setExpandedSpecsId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('2026.09.27 v2.1');

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
    code: '', name_zh: '', category: '', nato_code: '', image_url: '', visual_features: [], weapons_summary: '',
    displacement: '', dimensions: '', propulsion: '', max_speed: '', crew: '', radar_systems: '', electronic_warfare: '', aircraft: ''
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

  // 🌐 維基百科深度自動分析 (含舷號、艦名、服役時間、艦隊、支隊、現況)
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

      const getInfoBoxValue = (keywords: string[]) => {
        const rows = Array.from(doc.querySelectorAll('table.infobox tr'));
        for (const row of rows) {
          const th = row.querySelector('th')?.textContent?.trim() || '';
          if (keywords.some(k => th.includes(k))) {
            const td = row.querySelector('td');
            if (td) return td.textContent?.replace(/\[.*?\]/g, '').trim().slice(0, 150) || '';
          }
        }
        return '';
      };

      const displacement = getInfoBoxValue(['排水量', '排水']);
      const dimensions = getInfoBoxValue(['全長', '全长', '長度', '船長', '型寬', '吃水']);
      const propulsion = getInfoBoxValue(['動力', '动力', '主機']);
      const maxSpeedVal = getInfoBoxValue(['航速', '最高速度', '極速']);
      const crewVal = getInfoBoxValue(['乘員', '定員', '編制']);
      const radarVal = getInfoBoxValue(['雷達', '雷达', '偵搜', '搜索']);
      const ewVal = getInfoBoxValue(['電子戰', '电子战', '電戰', '干擾']);
      const airVal = getInfoBoxValue(['艦載機', '直升機', '直升机']);

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

      let weaponsSummary = getInfoBoxValue(['武器', '武裝', '武装']) || '';
      if (!weaponsSummary) {
        const weaponKeywords = ['垂直發射', '垂直发射', '艦砲', '舰炮', '防空導彈', '防空导弹', '反艦導彈', '反舰导弹'];
        const paragraphs = Array.from(doc.querySelectorAll('p'));
        for (const p of paragraphs) {
          const text = p.textContent?.trim() || '';
          if (weaponKeywords.some(k => text.includes(k))) {
            weaponsSummary = text.slice(0, 100);
            break;
          }
        }
      }

      setNewClass({
        code: newClass.code || guessedCode,
        name_zh: realTitle,
        category: newClass.category || guessedCategory,
        nato_code: newClass.nato_code || guessedNato,
        image_url: imgUrl || newClass.image_url,
        visual_features: (newClass.visual_features && newClass.visual_features.length > 0) ? newClass.visual_features : ['相控陣雷達', '封閉式主桅'],
        weapons_summary: weaponsSummary || '配備通用垂直發射系統與艦砲',
        displacement: displacement || '約 7,500 噸',
        dimensions: dimensions || '長 157 公尺 / 寬 19 公尺 / 吃水 6 公尺',
        propulsion: propulsion || '柴燃聯合動力方式 (CODOG)',
        max_speed: maxSpeedVal || '30 節',
        crew: crewVal || '約 280 人',
        radar_systems: radarVal || '346A型 主動相位陣列雷達',
        electronic_warfare: ewVal || '726型 電子對抗系統',
        aircraft: airVal || '直-9C / 直-20F 反潛直升機 1 架'
      });

      // 3. 深入解析「本級艦 / 艦名列表」表格
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
            if (/狀[態态]|服役|現況|现况|Status/i.test(txt) && statusIdx === -1) statusIdx = idx;
            if (/艦隊|舰队|配屬/i.test(txt) && fleetIdx === -1) fleetIdx = idx;
            if (/支隊|支队/i.test(txt) && squadronIdx === -1) squadronIdx = idx;
            if (/服役[日年期]|入役|年份/i.test(txt) && yearIdx === -1) yearIdx = idx;
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
              fleet = fleet.replace(/\[.*?\]/g, '').replace(/[\s\r\n]+/g, '').slice(0, 15);
              squadron = squadron.replace(/\[.*?\]/g, '').replace(/[\s\r\n]+/g, '').slice(0, 15);
              commYear = commYear.replace(/\[.*?\]/g, '').replace(/[\s\r\n]+/g, '').slice(0, 15);

              // 若艦隊欄位裡包含支隊（例：南部戰區海軍驅9支隊），自動拆解
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
              else status = status.slice(0, 8);

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
        alert(`✅ 成功配對條目【${realTitle}】！\n已提取完整規格與 ${foundShips.length} 艘單艦（含舷號/艦名/服役日/艦隊/支隊/現狀）！`);
      } else {
        alert(`✅ 成功配對條目【${realTitle}】！\n已填入基本規格與工程參數。`);
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
      visual_features: editingClass.visual_features || [],
      displacement: editingClass.displacement || '',
      dimensions: editingClass.dimensions || '',
      propulsion: editingClass.propulsion || '',
      max_speed: editingClass.max_speed || '',
      crew: editingClass.crew || '',
      radar_systems: editingClass.radar_systems || '',
      electronic_warfare: editingClass.electronic_warfare || '',
      aircraft: editingClass.aircraft || ''
    }).eq('id', editingClass.id);
    setEditingClass(null);
    fetchData();
  };

  const saveShipEdit = async () => {
    if (!editingShip || !supabase) return;
    await supabase.from('ships').update({
      name_zh: editingShip.name_zh,
      status: editingShip.status,
      fleet: editingShip.fleet || '',
      squadron: editingShip.squadron || '',
      commissioned_year: editingShip.commissioned_year || ''
    }).eq('id', editingShip.id);
    setEditingShip(null);
    fetchData();
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newClass.code) return;
    const cid = `c-${newClass.code.toLowerCase().trim()}`;

    let visualFeaturesArray: string[] = [];
    if (Array.isArray(newClass.visual_features)) {
      visualFeaturesArray = newClass.visual_features;
    } else if (typeof newClass.visual_features === 'string') {
      visualFeaturesArray = (newClass.visual_features as string).split(/[,，]/).map(s => s.trim()).filter(Boolean);
    }

    await supabase.from('ship_classes').insert([{
      id: cid,
      code: newClass.code.trim(),
      name_zh: newClass.name_zh?.trim() || '',
      category: newClass.category?.trim() || '',
      nato_code: newClass.nato_code?.trim() || '',
      image_url: newClass.image_url?.trim() || '',
      visual_features: visualFeaturesArray,
      weapons_summary: newClass.weapons_summary?.trim() || '',
      displacement: newClass.displacement?.trim() || '',
      dimensions: newClass.dimensions?.trim() || '',
      propulsion: newClass.propulsion?.trim() || '',
      max_speed: newClass.max_speed?.trim() || '',
      crew: newClass.crew?.trim() || '',
      radar_systems: newClass.radar_systems?.trim() || '',
      electronic_warfare: newClass.electronic_warfare?.trim() || '',
      aircraft: newClass.aircraft?.trim() || ''
    }]);

    if (includeParsedShips && parsedShips.length > 0) {
      const shipPayload = parsedShips.map(s => ({
        id: `s-${s.hull_number.trim()}`,
        class_id: cid,
        hull_number: s.hull_number.trim(),
        name_zh: s.name_zh.trim(),
        status: s.status.trim(),
        fleet: s.fleet || '',
        squadron: s.squadron || '',
        commissioned_year: s.commissioned_year || ''
      }));
      await supabase.from('ships').upsert(shipPayload);
    }

    setNewClass({ code: '', name_zh: '', category: '', nato_code: '', image_url: '', visual_features: [], weapons_summary: '' });
    setWikiQuery('');
    setParsedShips([]);
    setShowAdmin(false);
    fetchData();
    alert(`🎉 艦型【${newClass.code}】與 ${includeParsedShips ? parsedShips.length : 0} 艘單艦完整參數已寫入雲端！`);
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
      status: newShip.status.trim(),
      fleet: newShip.fleet.trim(),
      squadron: newShip.squadron.trim(),
      commissioned_year: newShip.commissioned_year.trim()
    }]);
    setNewShip({ class_id: '', hull_number: '', name_zh: '', status: '現役', fleet: '', squadron: '', commissioned_year: '' });
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
                      <div key={s.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex justify-between items-center transition shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-2xl font-black ${theme.accentText} tracking-tight`}>{s.hull_number}</span>
                          <div>
                            <div className="font-bold text-white text-sm">{s.name_zh}</div>
                            <div className="text-[11px] text-slate-400 font-medium flex items-center gap-2 pt-0.5">
                              <span>{s.fleet || '未知艦隊'}{s.squadron && ` · ${s.squadron}`}</span>
                              {s.commissioned_year && <span className="font-mono text-slate-500">[{s.commissioned_year}]</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.status === '現役' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                            {s.status}
                          </span>
                          <button 
                            type="button"
                            onClick={() => setEditingShip(s)}
                            className={`px-2 py-1 text-xs font-semibold rounded-lg bg-slate-800 ${theme.accentText} border ${theme.cardBorder} transition active:scale-95`}
                          >
                            修改
                          </button>
                        </div>
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
                  const isSpecsExpanded = expandedSpecsId === c.id;
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
                              <span>暫無艦影照片</span>
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
                                <span>主要武裝配置</span>
                              </div>
                              <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800 leading-relaxed">
                                {c.weapons_summary}
                              </p>
                            </div>
                          )}

                          {/* 詳細工程規格收合抽屜 */}
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => setExpandedSpecsId(isSpecsExpanded ? null : c.id)}
                              className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between text-xs font-semibold transition active:scale-98 ${isSpecsExpanded ? (nightMode ? 'bg-red-950/60 border-red-500/40 text-red-300' : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300') : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-white'}`}
                            >
                              <span className="flex items-center gap-1.5 font-mono">
                                <span>{isSpecsExpanded ? '▼' : '▶'}</span>
                                <span>詳細工程規格與偵搜電戰數據</span>
                              </span>
                              <span className="text-[10px] text-slate-500 font-normal">
                                {isSpecsExpanded ? '收合' : '展開完整數據'}
                              </span>
                            </button>

                            {isSpecsExpanded && (
                              <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2.5 text-xs">
                                <div className="grid grid-cols-2 gap-2 text-[11px]">
                                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                                    <span className="text-slate-500 block text-[10px]">排水量</span>
                                    <span className="font-bold text-white">{c.displacement || '-'}</span>
                                  </div>
                                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                                    <span className="text-slate-500 block text-[10px]">最高航速</span>
                                    <span className={`font-mono font-bold ${theme.accentText}`}>{c.max_speed || '-'}</span>
                                  </div>
                                </div>

                                <div className="space-y-1.5 text-[11px]">
                                  {c.dimensions && (
                                    <div className="flex justify-between border-b border-slate-900 pb-1">
                                      <span className="text-slate-500">尺寸構型:</span>
                                      <span className="text-slate-200 text-right">{c.dimensions}</span>
                                    </div>
                                  )}
                                  {c.propulsion && (
                                    <div className="flex justify-between border-b border-slate-900 pb-1">
                                      <span className="text-slate-500">動力配置:</span>
                                      <span className="text-slate-200 text-right">{c.propulsion}</span>
                                    </div>
                                  )}
                                  {c.crew && (
                                    <div className="flex justify-between border-b border-slate-900 pb-1">
                                      <span className="text-slate-500">編制乘員:</span>
                                      <span className="text-slate-200 text-right">{c.crew}</span>
                                    </div>
                                  )}
                                  {c.radar_systems && (
                                    <div className="border-b border-slate-900 pb-1 pt-0.5">
                                      <span className="text-slate-500 block text-[10px]">雷達偵搜系統:</span>
                                      <span className="text-cyan-300 font-mono">{c.radar_systems}</span>
                                    </div>
                                  )}
                                  {c.electronic_warfare && (
                                    <div className="border-b border-slate-900 pb-1 pt-0.5">
                                      <span className="text-slate-500 block text-[10px]">電子戰裝備:</span>
                                      <span className="text-slate-300 font-mono">{c.electronic_warfare}</span>
                                    </div>
                                  )}
                                  {c.aircraft && (
                                    <div className="pt-0.5">
                                      <span className="text-slate-500 block text-[10px]">艦載機配置:</span>
                                      <span className="text-slate-300">{c.aircraft}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* 🎖️ 單艦身分列表（條列式戰術身分卡片：舷號 / 艦名 / 服役時間 / 艦隊 / 支隊 / 現狀） */}
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-slate-400 tracking-wider flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <span className={`w-2 h-2 rounded-full ${theme.accentBg}`}></span>
                                <span>本級單艦編裝履歷表 ({classShips.length} 艘)</span>
                              </span>
                            </div>

                            {classShips.length > 0 ? (
                              <div className="space-y-2">
                                {classShips.map(s => (
                                  <div key={s.id} className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                                    <div className="flex justify-between items-start">
                                      <div className="flex items-baseline gap-2.5">
                                        <span className={`font-mono text-xl font-black ${theme.accentText} tracking-tight`}>{s.hull_number}</span>
                                        <span className="font-bold text-white text-sm">{s.name_zh}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.status === '現役' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                                          {s.status}
                                        </span>
                                        <button 
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setEditingShip(s); }}
                                          className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 transition"
                                        >
                                          編輯
                                        </button>
                                      </div>
                                    </div>

                                    {/* 戰術編制詳細資訊 */}
                                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/70 p-2 rounded-lg border border-slate-900">
                                      <div>
                                        <span className="text-slate-500 block text-[9px] uppercase font-mono">編屬部隊 (艦隊 / 支隊)</span>
                                        <span className="text-slate-200 font-medium">
                                          {s.fleet || '未載明'}{s.squadron && ` · ${s.squadron}`}
                                        </span>
                                      </div>
                                      <div>
                                        <span className="text-slate-500 block text-[9px] uppercase font-mono">服役入役時間</span>
                                        <span className="font-mono text-cyan-300 font-medium">
                                          {s.commissioned_year || '未載明'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 py-1 bg-slate-900/40 p-3 rounded-xl border border-dashed border-slate-800 text-center">
                                尚無登錄單艦舷號資料
                              </p>
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

              <div className="bg-slate-950/70 p-3 rounded-2xl border border-slate-800 space-y-2 text-[11px]">
                <div className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider text-center">
                  SPECIFICATIONS & SENSORS
                </div>
                <div className="grid grid-cols-2 gap-3 text-center divide-x divide-slate-800">
                  <div className="space-y-1.5 text-left">
                    <div><span className="text-slate-500">排水量:</span> <span className="text-white font-bold">{compareShipA.displacement || '-'}</span></div>
                    <div><span className="text-slate-500">航速:</span> <span className={`font-mono font-bold ${theme.accentText}`}>{compareShipA.max_speed || '-'}</span></div>
                    <div><span className="text-slate-500">雷達:</span> <span className="text-cyan-300 font-mono text-[10px] block">{compareShipA.radar_systems || '-'}</span></div>
                  </div>
                  <div className="space-y-1.5 pl-3 text-left">
                    <div><span className="text-slate-500">排水量:</span> <span className="text-white font-bold">{compareShipB.displacement || '-'}</span></div>
                    <div><span className="text-slate-500">航速:</span> <span className={`font-mono font-bold ${theme.accentText}`}>{compareShipB.max_speed || '-'}</span></div>
                    <div><span className="text-slate-500">雷達:</span> <span className="text-cyan-300 font-mono text-[10px] block">{compareShipB.radar_systems || '-'}</span></div>
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
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
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
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
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
                <label className={`text-[11px] font-bold ${theme.accentText} mb-1 block`}>官方照片網址</label>
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
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">艦種分類</label>
                  <input
                    type="text"
                    value={editingClass.category}
                    onChange={e => setEditingClass({ ...editingClass, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">英文代號</label>
                  <input
                    type="text"
                    value={editingClass.nato_code || ''}
                    onChange={e => setEditingClass({ ...editingClass, nato_code: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">排水量</label>
                  <input
                    type="text"
                    value={editingClass.displacement || ''}
                    onChange={e => setEditingClass({ ...editingClass, displacement: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">最高航速</label>
                  <input
                    type="text"
                    value={editingClass.max_speed || ''}
                    onChange={e => setEditingClass({ ...editingClass, max_speed: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">雷達偵搜系統</label>
                <input
                  type="text"
                  value={editingClass.radar_systems || ''}
                  onChange={e => setEditingClass({ ...editingClass, radar_systems: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400 mb-1 block">武裝配置總結</label>
                <input
                  type="text"
                  value={editingClass.weapons_summary || ''}
                  onChange={e => setEditingClass({ ...editingClass, weapons_summary: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
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

      {/* 單艦修改彈窗（完整包含 舷號 / 艦名 / 服役時間 / 艦隊 / 支隊 / 現狀） */}
      {editingShip && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-sm bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto sm:hidden mb-2"></div>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>修改單艦履歷</span> <span className={`font-mono ${theme.accentText} font-bold`}>{editingShip.hull_number}</span>
              </h3>
              <button type="button" onClick={() => setEditingShip(null)} className="text-slate-400 hover:text-white text-xs px-2 py-1">✕</button>
            </div>
            
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">舷號 (Hull)</label>
                  <input
                    type="text"
                    value={editingShip.hull_number}
                    onChange={e => setEditingShip({ ...editingShip, hull_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">艦名</label>
                  <input
                    type="text"
                    value={editingShip.name_zh}
                    onChange={e => setEditingShip({ ...editingShip, name_zh: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">所屬艦隊</label>
                  <input
                    type="text"
                    placeholder="例: 南部戰區海軍"
                    value={editingShip.fleet || ''}
                    onChange={e => setEditingShip({ ...editingShip, fleet: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">所屬支隊</label>
                  <input
                    type="text"
                    placeholder="例: 驅逐艦第9支隊"
                    value={editingShip.squadron || ''}
                    onChange={e => setEditingShip({ ...editingShip, squadron: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">服役入役時間</label>
                  <input
                    type="text"
                    placeholder="例: 2014-03-21"
                    value={editingShip.commissioned_year || ''}
                    onChange={e => setEditingShip({ ...editingShip, commissioned_year: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 mb-1 block">目前現狀</label>
                  <input
                    type="text"
                    placeholder="例: 現役、海試、退役"
                    value={editingShip.status}
                    onChange={e => setEditingShip({ ...editingShip, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button type="button" onClick={() => setEditingShip(null)} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-300">取消</button>
              <button type="button" onClick={saveShipEdit} className={`flex-1 py-2.5 ${theme.accentBg} ${theme.accentHover} rounded-xl text-xs font-bold text-white shadow-lg`}>儲存更新</button>
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
                  <div className="p-3 bg-gradient-to-r from-cyan-950/40 to-slate-950 border border-cyan-500/30 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 text-xs flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
                        </svg>
                        <span>維基百科深度自動擷取 (規格＋單艦履歷)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">OPENSEARCH</span>
                    </div>

                    <div className="flex gap-1.5">
                      <input 
                        type="text"
                        placeholder="輸入關鍵字 (例如: 052D 或 054A)"
                        value={wikiQuery}
                        onChange={e => setWikiQuery(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        disabled={isFetchingWiki}
                        onClick={handleFetchWikipedia}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shrink-0 active:scale-95 shadow-md shadow-cyan-950"
                      >
                        {isFetchingWiki ? '解析中...' : '自動填表'}
                      </button>
                    </div>

                    {parsedShips.length > 0 && (
                      <div className="mt-2 p-2.5 bg-black/60 border border-cyan-500/40 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={includeParsedShips}
                              onChange={e => setIncludeParsedShips(e.target.checked)}
                              className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                            />
                            <span>同時匯入維基單艦履歷列表 ({parsedShips.length} 艘)</span>
                          </label>
                          <span className="text-[10px] text-emerald-400 font-mono">已抓取舷號</span>
                        </div>

                        {includeParsedShips && (
                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 border-t border-slate-800/80 pt-1.5">
                            {parsedShips.map((s, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-900/80 p-1.5 rounded border border-slate-800">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-cyan-400 font-bold">{s.hull_number}</span>
                                  <span className="text-white font-bold">{s.name_zh}</span>
                                  <span className="text-slate-400">{s.fleet}{s.squadron && `/${s.squadron}`}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-slate-500">{s.commissioned_year}</span>
                                  <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 rounded">{s.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleCreateClass} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 font-bold mb-1 block">艦型代號 (例: 052D)</label>
                        <input 
                          required 
                          placeholder="例: 052D"
                          value={newClass.code || ''} 
                          onChange={e => setNewClass({ ...newClass, code: e.target.value })} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 font-bold mb-1 block">英文代號</label>
                        <input 
                          placeholder="例: DDG、FFG"
                          value={newClass.nato_code || ''} 
                          onChange={e => setNewClass({ ...newClass, nato_code: e.target.value })} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">艦型全名</label>
                      <input 
                        required 
                        placeholder="例: 052D型飛彈驅逐艦"
                        value={newClass.name_zh || ''} 
                        onChange={e => setNewClass({ ...newClass, name_zh: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">艦艇照片網址</label>
                      <input 
                        type="url"
                        placeholder="例: https://.../ship.jpg"
                        value={newClass.image_url || ''} 
                        onChange={e => setNewClass({ ...newClass, image_url: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400 font-bold mb-1 block">排水量</label>
                        <input 
                          placeholder="例: 7,500 噸"
                          value={newClass.displacement || ''} 
                          onChange={e => setNewClass({ ...newClass, displacement: e.target.value })} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white" 
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 font-bold mb-1 block">最高航速</label>
                        <input 
                          placeholder="例: 30 節"
                          value={newClass.max_speed || ''} 
                          onChange={e => setNewClass({ ...newClass, max_speed: e.target.value })} 
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white" 
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">雷達偵搜系統</label>
                      <input 
                        placeholder="例: 346A型 主動相位陣列雷達"
                        value={newClass.radar_systems || ''} 
                        onChange={e => setNewClass({ ...newClass, radar_systems: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-white" 
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">武裝概要</label>
                      <input 
                        placeholder="例: 64單元通用垂直發射系統、130mm艦砲"
                        value={newClass.weapons_summary || ''} 
                        onChange={e => setNewClass({ ...newClass, weapons_summary: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>

                    <button type="submit" className={`w-full py-3 ${theme.accentBg} ${theme.accentHover} rounded-xl font-bold text-white shadow-lg active:scale-95 transition`}>
                      {includeParsedShips && parsedShips.length > 0 ? `新增艦型 ＋ 同步批次建立 ${parsedShips.length} 艘單艦完整參數` : '新增艦型至雲端資料庫'}
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
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-mono" 
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">所屬艦隊</label>
                      <input 
                        placeholder="例: 南部戰區海軍"
                        value={newShip.fleet} 
                        onChange={e => setNewShip({ ...newShip, fleet: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">所屬支隊</label>
                      <input 
                        placeholder="例: 驅逐艦第9支隊"
                        value={newShip.squadron} 
                        onChange={e => setNewShip({ ...newShip, squadron: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">服役入役時間</label>
                      <input 
                        placeholder="例: 2016-07-12"
                        value={newShip.commissioned_year} 
                        onChange={e => setNewShip({ ...newShip, commissioned_year: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 font-bold mb-1 block">目前現狀</label>
                      <input 
                        required
                        placeholder="例: 現役、海試、退役"
                        value={newShip.status} 
                        onChange={e => setNewShip({ ...newShip, status: e.target.value })} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" 
                      />
                    </div>
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
