import express from 'express';

const app = express();
const port = Number(process.env.PORT || 4012);
const citadelHost = process.env.CITADEL_HOST || 'http://localhost:3000';

app.use(express.json({ limit: '2mb' }));

app.get('/healthz', async (_req, res) => {
  try {
    const upstream = await fetch(`${citadelHost}/api/apps/gym-tracker/health`);
    res.status(upstream.ok ? 200 : 502).json({ ok: upstream.ok, app: 'gym-tracker-external', upstream: `${citadelHost}/api/apps/gym-tracker/health` });
  } catch (e) {
    res.status(502).json({ ok: false, app: 'gym-tracker-external', error: String(e?.message || e) });
  }
});

async function pass(req, res, targetUrl) {
  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'content-type': req.headers['content-type'] || undefined,
        'accept': req.headers['accept'] || '*/*',
      },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body),
    });
    const contentType = upstream.headers.get('content-type') || 'application/json';
    const text = await upstream.text();
    res.status(upstream.status).set('content-type', contentType).send(text);
  } catch (e) {
    res.status(502).json({ ok: false, error: 'upstream unavailable', details: String(e?.message || e) });
  }
}

// Forward gym tracker app APIs without rewriting logic.
app.all('/api/apps/gym-tracker/*', async (req, res) => {
  const suffix = req.originalUrl.replace(/^\/api\/apps\/gym-tracker/, '');
  return pass(req, res, `${citadelHost}/api/apps/gym-tracker${suffix}`);
});

// Serve the existing gym tracker UI from host as-is (no rewrite).
app.get('/', async (_req, res) => {
  try {
    const upstream = await fetch(`${citadelHost}/apps/gym-tracker`);
    const html = await upstream.text();
    res.status(upstream.status).set('content-type', 'text/html; charset=utf-8').send(html);
  } catch (e) {
    res.status(502).send(`<h1>Gym Tracker adapter error</h1><pre>${String(e?.message || e)}</pre>`);
  }
});

app.listen(port, () => {
  console.log(`gym-tracker-external adapter listening on :${port}`);
});
