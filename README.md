# Progressive Context

> Build small tools that feed the next.

**Progressive Context** is a web-based frame builder for extracting named images from video slideshows. It breaks the problem into three disposable layers — each one's output becomes the next one's input.

Born from a real problem: extracting 412 individual yearbook portraits from a 1-hour MP4 slideshow of scanned pages, naming each one, and printing them as name cards for a 50th high school reunion.

[Read the full story](#)

## The Three Layers

### Layer 1 — Frame Grabber

Load a video, scrub through it frame by frame, and grab clean screenshots between transitions. No AI needed — just a human eye and a click.

### Layer 2 — Template Builder

Draw rectangles over regions of interest on your grabbed frames. Define where faces (or any elements) appear on each page layout. Export as reusable templates.

### Layer 3 — Extraction Pipeline

Apply templates to all frames, crop each region, and use OpenAI Vision to read text (OCR). Download named files as a ZIP.

## Quick Start

```bash
git clone https://github.com/billpereira/progressive-context.git
cd progressive-context
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

## The Idea

Most problems don't need a product. They need a bridge — something quick, disposable, built to cross a specific gap once.

Progressive context means: instead of writing one perfect prompt, you build small scaffolding tools. Each tool solves one sub-problem and produces structured output for the next. The approach works because:

- It breaks hard problems into solvable steps
- Each layer gives the AI concrete constraints (not guesses)
- None of the code needs to scale or be maintained
- The result is better than any single prompt could produce

## License

MIT

---

*You don't optimize a desire. You build toward it.*
