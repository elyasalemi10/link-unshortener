# Link Unshortener

Unshorten shortened URLs (TikTok, bit.ly, etc.) to get the full destination link.

## Features

- **Web UI** – Paste a short link, get the full URL
- **API** – Authenticated endpoint for programmatic access

## Setup

1. Clone and install:
   ```bash
   npm install  # no deps, but run if you add any
   ```

2. Create `.env` from example:
   ```bash
   cp .env.example .env
   ```

3. Set your API key in `.env`:
   ```
   API_KEY=your-secret-api-key-here
   ```

4. Start the server:
   ```bash
   npm start
   ```

Visit http://localhost:3000

### Vercel deployment

- Add `API_KEY` in your Vercel project **Settings → Environment Variables**
- The API is at `POST /api` (not `/aapi` – watch for typos)

## API

### Link Unshortener

**POST** `/api`

- **Auth:** `Authorization: Bearer <API_KEY>`
- **Body:** `{ "link": "https://vt.tiktok.com/..." }`
- **Response:** `{ "link": "https://www.tiktok.com/..." }`

### TikTok Video Download

**Workflow:** Short link → API → Download link → Fetch video

**1. POST** `/api/tiktok` — Get download URL (no watermark, HD)

- **Body:** `{ "url": "https://vt.tiktok.com/..." }` (short or full TikTok URL)
- **Response:** `{ "success": true, "downloadUrl": "https://...", "title": "...", "author": "..." }`

**2. GET** `/api/download?url=...` — Download video through API

- Pass the **TikTok URL** (not the downloadUrl). API fetches and returns the MP4.
- **POST** `/api/download` with `{ "url": "https://vt.tiktok.com/..." }` also works.

**Example:**

```bash
# Step 1: Get download link
curl -X POST "https://your-domain.com/api/tiktok" -H "Content-Type: application/json" -d '{"url":"https://vt.tiktok.com/ZSr7brpo4/"}'

# Step 2: Download video (use TikTok URL, not the downloadUrl)
curl -L -o video.mp4 "https://your-domain.com/api/download?url=https://vt.tiktok.com/ZSr7brpo4/"
```

**Provider:** Slbjs (no watermark, HD) with Lovetik/TikWM/SSSTik fallbacks.
