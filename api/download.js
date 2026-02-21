import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { getTikTokVideoUrl } = require('../lib/tiktok-fetcher.js');

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
      const result = await getTikTokVideoUrl(link);
      if (!result) {
        return new Response(JSON.stringify({ error: 'Could not get video. Try again or use a different link.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const bestUrl = result.url;

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
