# Apps Directory (Transition Plan)

This directory is being transitioned from in-repo apps to **standalone app repositories**.

> Goal (P3-14): keep this repo focused on the platform (`host`, `core`, CLI, templates, docs), while apps are installed from external repos.

## Data Safety Rule (MANDATORY)

Before extracting or uninstalling any app:

1. Export app data:
   - `GET /api/apps/<appId>/export`
   - or use the host UI export button
2. Verify backup archive can be opened.
3. Keep one offline copy outside this machine.
4. Only then proceed with route/app extraction.

Never delete `data/apps/<appId>/` without a verified backup.

## Official Apps (target standalone repos)

> Repo URLs can be filled as they are created.

| App ID | Target Repo | Install Command |
|---|---|---|
| smart-notes | `https://github.com/rohan1chaudhari/citadel-smart-notes` | `node scripts/citadel-app.mjs install https://github.com/rohan1chaudhari/citadel-smart-notes` |
| gym-tracker | `https://github.com/rohan1chaudhari/citadel-gym-tracker` | `node scripts/citadel-app.mjs install https://github.com/rohan1chaudhari/citadel-gym-tracker` |
| scrum-board | `https://github.com/rohan1chaudhari/citadel-scrum-board` | `node scripts/citadel-app.mjs install https://github.com/rohan1chaudhari/citadel-scrum-board` |
| friend-tracker | `https://github.com/rohan1chaudhari/citadel-friend-tracker` | `node scripts/citadel-app.mjs install https://github.com/rohan1chaudhari/citadel-friend-tracker` |
| french-translator | `https://github.com/rohan1chaudhari/citadel-french-translator` | `node scripts/citadel-app.mjs install https://github.com/rohan1chaudhari/citadel-french-translator` |
| soumil-mood-tracker | `https://github.com/rohan1chaudhari/citadel-soumil-mood-tracker` | `node scripts/citadel-app.mjs install https://github.com/rohan1chaudhari/citadel-soumil-mood-tracker` |
| promo-kit | `https://github.com/rohan1chaudhari/citadel-promo-kit` | `node scripts/citadel-app.mjs install https://github.com/rohan1chaudhari/citadel-promo-kit` |
| task-manager | `https://github.com/rohan1chaudhari/citadel-task-manager` | `node scripts/citadel-app.mjs install https://github.com/rohan1chaudhari/citadel-task-manager` |

Detailed execution plan: `docs/how-to/app-extraction-cutover-plan.md`

## Extraction Checklist (per app)

- [ ] Repo created and initialized
- [ ] App files moved (`app.yaml`, `migrations/`, UI/API routes, README)
- [ ] Data export/restore path tested
- [ ] `citadel-app install <repo-url>` tested
- [ ] `citadel-app uninstall <appId>` tested (without data deletion)
- [ ] Hot-reload verified in dev mode
- [ ] Build passes
- [ ] Health endpoint OK after restart
