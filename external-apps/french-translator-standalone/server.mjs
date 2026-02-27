import express from 'express';

const app = express();
const port = Number(process.env.PORT || 4011);

app.use(express.json({ limit: '1mb' }));

const translationCache = new Map();
const CACHE_SIZE_LIMIT = 1000;

async function translateWithLibreTranslate(text) {
  const cacheKey = text.toLowerCase().trim();
  if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);

  const instances = [
    'https://libretranslate.de',
    'https://libretranslate.pussthecat.org',
    'https://libretranslate.eownerdead.dedyn.io',
  ];

  for (const baseUrl of instances) {
    try {
      const res = await fetch(`${baseUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: 'fr', target: 'en', format: 'text' }),
        signal: AbortSignal.timeout(2500),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.translatedText) continue;
      if (translationCache.size >= CACHE_SIZE_LIMIT) {
        const firstKey = translationCache.keys().next().value;
        if (firstKey) translationCache.delete(firstKey);
      }
      translationCache.set(cacheKey, data.translatedText);
      return data.translatedText;
    } catch {
      // try next instance
    }
  }
  return null;
}

function getFallbackTranslation(text) {
  const dictionary = {
    bonjour: 'hello',
    bonsoir: 'good evening',
    salut: 'hi',
    merci: 'thank you',
    oui: 'yes',
    non: 'no',
    "au revoir": 'goodbye',
    "s'il vous plaît": 'please',
    "je ne comprends pas": 'I do not understand',
  };

  const lower = text.toLowerCase().trim();
  if (dictionary[lower]) return dictionary[lower];
  for (const [fr, en] of Object.entries(dictionary)) {
    if (lower.includes(fr)) return lower.replace(fr, en);
  }
  return `[Translation pending] ${text}`;
}

app.get('/healthz', (_req, res) => {
  res.json({ ok: true, app: 'french-translator-external', ts: new Date().toISOString() });
});

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>French Translator (External)</title>
<style>body{font-family:system-ui;padding:24px;max-width:760px;margin:auto}textarea,input{width:100%;padding:10px}button{padding:10px 14px}.row{display:grid;gap:8px}.out{margin-top:10px;padding:10px;background:#f7f7f7;border-radius:8px}</style>
</head><body>
<h1>French Translator (External)</h1>
<p>Standalone containerized app mounted into Citadel via gateway proxy.</p>
<div class="row">
  <textarea id="in" rows="4" placeholder="Type French text..."></textarea>
  <button onclick="go()">Translate</button>
  <div class="out" id="out"></div>
</div>
<script>
async function go(){
  const text=document.getElementById('in').value.trim();
  const res=await fetch('/translate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});
  const data=await res.json();
  document.getElementById('out').textContent=data.translation||data.error||'Failed';
}
</script>
</body></html>`);
});

app.post('/translate', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'text required' });

  let translation = await translateWithLibreTranslate(text);
  if (!translation) translation = getFallbackTranslation(text);

  res.json({ ok: true, source: 'fr', target: 'en', text, translation });
});

app.listen(port, () => {
  console.log(`french-translator-external listening on :${port}`);
});
