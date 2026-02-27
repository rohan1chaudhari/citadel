# French Translator (External Next.js)

Standalone Next.js extraction of French Translator.

## Run

```bash
cd external-apps/french-translator-next
npm install
npm run dev
```

Runs on `http://localhost:4013`.

## Copy existing DB (safe)

```bash
./scripts/copy-db.sh
```

If there is an existing DB at `data/apps/french-translator/db.sqlite`, it will be copied.

## Register in Citadel

```bash
./scripts/register-external-french.sh
```

Then open:
- `http://localhost:3000/apps/french-translator-external`
