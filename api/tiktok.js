import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { getTikTokVideoUrl } = require('../lib/tiktok-fetcher.js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    try {
      const body = await request.json();
      const link = (body?.url || '').trim();
      if (!link) {
        return new Response(JSON.stringify({ error: 'Please provide a TikTok URL' }), {
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
      const result = await getTikTokVideoUrl(link);
      if (!result) {
        return new Response(JSON.stringify({ error: 'Could not get video. Try again or use a different link.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        success: true,
        downloadUrl: result.url,
        title: result.title || 'TikTok video',
        author: result.author || '',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || 'Failed to get video' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
