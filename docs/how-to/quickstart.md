# Quickstart

## 1) Run host

```bash
cd host
npm install
npm run dev
```

Open: `http://localhost:3000`

## 2) Create and run your first external app

```bash
cd ..
npm run citadel-app -- create "My App" --port 4020
cd external-apps/my-app
npm install
npm start
```

## 3) Install app into Citadel

```bash
cd /home/rohanchaudhari/personal/citadel
npm run citadel-app -- install external-apps/my-app --url http://localhost:4020
```

Open: `http://localhost:3000/apps/my-app`
