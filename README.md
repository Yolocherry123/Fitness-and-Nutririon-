# Forge — Personal Fitness App

Mobile-first personal muscle-gain companion built from the v1.2 specification set.

## Spec sources

1. Master specification — profile, nutrition, recipes, recovery, milestones
2. Workout program specification — split, exercises, RIR, progression
3. Technical specification — architecture, models, acceptance tests
4. README first — how to interpret CORE / SCHEDULED / OPTIONAL / CONFIRMED / RECONSTRUCTION

## Live app

**Phone / any browser:** https://yolocherry123.github.io/Fitness-and-Nutririon-/

All logging works in the browser (IndexedDB on that device). Use **Download / share my data** to back up.

### Install as an app (PWA)

After the latest deploy, Forge can install as a **standalone app** (not just a browser shortcut):

- **Android (Chrome):** open the site → menu (⋮) → **Install app** or **Add to Home screen**
- **iPhone (Safari):** Share → **Add to Home Screen** → Open from the Forge icon

You need a recent deploy with the web manifest + service worker. If you only see “shortcut”, hard-refresh the page or wait for GitHub Pages to finish updating.

Deploy: every push to `master` rebuilds GitHub Pages via Actions.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL (default `http://localhost:5173`) on a phone-sized viewport or your phone on the same network.

## Stack

- Vite + React + TypeScript
- Dexie (IndexedDB) offline-first storage
- React Router
- Recharts (bodyweight trend)

## Phase status

**Phase 1 (MVP)** — onboarding, Today, Plan, Food week, Workout logging, bodyweight, Progress, Weekly Review, Recipes, Settings, JSON export/import

**Phase 2** — double-progression suggestions, calorie adjustment engine, completion scoring (CORE vs OPTIONAL), missed-workout handling

**Phase 3** — further polish (notifications wiring, richer plan-version UI)

## Product rules preserved

- Optional items never punish core completion
- Milk powder is a supported milk substitute
- Bone-in chicken distinct from edible meat logging notes
- Upper A / Lower A = Confirmed; Upper B / Lower B / Saturday detail = Historical Reconstruction
- Missed creatine → resume normal dose (never double)
- Calorie changes require sufficient trend + adherence data
