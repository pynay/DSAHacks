# FoodBank Inventory

A food-bank inventory management frontend (DSA Hacks). Next.js + TypeScript +
Tailwind, with in-memory mock data.

## Screens
- **Dashboard** — KPIs, inventory-by-category and intake-vs-outflow charts, stock status, recent activity.
- **Inventory** — searchable/filterable table with status pills and inline quantity adjust; add items.
- **Donations** — log incoming donations; matching inventory increases automatically.
- **Distributions** — record outgoing food; inventory decreases automatically.

## Data
All state is in-memory via `src/context/InventoryProvider.tsx`, seeded from
`src/data/mock.ts`. **State resets on page refresh.** Swapping in a real API only
touches the provider. Item status (OK / Low / Expiring / Out) is derived, never stored.

## Develop
```bash
npm install
npm run dev      # http://localhost:3000
npm test         # unit tests for domain + dashboard logic
npm run build    # production build / type-check
```
