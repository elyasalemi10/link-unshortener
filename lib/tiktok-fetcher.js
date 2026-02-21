/**
 * Fetch TikTok video download URL - tries Lovetik first, SSSTik as fallback.
 * No paid providers, all free scrapers.
 */

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchViaLovetik(link) {
  const res = await fetch('https://lovetik.com/api/ajax/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Origin': 'https://lovetik.com',
      'Referer': 'https://lovetik.com/',
      'User-Agent': UA,
    },
    body: new URLSearchParams({ query: link }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data.links || !Array.isArray(data.links)) return null;
  const mp4Links = data.links.filter((l) => (l.t || '').includes('MP4'));
  let bestUrl = null;
  for (const l of mp4Links) {
    const u = l.a || l.url;
    if (u) {
      if ((l.t || '').toLowerCase().includes('1080') || (l.t || '').toLowerCase().includes('hd')) {
        bestUrl = u;
        break;
      }
      if (!bestUrl) bestUrl = u;
    }
  }
  if (!bestUrl && mp4Links.length) bestUrl = mp4Links[0].a || mp4Links[0].url;
  if (!bestUrl) return null;
  return {
    url: bestUrl,
    title: data.desc || data.title || '',
    author: data.author || data.author_name || '',
    cover: data.cover || data.thumbnail || null,
    quality: mp4Links.some((l) => (l.t || '').toLowerCase().includes('1080') || (l.t || '').toLowerCase().includes('hd')) ? 'HD' : 'SD',
  };
}

async function fetchViaSSSTik(link) {
  const base = 'https://ssstik.io';
  const pageRes = await fetch(base, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10000),
  });
  const html = await pageRes.text();
  const ttMatch = html.match(/s_tt\s*=\s*["']([^"']+)["']/);
  if (!ttMatch) return null;
  const tt = ttMatch[1];
  const postRes = await fetch(`${base}/abc?url=dl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': base,
      'Referer': `${base}/en`,
      'User-Agent': UA,
    },
    body: new URLSearchParams({ id: link, locale: 'en', tt }),
    signal: AbortSignal.timeout(15000),
  });
  const postHtml = await postRes.text();
  if (postHtml.includes('panel notification') || postHtml.includes('No content')) return null;
  const videoMatch = postHtml.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*without_watermark[^"]*"/) ||
    postHtml.match(/<a[^>]+class="[^"]*without_watermark[^"]*"[^>]+href="([^"]+)"/);
  if (!videoMatch) return null;
  let videoUrl = videoMatch[1];
  if (videoUrl.startsWith('//')) videoUrl = 'https:' + videoUrl;
  else if (videoUrl.startsWith('/')) videoUrl = base + videoUrl;
  return {
    url: videoUrl,
    title: '',
    author: '',
    cover: null,
    quality: 'HD',
  };
}

async function fetchViaSlbjs(link) {
  try {
    const res = await fetch('https://tdownv4.sl-bjs.workers.dev/?down=' + encodeURIComponent(link), {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(20000),
    });
    const d = await res.json();
    const url = d.download_url;
    if (!url) return null;
    return {
      url,
      title: d.title || '',
      author: d.author?.nickname || d.author?.username || '',
      cover: d.author?.avatar || null,
      quality: 'HD',
    };
  } catch {
    return null;
  }
}

async function fetchViaTikWM(link) {
  try {
    const res = await fetch('https://www.tikwm.com/api/?url=' + encodeURIComponent(link), {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (data.code !== 0 || !data.data) return null;
    const d = data.data;
    const url = d.hdplay || d.play;
    if (!url) return null;
    return {
      url,
      title: d.title || '',
      author: d.author?.nickname || d.author?.unique_id || '',
      cover: d.cover || null,
      quality: d.hdplay ? 'HD' : 'SD',
    };
  } catch {
    return null;
  }
}

async function getTikTokVideoUrl(link) {
  let result = await fetchViaSlbjs(link);
  if (result) return result;
  result = await fetchViaLovetik(link);
  if (result) return result;
  result = await fetchViaTikWM(link);
  if (result) return result;
  return await fetchViaSSSTik(link);
}

module.exports = { getTikTokVideoUrl };
