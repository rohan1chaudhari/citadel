# French Translator (External)

Standalone extraction of French Translator as an independent service.

## Run locally

```bash
cd external-apps/french-translator-standalone
npm install
npm start
```

Runs on `http://localhost:4011`.

## Run via Docker Compose

```bash
docker compose -f docker-compose.external.yml up -d --build
```

## Register in Citadel Gateway

```bash
./scripts/register-external-french.sh
```

Then open:
- `http://localhost:3000/apps/french-translator-external`
