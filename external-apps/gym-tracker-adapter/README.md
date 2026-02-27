# Gym Tracker (External Adapter)

This is a **no-rewrite adapter** to run Gym Tracker as an external app first.

It forwards Gym Tracker APIs and serves the existing Gym Tracker UI from Citadel host.

## Run

```bash
cd external-apps/gym-tracker-adapter
npm install
npm start
```

## Register in Citadel

```bash
./scripts/register-external-gym.sh
```

Open:
- `http://localhost:3000/apps/gym-tracker-external`
