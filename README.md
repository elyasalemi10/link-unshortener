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

**POST** `/api`

- **Auth:** `Authorization: Bearer <API_KEY>`
- **Body:** `{ "link": "https://vt.tiktok.com/..." }`
- **Response:** `{ "link": "https://www.tiktok.com/..." }`
