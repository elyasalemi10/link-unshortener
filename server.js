const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

// Load .env
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    for (const line of env.split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        process.env[key] = val;
      }
    }
  }
} catch { /* ignore */ }

const PORT = 3000;
const API_KEY = process.env.API_KEY;

function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  // CORS headers for API
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // Serve the main page
  if (req.url === '/' || req.url === '/index.html') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    const html = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
    return;
  }

  // API: Authenticated unshorten (POST /api, Bearer token, body: { "link": "..." })
  if ((req.url === '/api' || req.url === '/api/') && req.method === 'POST') {
    const auth = req.headers.authorization;
    const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!API_KEY || token !== API_KEY) {
      res.writeHead(401, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or missing API key' }));
      return;
    }
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { link } = JSON.parse(body || '{}');
        if (!link || !isValidUrl(link)) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid link' }));
          return;
        }
        const response = await fetch(link, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });
        const fullLink = response.url || link;
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ link: fullLink }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Failed to unshorten' }));
      }
    });
    return;
  }

  // Serve TikTok downloader page
  if (req.url === '/tiktok' || req.url === '/tiktok.html') {
    const filePath = path.join(__dirname, 'public', 'tiktok.html');
    if (fs.existsSync(filePath)) {
      const html = fs.readFileSync(filePath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // API: TikTok video download (best quality, no watermark via lovetik)
  if (req.url === '/api/tiktok' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body || '{}');
        let link = (url || '').trim();
        if (!link) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Please provide a TikTok URL' }));
          return;
        }
        // Unshorten vt.tiktok.com, vm.tiktok.com, etc.
        if (isValidUrl(link) && /^(https?:\/\/)?(vt|vm)\.tiktok\.com\//i.test(link)) {
          try {
            const r = await fetch(link, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
            link = r.url || link;
          } catch (e) { /* keep original */ }
        }
        const tikMatch = link.match(/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/);
        if (!tikMatch) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid TikTok URL' }));
          return;
        }

        const apiRes = await fetch('https://lovetik.com/api/ajax/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://lovetik.com',
            'Referer': 'https://lovetik.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          body: new URLSearchParams({ query: link }),
        });

        const data = await apiRes.json();
        if (!data.links || !Array.isArray(data.links)) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: data.mess || 'Could not get video. Try again or check the link.' }));
          return;
        }

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

        if (!bestUrl) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No video URL found' }));
          return;
        }

        const isHd = mp4Links.some((l) => (l.t || '').toLowerCase().includes('1080') || (l.t || '').toLowerCase().includes('hd'));
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          downloadUrl: bestUrl,
          title: data.desc || data.title || 'TikTok video',
          author: data.author || data.author_name || '',
          cover: data.cover || data.thumbnail || null,
          duration: data.duration || null,
          quality: isHd ? 'HD' : 'SD',
        }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Failed to get video' }));
      }
    });
    return;
  }

  // GET /api/download?url=... - Expand short link, fetch video, stream it back
  if (req.url.startsWith('/api/download') && req.method === 'GET') {
    try {
      const u = new URL(req.url, 'http://localhost');
      let link = (u.searchParams.get('url') || '').trim();
      if (!link) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing url parameter. Use ?url=YOUR_TIKTOK_LINK' }));
        return;
      }
      if (!/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/.test(link)) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid TikTok URL' }));
        return;
      }
      // 1. Expand short link
      if (/^(https?:\/\/)?(vt|vm)\.tiktok\.com\//i.test(link)) {
        const r = await fetch(link, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
        link = r.url || link;
      }
      // 2. Get video URL from Lovetik
      const apiRes = await fetch('https://lovetik.com/api/ajax/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://lovetik.com',
          'Referer': 'https://lovetik.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: new URLSearchParams({ query: link }),
      });
      const data = await apiRes.json();
      if (!data.links || !Array.isArray(data.links)) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: data.mess || 'Could not get video' }));
        return;
      }
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
      if (!bestUrl) {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No video URL found' }));
        return;
      }
      // 3. Stream video
      const videoRes = await fetch(bestUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(60000),
      });
      if (!videoRes.ok) {
        res.writeHead(502, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch video' }));
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="tiktok-video.mp4"',
      });
      Readable.fromWeb(videoRes.body).pipe(res);
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Download failed' }));
    }
    return;
  }

  // Proxy: Stream TikTok video for download (avoids CORS)
  if (req.url.startsWith('/api/tiktok/proxy') && req.method === 'GET') {
    try {
      const u = new URL(req.url, 'http://localhost');
      const proxyUrl = u.searchParams.get('url');
      if (!proxyUrl || !proxyUrl.startsWith('https://') || (!proxyUrl.includes('tiktok') && !proxyUrl.includes('tiktokcdn') && !proxyUrl.includes('byteoversea'))) {
        res.writeHead(400);
        res.end('Invalid URL');
        return;
      }
      const videoRes = await fetch(proxyUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: AbortSignal.timeout(60000),
      });
      if (!videoRes.ok) {
        res.writeHead(502);
        res.end('Failed to fetch video');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="tiktok-video.mp4"',
      });
      Readable.fromWeb(videoRes.body).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end('Download failed');
    }
    return;
  }

  // Web UI: Unshorten URL (no auth)
  if (req.url === '/api/unshorten' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { url } = JSON.parse(body);
        if (!url || !isValidUrl(url)) {
          res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Please provide a valid URL' }));
          return;
        }

        const response = await fetch(url, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        const finalUrl = response.url || url;
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ originalUrl: url, fullUrl: finalUrl }));
      } catch (err) {
        res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Failed to unshorten URL' }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Link Unshortener running at http://localhost:${PORT}`);
});
