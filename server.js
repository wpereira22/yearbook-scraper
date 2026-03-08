require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies up to 50MB (base64 images can be large)
app.use(express.json({ limit: '50mb' }));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/ocr
// Accepts: { image: "data:image/png;base64,...", prompt: "Read the name text in this image" }
// Returns: { text: "..." }
app.post('/api/ocr', async (req, res) => {
  const { image, prompt } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'Missing required field: image' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  const userPrompt = prompt || 'Read any text visible in this image.';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`OpenAI API error (${response.status}):`, errorBody);
      return res.status(response.status).json({
        error: `OpenAI API returned ${response.status}`,
        details: errorBody,
      });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';

    return res.json({ text });
  } catch (err) {
    console.error('OCR request failed:', err);
    return res.status(500).json({ error: 'OCR request failed', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Yearbook Scraper running at http://localhost:${PORT}`);
});
