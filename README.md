# Yearbook Scraper

> Extract named portraits from video slideshows of scanned yearbook pages.

**Yearbook Scraper** is a web tool that pulls individual, named portrait images out of video slideshows. It breaks the problem into three layers — each one's output becomes the next one's input.

Born from a real problem: extracting 412 individual yearbook portraits from a 1-hour MP4 slideshow of scanned pages, naming each one, and printing them as name cards for a 50th high school reunion.

[Read the full story: *Bridges You Cross Once*](https://interactive-blog-sage.vercel.app/bridges/)

## The Three Layers

### Layer 1 — Frame Grabber

Load a video, scrub through it frame by frame, and grab clean screenshots between transitions. No AI needed — just a human eye and a click.

### Layer 2 — Template Builder

Draw rectangles over face positions on your grabbed frames. Define where portraits appear on each page layout. Save as reusable templates.

### Layer 3 — Extraction Pipeline

Apply templates to all frames, crop each face, and use OpenAI Vision to read the name text below each portrait. Download named files as a ZIP.

## Quick Start

```bash
git clone https://github.com/wpereira22/yearbook-scraper.git
cd yearbook-scraper
npm install
cp .env.example .env
# Add your OpenAI API key to .env
npm start
```

Then open [http://localhost:3000](http://localhost:3000)

## Configuration

The only required config is your OpenAI API key in `.env`:

```
OPENAI_API_KEY=sk-your-key-here
PORT=3000
```

Layer 3 (extraction) uses GPT-4o Vision for OCR. Layers 1 and 2 work entirely offline — no API key needed to grab frames and build templates.

## How It Works

The tool runs entirely in the browser, with a minimal Node.js server that proxies OpenAI Vision API calls.

- **Video processing**: HTML5 Video + Canvas API (client-side, no ffmpeg needed)
- **Template drawing**: Canvas with mouse/touch rectangle drawing
- **OCR**: OpenAI GPT-4o Vision API (server-side proxy)
- **Download**: JSZip for client-side ZIP generation

## Why Three Layers?

A single prompt can't reliably do all of this at once. The video has fading transitions between pages, multiple page layouts, and names printed in tiny serif type. Asking an AI to handle all of that produces 847 blurry files named `face_001.jpg`.

Instead, you build small scaffolding tools:

1. **You** pick the clean frames (10 min)
2. **You** mark where faces are on each layout (3 min)
3. **The machine** crops and reads names using your templates (30 sec)

Each layer gives the next one concrete structure to work with. Total time: ~15 minutes.

## License

MIT
