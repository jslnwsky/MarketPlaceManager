const express = require('express');
const multer = require('multer');

// Use memory storage for quick pass-through to Grok
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = express.Router();

// Utilities
const XAI_BASE_URL = process.env.XAI_BASE_URL || 'https://api.x.ai';
const XAI_API_KEY = process.env.XAI_API_KEY;
const MODEL_TEXT = process.env.XAI_MODEL_TEXT || 'grok-4-latest';
const MODEL_VISION = process.env.XAI_MODEL_VISION || MODEL_TEXT;

function ensureKey(res) {
  if (!XAI_API_KEY) {
    res.status(500).json({ message: 'XAI_API_KEY not set in server/.env' });
    return false;
  }
  return true;
}

// POST /api/ai/identify - identify product details from an image
router.post('/identify', upload.single('image'), async (req, res) => {
  try {
    if (!ensureKey(res)) return;
    if (!req.file) return res.status(400).json({ message: 'image file is required (field name: image)' });

    // Convert image buffer to data URL for vision input
    const mime = req.file.mimetype || 'image/jpeg';
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    const system = 'You are a product identification assistant. Extract brand, model, product category, and key attributes visible or implied from the image. Return concise fields as JSON.';
    const userPrompt = 'Identify the product and return strictly valid JSON with keys: brand, model, title, category, attributes (object of key:value), and short_description (1-2 sentences). If uncertain, leave fields empty but provide a reasonable title.';

    const body = {
      model: MODEL_VISION,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'auto' } },
          ],
        },
      ],
    };

    const resp = await fetch(`${XAI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(502).json({ message: 'Grok vision request failed', details: errText });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    let parsed;
    try { parsed = JSON.parse(content); } catch (_e) { parsed = { raw: content }; }

    return res.json({
      model: MODEL_VISION,
      draft: parsed,
    });
  } catch (err) {
    console.error('identify error', err);
    return res.status(500).json({ message: 'Server error', error: String(err?.message || err) });
  }
});

// POST /api/ai/enrich - use Grok with tool-calling (auto) to browse and synthesize listing
router.post('/enrich', express.json(), async (req, res) => {
  try {
    if (!ensureKey(res)) return;
    const { brand, model, hints, max_tokens, detail_level } = req.body || {};
    if (!brand && !model && !hints) {
      return res.status(400).json({ message: 'Provide at least one of: brand, model, hints' });
    }

    const level = (detail_level || '').toString().toLowerCase();
    const isDetailed = level === 'detailed';
    const isConcise = level === 'concise';

    const system = 'You are an assistant that prepares accurate product listings for resale. When browsing is available, locate manufacturer or authoritative sources and cite them. Keep tone factual and seller-friendly.';
    const guidance = isDetailed
      ? `Write a thorough, multi-paragraph listing with sections. Use clear headings and bullet points where appropriate.
Sections to include:
- Overview (2-4 sentences)
- Key Specifications (5-12 bullets with values)
- Features (3-8 bullets)
- What’s Included (bullets)
- Use Cases or Compatibility (1-2 short bullets)
Keep it truthful based on sources.`
      : isConcise
      ? 'Write a short, 3-5 sentence listing plus 3-6 bullet specifications.'
      : 'Write a solid listing (1 short paragraph + 5-10 bullet specs).';

    const user = `Task: Create a listing description with key specs.
Inputs: brand=${brand || ''}, model=${model || ''}${hints ? `, hints=${hints}` : ''}.
Style: ${isDetailed ? 'detailed' : isConcise ? 'concise' : 'standard'}.
${guidance}
Requirements:
- Prefer manufacturer or authoritative sources; include sources[] with title and url.
- Output JSON with: title, description, attributes (object), sources (array of {title,url}).`;

    const body = {
      model: MODEL_TEXT,
      response_format: { type: 'json_object' },
      // Rely on Grok default tool_choice: 'auto' for browsing/search (no custom tools provided here)
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      // Enable Live Search so the model can browse the web and return better citations
      search_parameters: {
        mode: 'on',
        sources: [
          { type: 'web' },
        ],
        return_citations: true,
      },
      max_tokens: Math.min(4000, Number(max_tokens) || 1200),
      temperature: 0.3,
    };

    const resp = await fetch(`${XAI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(502).json({ message: 'Grok enrich request failed', details: errText });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    let result = {};
    // Try to parse JSON
    if (typeof content === 'string' && content.trim()) {
      try {
        result = JSON.parse(content);
      } catch (_e) {
        // Not JSON — fall back to using the text as description
        result = { description: content.trim() };
      }
    }
    // Ensure minimal shape
    if (!result.description && typeof content === 'string' && content.trim()) {
      result.description = content.trim();
    }
    if (!result.attributes) result.attributes = {};
    if (!Array.isArray(result.sources)) {
      // Try to surface citations if the API returned them in a known place
      const citations = data?.citations || data?.response?.citations;
      if (Array.isArray(citations)) {
        result.sources = citations.map((url) => ({ title: url, url }));
      } else {
        result.sources = [];
      }
    }

    const usage = data?.usage || data?.response?.usage || null;
    return res.json({ model: MODEL_TEXT, result, usage });
  } catch (err) {
    console.error('enrich error', err);
    return res.status(500).json({ message: 'Server error', error: String(err?.message || err) });
  }
});

// POST /api/ai/price - recommend a listing price using live search
router.post('/price', express.json(), async (req, res) => {
  try {
    if (!ensureKey(res)) return;
    const { title, condition } = req.body || {};
    const sys = 'You are a pricing assistant for second-hand marketplace listings. Be concise and accurate.';
    const usr = `Task: Recommend a fair market listing price.
Inputs: title=${title || ''}, condition=${condition || ''}.
Requirements:
- Use recent web data for comparable items. Prefer authoritative or high-signal sources.
- Currency: CAD. If sources use other currencies, convert to CAD approximately.
- Always return valid JSON with numeric fields (no null), even if uncertain. Estimate reasonably from available comps.
- Return JSON with: suggested_price (number), currency (e.g., CAD), low (number), high (number), rationale (short), sources (array of {title,url}).`;

    const body = {
      model: MODEL_TEXT,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: usr },
      ],
      search_parameters: {
        mode: 'on',
        sources: [ { type: 'web' } ],
        return_citations: true,
      },
      max_tokens: 900,
      temperature: 0.2,
    };

    const resp = await fetch(`${XAI_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(502).json({ message: 'Grok price request failed', details: errText });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '';
    let result = {};
    if (typeof content === 'string' && content.trim()) {
      try { result = JSON.parse(content); } catch (_e) { result = { rationale: content.trim() }; }
    }
    // Normalize fields
    if (!result.currency) result.currency = 'CAD';
    // Try alternate keys for suggested price
    if (result.suggested_price == null) {
      const alt = result.price ?? result.suggestedPrice ?? result.suggested_price;
      if (alt != null) result.suggested_price = alt;
    }
    // Coerce suggested_price to a number if possible
    if (typeof result.suggested_price === 'string') {
      const m = result.suggested_price.match(/\d+(?:[.,]\d+)?/);
      if (m) result.suggested_price = parseFloat(m[0].replace(',', '.'));
    }
    // If still missing, try to extract range or singles from rationale or raw content
    if (result.suggested_price == null) {
      const txt = typeof result.rationale === 'string' && result.rationale.trim() ? result.rationale : (typeof content === 'string' ? content : '');
      // Match ranges like 30-60, $30–$60, CA$30 to CA$60, 1k-1.2k
      const rangeRe = /(?:CA\$|C\$|\$)?\s*(\d+(?:[.,]\d+)?(?:\s*[kKmM])?)\s*(?:-|–|to|—)\s*(?:CA\$|C\$|\$)?\s*(\d+(?:[.,]\d+)?(?:\s*[kKmM])?)/i;
      const rm = txt.match(rangeRe);
      if (rm) {
        const toNumber = (s) => {
          const t = s.replace(/[,\s]/g, '').toLowerCase();
          const mult = t.endsWith('k') ? 1000 : t.endsWith('m') ? 1000000 : 1;
          const core = t.replace(/[km]$/, '');
          const n = parseFloat(core);
          return isNaN(n) ? NaN : n * mult;
        };
        const low = toNumber(rm[1]);
        const high = toNumber(rm[2]);
        if (!isNaN(low) && !isNaN(high)) {
          result.low = result.low ?? low;
          result.high = result.high ?? high;
          result.suggested_price = Math.round(((low + high) / 2) * 100) / 100;
        }
      }
      // If still missing, pick the most central number among all numbers found
      if (result.suggested_price == null) {
        const nums = Array.from(txt.matchAll(/(\d+(?:[.,]\d+)?(?:\s*[kKmM])?)/g))
          .map(m => {
            const raw = m[1];
            const t = raw.replace(/[,\s]/g, '').toLowerCase();
            const mult = t.endsWith('k') ? 1000 : t.endsWith('m') ? 1000000 : 1;
            const core = t.replace(/[km]$/, '');
            const n = parseFloat(core);
            return isNaN(n) ? NaN : n * mult;
          })
          .filter(n => !isNaN(n));
        if (nums.length >= 1) {
          // Heuristic: if we have 3+ numbers, use median; if 2, average; if 1, use it
          const sorted = nums.slice().sort((a,b)=>a-b);
          let val;
          if (sorted.length === 1) val = sorted[0];
          else if (sorted.length === 2) val = (sorted[0] + sorted[1]) / 2;
          else val = sorted[Math.floor(sorted.length/2)];
          result.suggested_price = Math.round(val * 100) / 100;
        }
      }
    }
    // Coerce low/high if strings
    if (typeof result.low === 'string') {
      const m = result.low.match(/\d+(?:[.,]\d+)?/);
      if (m) result.low = parseFloat(m[0].replace(',', '.'));
    }
    if (typeof result.high === 'string') {
      const m = result.high.match(/\d+(?:[.,]\d+)?/);
      if (m) result.high = parseFloat(m[0].replace(',', '.'));
    }
    if (!Array.isArray(result.sources)) {
      const citations = data?.citations || data?.response?.citations;
      result.sources = Array.isArray(citations) ? citations.map((url) => ({ title: url, url })) : [];
    }

    return res.json({ model: MODEL_TEXT, result });
  } catch (err) {
    console.error('price error', err);
    return res.status(500).json({ message: 'Server error', error: String(err?.message || err) });
  }
});

module.exports = router;
