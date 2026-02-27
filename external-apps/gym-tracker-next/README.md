# Gym Tracker (External Next.js)

Standalone extraction of Gym Tracker with copied UI/API and local DB.

## Run

```bash
cd external-apps/gym-tracker-next
npm install
./scripts/copy-db.sh
npm run build
npm run start
```

## Register in Citadel

```bash
./scripts/register-external-gym.sh
```

Open:
- http://localhost:3000/apps/gym-tracker-external
