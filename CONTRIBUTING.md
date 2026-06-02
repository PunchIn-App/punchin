# Contributing to PunchIn Time Tracker

Thanks for your interest in contributing!

## Contributor License Agreement

Before your pull request can be merged, you must agree to the
[Contributor License Agreement](CLA.md). To sign, include the following
statement in your pull request description or as a comment:

> I have read and agree to the PunchIn Time Tracker Contributor License Agreement.

## Running Locally

```bash
git clone https://github.com/PunchIn-App/punchin.git
cd punchin
npm install
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the production build locally
```

## Workflow

1. Fork the repo and create a branch (`git checkout -b feature/your-idea`)
2. Make your changes — see `CLAUDE.md` for architecture conventions and the "What NOT to do" list
3. Test manually in a browser at mobile width (375 px) and at desktop width
4. Open a pull request with a clear description of the change and your CLA sign-off

## Key Conventions

- **No router** — navigation is tab-based state in `App.jsx`; this is intentional for PWA standalone mode
- **No backend** — keep all data local; do not introduce cloud sync or authentication
- **Date math** — always use helpers from `src/utils/time.js`; never inline raw `Date` arithmetic
- **Schema changes** — bump the Dexie version number and add an upgrade block in `db.js`
- **Bundle size** — check impact before adding a new dependency; the bundle is intentionally small
