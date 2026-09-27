export default async function handler(req: any, res: any) {
  const query = typeof req.query?.title === 'string' ? req.query.title.trim() : '';
  if (!query) return res.status(400).json({ error: '缺少維基條目關鍵字' });

  try {
    let title = query;
    const search = await fetch(`https://zh.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json`);
    if (search.ok) {
      const data = await search.json();
      if (data[1]?.[0]) title = data[1][0];
    }

    const parsed = await fetch(`https://zh.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text|images&format=json&redirects=1`);
    const data = await parsed.json();
    if (!parsed.ok || data.error) return res.status(404).json({ error: data.error?.info || '查無維基條目' });
    return res.status(200).json({ title, html: data.parse?.text?.['*'] || '' });
  } catch {
    return res.status(502).json({ error: '維基資料服務暫時無法連線' });
  }
}
