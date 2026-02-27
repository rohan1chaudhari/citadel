import express from 'express';

const app = express();
const port = Number(process.env.PORT || 4013);
const citadelHost = process.env.CITADEL_HOST || 'http://localhost:3000';

app.use(express.json({ limit: '5mb' }));

async function pass(req, res, targetUrl, useRawBody = false) {
  try {
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = useRawBody ? req.body : JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || undefined,
        'accept': req.headers['accept'] || '*/*',
      },
      body,
    });

    const contentType = upstream.headers.get('content-type') || 'application/json';
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(upstream.status).set('content-type', contentType).send(buf);
  } catch (e) {
    res.status(502).json({ ok: false, error: 'upstream unavailable', details: String(e?.message || e) });
  }
}

app.get('/healthz', async (_req, res) => {
  try {
    const upstream = await fetch(`${citadelHost}/api/apps/french-translator/health`);
    res.status(upstream.ok ? 200 : 502).json({ ok: upstream.ok, app: 'french-translator-external', upstream: `${citadelHost}/api/apps/french-translator/health` });
  } catch (e) {
    res.status(502).json({ ok: false, app: 'french-translator-external', error: String(e?.message || e) });
  }
});

// Forward JSON APIs
app.all('/api/apps/french-translator/translate', async (req, res) => {
  await pass(req, res, `${citadelHost}/api/apps/french-translator/translate`);
});

// Forward multipart transcription route (raw stream passthrough)
app.post('/api/apps/french-translator/transcribe', express.raw({ type: '*/*', limit: '20mb' }), async (req, res) => {
  await pass(req, res, `${citadelHost}/api/apps/french-translator/transcribe`, true);
});

// Serve original UI page as-is
app.get('/', async (_req, res) => {
  try {
    const upstream = await fetch(`${citadelHost}/apps/french-translator`);
    const html = await upstream.text();
    res.status(upstream.status).set('content-type', 'text/html; charset=utf-8').send(html);
  } catch (e) {
    res.status(502).send(`<h1>French Translator adapter error</h1><pre>${String(e?.message || e)}</pre>`);
  }
});

app.listen(port, () => {
  console.log(`french-translator-external adapter listening on :${port}`);
});
