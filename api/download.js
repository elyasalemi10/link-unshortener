const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed. Use GET with ?url=' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    try {
      const u = new URL(request.url);
      let link = (u.searchParams.get('url') || '').trim();
      if (!link) {
        return new Response(JSON.stringify({ error: 'Missing url parameter. Use ?url=YOUR_TIKTOK_LINK' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/.test(link)) {
        return new Response(JSON.stringify({ error: 'Invalid TikTok URL' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Expand short link (vt.tiktok.com, vm.tiktok.com)
      if (/^(https?:\/\/)?(vt|vm)\.tiktok\.com\//i.test(link)) {
        const r = await fetch(link, {
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        link = r.url || link;
      }

      // 2. Get video URL from Lovetik
      const apiRes = await fetch('https://lovetik.com/api/ajax/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Origin': 'https://lovetik.com',
          'Referer': 'https://lovetik.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        body: new URLSearchParams({ query: link }),
      });
      const data = await apiRes.json();
      if (!data.links || !Array.isArray(data.links)) {
        return new Response(JSON.stringify({ error: data.mess || 'Could not get video' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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
        return new Response(JSON.stringify({ error: 'No video URL found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Fetch and stream video
      const videoRes = await fetch(bestUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      if (!videoRes.ok) {
        return new Response(JSON.stringify({ error: 'Failed to fetch video' }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(videoRes.body, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': 'attachment; filename="tiktok-video.mp4"',
          ...corsHeaders,
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || 'Download failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
