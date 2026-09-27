const WIKI_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'TAIWAN-NAVY-ShipID/5.4 (https://shipid.vercel.app; mailto:pkddqq@gmail.com)',
  'Api-User-Agent': 'TAIWAN-NAVY-ShipID/5.4 (https://shipid.vercel.app; mailto:pkddqq@gmail.com)'
};

const fetchWikiJson = async (url: string) => {
  const response = await fetch(url, {
    headers: WIKI_HEADERS,
    signal: AbortSignal.timeout(15000)
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Wikipedia API ${response.status}: ${body.slice(0, 160)}`);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Wikipedia API returned invalid JSON: ${body.slice(0, 160)}`);
  }
};

export default async function handler(req: any, res: any) {
  const query = typeof req.query?.title === 'string' ? req.query.title.trim() : '';
  if (!query) return res.status(400).json({ error: '缺少維基條目關鍵字' });

  try {
    let title = query;
    try {
      const searchData = await fetchWikiJson(`https://zh.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json&origin=*`);
      if (searchData[1]?.[0]) title = searchData[1][0];
    } catch (searchError) {
      console.warn('Wikipedia search failed; trying the provided title directly.', searchError);
    }

    const data = await fetchWikiJson(`https://zh.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&formatversion=2&redirects=1&origin=*`);
    if (data.error) return res.status(404).json({ error: data.error.info || '查無維基條目' });
    const html = typeof data.parse?.text === 'string' ? data.parse.text : data.parse?.text?.['*'] || '';
    if (!html) throw new Error('Wikipedia API returned an empty article body');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ title: data.parse?.title || title, html });
  } catch (error) {
    console.error('Wikipedia proxy failed:', error);
    return res.status(502).json({ error: '維基資料服務暫時無法連線' });
  }
}
