# Food Bank Inventory — Frontend Design

**Date:** 2026-08-20
**Repo:** github.com/pynay/DSAHacks (DSA Hackathon, currently empty)
**Local path:** ~/Desktop/PROJECTS/DSAHacks

## Purpose

A frontend for food bank inventory management that reads like a real
food-management SaaS. This draft is UI-first with realistic mock data so it can
be demoed immediately. No backend; all data access flows through a single
in-memory provider so a real API can replace it later without touching screens.

## Stack

- **Next.js (App Router) + TypeScript**
- **Tailwind CSS** for styling
- **Recharts** for charts
- **lucide-react** for icons

No other runtime dependencies.

## Visual design

Clean light SaaS layout with a warm **pale yellow** theme (friendlier than
corporate green, fitting for a food bank).

Palette:
- Canvas background: pale yellow `#FEFCE8`
- Cards: white `#FFFFFF`, soft shadow, subtle warm border (`#FEF3C7` / stone-200)
- Primary accent (buttons, active nav, key figures): golden amber `#CA8A04`
  (hover/darker `#A16207`); a brighter `#D97706` for emphasis
- Soft highlight / chips: buttery `#FDE68A`
- Text: warm near-black `#1C1917`; secondary stone-gray `#78716C`
- Font: Inter

**Status pills keep semantic colors** (must stay legible on the warm theme):
- OK = green, Low = amber, Expiring = orange, Out = red

## Layout

Persistent left sidebar + top bar, main content area on a pale-yellow canvas.

```
┌──────────┬─────────────────────────────────────────┐
│  🥫 Logo │  Page title            [🔍 search] [date] │  ← topbar
│          ├─────────────────────────────────────────┤
│ Dashboard│                                          │
│ Inventory│         main content area                │
│ Donations│   (stat cards / tables / charts)         │
│ Distrib. │                                          │
│ (footer) │                                          │
└──────────┴─────────────────────────────────────────┘
```

- **Sidebar:** logo, 4 nav items with icons, active-state highlight (amber).
- **Topbar:** current page title, global search input, today's date.

## Screens

### 1. Dashboard (`/dashboard`, also app home `/` redirects here)
- Stat cards row: Total stock (sum of quantities), Distinct SKUs, Low-stock
  alerts, Expiring soon (≤14 days), Donations this week, Distributions this week.
- Charts:
  - Inventory by category (bar or donut).
  - Intake vs. outflow trend over recent weeks (line/area).
- Stock-status breakdown (OK / Low / Expiring / Out counts).
- Recent activity feed: donations and distributions merged, newest first.

### 2. Inventory (`/inventory`)
- Searchable, filterable table. Columns: item, category, quantity + unit,
  expiration date, location, status pill.
- Filters: by category, by status; free-text search on name.
- "Add item" opens a form modal.
- Inline quick quantity adjust (+/-) on a row.

### 3. Donations (`/donations`)
- Recent-intake list (donor, type, item count, date).
- "Log donation" modal: donor name, donor type
  (individual / grocery / corporate / food-drive), one or more items
  (name, category, quantity, unit), date, notes.
- **Logging a donation increases** matching inventory quantities (match by
  name+category; create a new item if no match).

### 4. Distributions (`/distributions`)
- Outflow list (recipient/partner, type, item count, households served, date).
- "Record distribution" modal: recipient/partner, type
  (household / partner agency / mobile pantry), items (name, quantity, unit),
  households served, date, notes.
- **Recording a distribution decreases** matching inventory quantities
  (not below zero).

## Data model

```ts
type Category =
  | 'Canned' | 'Produce' | 'Dairy' | 'Grains'
  | 'Frozen' | 'Protein' | 'Beverages' | 'Household';

type InventoryItem = {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: string;            // e.g. 'cans', 'lbs', 'boxes'
  expirationDate: string;  // ISO date
  location: string;        // e.g. 'Aisle B', 'Freezer 1'
  reorderThreshold: number;
  lastUpdated: string;     // ISO date
};

type DonationItem = { name: string; category: Category; quantity: number; unit: string };
type Donation = {
  id: string;
  date: string;
  donorName: string;
  donorType: 'individual' | 'grocery' | 'corporate' | 'food-drive';
  items: DonationItem[];
  notes?: string;
};

type DistributionItem = { name: string; quantity: number; unit: string };
type Distribution = {
  id: string;
  date: string;
  recipient: string;
  type: 'household' | 'partner-agency' | 'mobile-pantry';
  items: DistributionItem[];
  householdsServed?: number;
  notes?: string;
};
```

**Derived status** (never stored):
1. `Out` if quantity === 0
2. else `Low` if quantity ≤ reorderThreshold
3. else `Expiring` if expirationDate within 14 days of today
4. else `OK`

Mock seed: ~20–30 items spread across categories, plus a handful of seed
donations and distributions so the dashboard and feeds are populated on first load.

## State management

A single `InventoryProvider` (React Context) holds `inventory`, `donations`,
and `distributions` in memory, seeded from mock JSON. All screens read/write
through this provider.

- `logDonation()` appends a donation and increases inventory.
- `recordDistribution()` appends a distribution and decreases inventory.
- `addItem()` / `adjustQuantity()` for the inventory screen.

State resets on page refresh (acceptable for a draft/demo). Because every screen
goes through the provider, swapping in a real API later is isolated to the provider.

## Components

- `Sidebar`, `Topbar`, `AppShell` (layout)
- `StatCard`
- `StatusPill`
- `InventoryTable` + filter controls
- `Modal`, `FormField` (shared form primitives)
- `ActivityFeed`
- Charts: `CategoryChart`, `TrendChart` (Recharts)

## Non-goals (YAGNI for this draft)

- No auth / users / roles.
- No persistence/backend (in-memory only).
- No barcode/lot tracking, no Recipients/Partners CRUD screen (donation/
  distribution records capture recipient inline).
- No CSV import/export.

## Git / delivery

- Scaffold at `~/Desktop/PROJECTS/DSAHacks`, commit locally (authored as Dat,
  no Claude attribution).
- Remote wired to `github.com/pynay/DSAHacks` but **do not push without
  explicit confirmation** — it is a shared team repo.

## Success criteria

- `npm run dev` serves a clickable app.
- All four screens render with realistic mock data.
- Logging a donation and recording a distribution visibly change inventory
  quantities and the dashboard stats.
- Status pills, filters, and search work.
- Consistent pale-yellow theme throughout.
