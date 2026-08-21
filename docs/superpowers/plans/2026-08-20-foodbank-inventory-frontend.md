# Food Bank Inventory Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clickable food-bank inventory management frontend (Dashboard, Inventory, Donations, Distributions) with realistic in-memory mock data and a warm pale-yellow theme.

**Architecture:** Next.js App Router app. All domain logic lives in pure, unit-tested functions in `src/lib`. A single client-side `InventoryProvider` (React Context) holds `inventory`, `donations`, and `distributions` in memory (seeded from mock data) and is the only place screens read/write state, so a real API can replace it later without touching screens. Screens are client components composed from shared primitives.

**Tech Stack:** Next.js (App Router) + TypeScript, Tailwind CSS, Recharts (charts), lucide-react (icons), Vitest (logic tests).

## Global Constraints

- Framework: **Next.js App Router + TypeScript + Tailwind**. Source lives under `src/`, import alias `@/*` → `./src/*`.
- **No backend.** All state is in-memory via `InventoryProvider`; it resets on refresh. Every screen accesses data only through the `useInventory()` hook.
- **Palette = built-in Tailwind colors only** (no custom theme config), mapping to the spec:
  - Canvas `bg-yellow-50` (`#FEFCE8`) · Cards `bg-white` + `border-stone-200` + `shadow-sm`
  - Primary `bg-yellow-600 hover:bg-yellow-700 text-white` (`#CA8A04`/`#A16207`) · active nav `bg-yellow-100 text-yellow-800`
  - Soft highlight `bg-amber-200` (`#FDE68A`) · Text `text-stone-900` (`#1C1917`), secondary `text-stone-500`
  - Status pills (semantic, keep legible): OK `emerald`, Low `amber`, Expiring `orange`, Out `red` (all `-100` bg / `-800` text)
- Font: **Inter** via `next/font/google`.
- **Status is derived, never stored**, in this exact order: `Out` if qty ≤ 0 → else `Low` if qty ≤ reorderThreshold → else `Expiring` if expiration within 14 days → else `OK`.
- Git: commit locally, authored as **Dat Nguyen <datq.nguyen06@gmail.com>**, **no Claude / Co-Authored-By attribution**. Remote is the shared repo `github.com/pynay/DSAHacks` — **do not push without explicit user confirmation.**
- Commit command template (use for every commit step):
  ```bash
  git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "<message>"
  ```

## File Structure

```
src/
  app/
    layout.tsx              root layout: Inter font, wraps children in <Providers>
    page.tsx                redirect('/dashboard')
    globals.css             scaffolded (Tailwind); minimal edits
    dashboard/page.tsx      Dashboard screen
    inventory/page.tsx      Inventory screen
    donations/page.tsx      Donations screen
    distributions/page.tsx  Distributions screen
  components/
    Providers.tsx           client wrapper: InventoryProvider + AppShell
    AppShell.tsx            sidebar + topbar + <main> canvas
    Sidebar.tsx             logo + nav
    Topbar.tsx              page title + date
    StatCard.tsx            dashboard KPI card
    StatusPill.tsx          status badge
    Modal.tsx               shared modal shell
    FormField.tsx           labeled input/select wrapper
    InventoryTable.tsx      filterable inventory table
    ActivityFeed.tsx        merged recent activity list
    charts/CategoryChart.tsx  Recharts bar chart
    charts/TrendChart.tsx     Recharts area chart
  context/
    InventoryProvider.tsx   React Context: state + actions
  lib/
    types.ts                domain types
    inventory.ts            deriveStatus, applyDonation, applyDistribution, aggregates
    inventory.test.ts       unit tests
    dashboard.ts            statusCounts, categoryTotals, recentActivity, flowByWeek
    dashboard.test.ts       unit tests
  data/
    mock.ts                 seedInventory, seedDonations, seedDistributions
README.md
vitest.config.ts
```

---

### Task 1: Scaffold project + app shell

**Files:**
- Create (via generator): whole Next.js app under `~/Desktop/PROJECTS/DSAHacks`
- Create: `src/components/Providers.tsx`, `src/components/AppShell.tsx`, `src/components/Sidebar.tsx`, `src/components/Topbar.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/app/dashboard/page.tsx`, `src/app/inventory/page.tsx`, `src/app/donations/page.tsx`, `src/app/distributions/page.tsx`

**Interfaces:**
- Produces: `<Providers>{children}</Providers>` (default export, client), `<AppShell>` renders sidebar/topbar/`<main>`. Four route stubs so nav works.

- [ ] **Step 1: Verify toolchain**

Run: `node -v && npm -v`
Expected: Node ≥ 18 prints (e.g. `v20.x`).

- [ ] **Step 2: Scaffold Next.js into a temp dir, then merge into the repo** (our repo already has `.git` + `docs/`, so generate elsewhere and copy in)

```bash
cd ~/Desktop/PROJECTS
npx --yes create-next-app@latest dsahacks-scaffold \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --yes
rsync -a --exclude '.git' dsahacks-scaffold/ DSAHacks/
rm -rf dsahacks-scaffold
cd DSAHacks
npm install recharts lucide-react
npm install -D vitest
```

- [ ] **Step 3: Add the `test` script to `package.json`**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 4: Create `vitest.config.ts`** (node env; only pick up `*.test.ts`)

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FoodBank Inventory',
  description: 'Food bank inventory management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Replace `src/app/page.tsx`** (home → dashboard)

```tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/dashboard');
}
```

- [ ] **Step 7: Create `src/components/Providers.tsx`** (client wrapper; `InventoryProvider` is added in Task 4)

```tsx
'use client';

import AppShell from './AppShell';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 8: Create `src/components/Sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, HandHeart, Truck } from 'lucide-react';

export const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/donations', label: 'Donations', icon: HandHeart },
  { href: '/distributions', label: 'Distributions', icon: Truck },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-stone-200 bg-white flex flex-col">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-stone-200">
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-yellow-600 text-white font-bold">
          FB
        </span>
        <span className="font-semibold text-stone-900">FoodBank</span>
      </div>
      <nav className="p-3 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto p-4 text-xs text-stone-400">DSA Hacks · demo data</div>
    </aside>
  );
}
```

- [ ] **Step 9: Create `src/components/Topbar.tsx`** (page title from route + today's date)

```tsx
'use client';

import { usePathname } from 'next/navigation';
import { NAV } from './Sidebar';

export default function Topbar() {
  const pathname = usePathname();
  const current = NAV.find((n) => pathname.startsWith(n.href));
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return (
    <header className="h-16 border-b border-stone-200 bg-white flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-stone-900">{current?.label ?? 'FoodBank'}</h1>
      <span className="text-sm text-stone-500">{today}</span>
    </header>
  );
}
```

- [ ] **Step 10: Create `src/components/AppShell.tsx`**

```tsx
'use client';

import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-yellow-50 text-stone-900">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Create the four route stubs** (fleshed out in Tasks 6–9)

`src/app/dashboard/page.tsx`, `src/app/inventory/page.tsx`, `src/app/donations/page.tsx`, `src/app/distributions/page.tsx` — each identical for now:
```tsx
export default function Page() {
  return <div className="text-stone-500">Coming soon.</div>;
}
```

- [ ] **Step 12: Verify build succeeds**

Run: `npm run build`
Expected: Compiles with no type errors; routes `/dashboard`, `/inventory`, `/donations`, `/distributions` listed.

- [ ] **Step 13: Smoke-test the shell**

Run: `npm run dev` then open `http://localhost:3000`.
Expected: Redirects to `/dashboard`; pale-yellow canvas, white sidebar with 4 nav items, active item highlighted amber, topbar shows title + date, clicking nav switches the highlighted item. Stop the server (Ctrl-C).

- [ ] **Step 14: Add a `.gitignore` guard and commit**

Confirm `.gitignore` (created by create-next-app) contains `node_modules` and `.next`. Then:
```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Scaffold Next.js app shell with sidebar and topbar"
```

---

### Task 2: Domain types, mock data, and inventory logic (TDD)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/inventory.ts`, `src/data/mock.ts`
- Test: `src/lib/inventory.test.ts`

**Interfaces:**
- Produces (types): `Category`, `Status`, `InventoryItem`, `DonationItem`, `Donation`, `DistributionItem`, `Distribution`.
- Produces (functions):
  - `deriveStatus(item: InventoryItem, now?: Date): Status`
  - `applyDonation(inv: InventoryItem[], d: Donation, opts?: { now?: Date; makeId?: () => string }): InventoryItem[]`
  - `applyDistribution(inv: InventoryItem[], d: Distribution, opts?: { now?: Date }): InventoryItem[]`
  - `totalStock(inv: InventoryItem[]): number`
  - `newId(): string`
- Produces (mock): `seedInventory: InventoryItem[]`, `seedDonations: Donation[]`, `seedDistributions: Distribution[]`.

- [ ] **Step 1: Create `src/lib/types.ts`**

```ts
export type Category =
  | 'Canned'
  | 'Produce'
  | 'Dairy'
  | 'Grains'
  | 'Frozen'
  | 'Protein'
  | 'Beverages'
  | 'Household';

export type Status = 'OK' | 'Low' | 'Expiring' | 'Out';

export interface InventoryItem {
  id: string;
  name: string;
  category: Category;
  quantity: number;
  unit: string;
  expirationDate: string; // ISO 'YYYY-MM-DD'
  location: string;
  reorderThreshold: number;
  lastUpdated: string; // ISO 'YYYY-MM-DD'
}

export interface DonationItem {
  name: string;
  category: Category;
  quantity: number;
  unit: string;
}

export interface Donation {
  id: string;
  date: string; // ISO 'YYYY-MM-DD'
  donorName: string;
  donorType: 'individual' | 'grocery' | 'corporate' | 'food-drive';
  items: DonationItem[];
  notes?: string;
}

export interface DistributionItem {
  name: string;
  quantity: number;
  unit: string;
}

export interface Distribution {
  id: string;
  date: string; // ISO 'YYYY-MM-DD'
  recipient: string;
  type: 'household' | 'partner-agency' | 'mobile-pantry';
  items: DistributionItem[];
  householdsServed?: number;
  notes?: string;
}
```

- [ ] **Step 2: Write the failing test `src/lib/inventory.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { InventoryItem, Donation, Distribution } from './types';
import {
  deriveStatus,
  applyDonation,
  applyDistribution,
  totalStock,
} from './inventory';

const NOW = new Date('2026-08-20T12:00:00Z');

function item(over: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: '1',
    name: 'Canned Beans',
    category: 'Canned',
    quantity: 100,
    unit: 'cans',
    expirationDate: '2027-01-01',
    location: 'Aisle B',
    reorderThreshold: 20,
    lastUpdated: '2026-08-01',
    ...over,
  };
}

describe('deriveStatus', () => {
  it('returns Out when quantity is 0', () => {
    expect(deriveStatus(item({ quantity: 0 }), NOW)).toBe('Out');
  });
  it('returns Low when at or below reorder threshold', () => {
    expect(deriveStatus(item({ quantity: 20, reorderThreshold: 20 }), NOW)).toBe('Low');
  });
  it('returns Expiring when within 14 days', () => {
    expect(deriveStatus(item({ expirationDate: '2026-08-28' }), NOW)).toBe('Expiring');
  });
  it('returns OK otherwise', () => {
    expect(deriveStatus(item(), NOW)).toBe('OK');
  });
  it('prioritizes Low over Expiring', () => {
    expect(
      deriveStatus(item({ quantity: 5, reorderThreshold: 20, expirationDate: '2026-08-22' }), NOW),
    ).toBe('Low');
  });
});

describe('applyDonation', () => {
  it('increases quantity of a matching item', () => {
    const inv = [item({ quantity: 100 })];
    const d: Donation = {
      id: 'd1',
      date: '2026-08-20',
      donorName: 'Acme',
      donorType: 'grocery',
      items: [{ name: 'canned beans', category: 'Canned', quantity: 30, unit: 'cans' }],
    };
    const out = applyDonation(inv, d, { now: NOW });
    expect(out[0].quantity).toBe(130);
    expect(inv[0].quantity).toBe(100); // input not mutated
  });
  it('adds a new item when no match exists', () => {
    const inv: InventoryItem[] = [];
    const d: Donation = {
      id: 'd1',
      date: '2026-08-20',
      donorName: 'Acme',
      donorType: 'grocery',
      items: [{ name: 'Rice', category: 'Grains', quantity: 40, unit: 'lbs' }],
    };
    const out = applyDonation(inv, d, { now: NOW, makeId: () => 'new-1' });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'new-1', name: 'Rice', quantity: 40, unit: 'lbs' });
  });
});

describe('applyDistribution', () => {
  it('decreases matching quantity but not below zero', () => {
    const inv = [item({ quantity: 10 })];
    const dist: Distribution = {
      id: 'x1',
      date: '2026-08-20',
      recipient: 'Family',
      type: 'household',
      items: [{ name: 'Canned Beans', quantity: 25, unit: 'cans' }],
    };
    const out = applyDistribution(inv, dist, { now: NOW });
    expect(out[0].quantity).toBe(0);
  });
  it('ignores items not in inventory', () => {
    const inv = [item()];
    const dist: Distribution = {
      id: 'x1',
      date: '2026-08-20',
      recipient: 'Family',
      type: 'household',
      items: [{ name: 'Unknown', quantity: 5, unit: 'lbs' }],
    };
    const out = applyDistribution(inv, dist, { now: NOW });
    expect(out[0].quantity).toBe(100);
  });
});

describe('totalStock', () => {
  it('sums all quantities', () => {
    expect(totalStock([item({ quantity: 10 }), item({ quantity: 5 })])).toBe(15);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `inventory.ts` has no such exports.

- [ ] **Step 4: Implement `src/lib/inventory.ts`**

```ts
import type { InventoryItem, Status, Donation, Distribution } from './types';

const DAY_MS = 86_400_000;

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'id-' + Math.floor(Math.random() * 1e9).toString(36);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysUntil(dateISO: string, now: Date): number {
  const target = new Date(dateISO + 'T00:00:00Z').getTime();
  const base = new Date(isoDay(now) + 'T00:00:00Z').getTime();
  return Math.floor((target - base) / DAY_MS);
}

export function deriveStatus(item: InventoryItem, now: Date = new Date()): Status {
  if (item.quantity <= 0) return 'Out';
  if (item.quantity <= item.reorderThreshold) return 'Low';
  if (daysUntil(item.expirationDate, now) <= 14) return 'Expiring';
  return 'OK';
}

export function totalStock(inv: InventoryItem[]): number {
  return inv.reduce((sum, i) => sum + i.quantity, 0);
}

export function applyDonation(
  inv: InventoryItem[],
  donation: Donation,
  opts: { now?: Date; makeId?: () => string } = {},
): InventoryItem[] {
  const now = opts.now ?? new Date();
  const makeId = opts.makeId ?? newId;
  const stamp = isoDay(now);
  const next = inv.map((i) => ({ ...i }));
  for (const di of donation.items) {
    const idx = next.findIndex(
      (i) => i.name.toLowerCase() === di.name.toLowerCase() && i.category === di.category,
    );
    if (idx >= 0) {
      next[idx].quantity += di.quantity;
      next[idx].lastUpdated = stamp;
    } else {
      next.push({
        id: makeId(),
        name: di.name,
        category: di.category,
        quantity: di.quantity,
        unit: di.unit,
        expirationDate: isoDay(new Date(now.getTime() + 90 * DAY_MS)),
        location: 'Receiving',
        reorderThreshold: 10,
        lastUpdated: stamp,
      });
    }
  }
  return next;
}

export function applyDistribution(
  inv: InventoryItem[],
  distribution: Distribution,
  opts: { now?: Date } = {},
): InventoryItem[] {
  const now = opts.now ?? new Date();
  const stamp = isoDay(now);
  const next = inv.map((i) => ({ ...i }));
  for (const di of distribution.items) {
    const idx = next.findIndex((i) => i.name.toLowerCase() === di.name.toLowerCase());
    if (idx >= 0) {
      next[idx].quantity = Math.max(0, next[idx].quantity - di.quantity);
      next[idx].lastUpdated = stamp;
    }
  }
  return next;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all `inventory.test.ts` cases green.

- [ ] **Step 6: Create `src/data/mock.ts`** (seed data; dates chosen so some items read Low/Expiring/Out around Aug 2026)

```ts
import type { InventoryItem, Donation, Distribution } from '@/lib/types';

export const seedInventory: InventoryItem[] = [
  { id: 'i1', name: 'Canned Black Beans', category: 'Canned', quantity: 220, unit: 'cans', expirationDate: '2027-03-01', location: 'Aisle B', reorderThreshold: 50, lastUpdated: '2026-08-10' },
  { id: 'i2', name: 'Canned Corn', category: 'Canned', quantity: 35, unit: 'cans', expirationDate: '2027-01-15', location: 'Aisle B', reorderThreshold: 50, lastUpdated: '2026-08-12' },
  { id: 'i3', name: 'Peanut Butter', category: 'Protein', quantity: 90, unit: 'jars', expirationDate: '2027-06-01', location: 'Aisle C', reorderThreshold: 30, lastUpdated: '2026-08-05' },
  { id: 'i4', name: 'White Rice', category: 'Grains', quantity: 140, unit: 'lbs', expirationDate: '2027-09-01', location: 'Aisle A', reorderThreshold: 40, lastUpdated: '2026-08-14' },
  { id: 'i5', name: 'Pasta', category: 'Grains', quantity: 28, unit: 'boxes', expirationDate: '2027-02-01', location: 'Aisle A', reorderThreshold: 40, lastUpdated: '2026-08-11' },
  { id: 'i6', name: 'Whole Milk', category: 'Dairy', quantity: 24, unit: 'gallons', expirationDate: '2026-08-27', location: 'Fridge 1', reorderThreshold: 15, lastUpdated: '2026-08-18' },
  { id: 'i7', name: 'Cheddar Cheese', category: 'Dairy', quantity: 12, unit: 'blocks', expirationDate: '2026-08-29', location: 'Fridge 1', reorderThreshold: 15, lastUpdated: '2026-08-17' },
  { id: 'i8', name: 'Fresh Apples', category: 'Produce', quantity: 60, unit: 'lbs', expirationDate: '2026-08-25', location: 'Produce Bin', reorderThreshold: 30, lastUpdated: '2026-08-19' },
  { id: 'i9', name: 'Carrots', category: 'Produce', quantity: 45, unit: 'lbs', expirationDate: '2026-09-05', location: 'Produce Bin', reorderThreshold: 30, lastUpdated: '2026-08-16' },
  { id: 'i10', name: 'Frozen Chicken', category: 'Frozen', quantity: 80, unit: 'lbs', expirationDate: '2027-01-01', location: 'Freezer 1', reorderThreshold: 40, lastUpdated: '2026-08-13' },
  { id: 'i11', name: 'Frozen Mixed Veg', category: 'Frozen', quantity: 30, unit: 'bags', expirationDate: '2027-04-01', location: 'Freezer 1', reorderThreshold: 40, lastUpdated: '2026-08-09' },
  { id: 'i12', name: 'Canned Tuna', category: 'Protein', quantity: 0, unit: 'cans', expirationDate: '2027-05-01', location: 'Aisle C', reorderThreshold: 30, lastUpdated: '2026-08-15' },
  { id: 'i13', name: 'Cereal', category: 'Grains', quantity: 52, unit: 'boxes', expirationDate: '2027-03-15', location: 'Aisle A', reorderThreshold: 25, lastUpdated: '2026-08-08' },
  { id: 'i14', name: 'Apple Juice', category: 'Beverages', quantity: 40, unit: 'bottles', expirationDate: '2027-02-01', location: 'Aisle D', reorderThreshold: 20, lastUpdated: '2026-08-07' },
  { id: 'i15', name: 'Bottled Water', category: 'Beverages', quantity: 300, unit: 'bottles', expirationDate: '2028-01-01', location: 'Dock', reorderThreshold: 100, lastUpdated: '2026-08-06' },
  { id: 'i16', name: 'Diapers (Size 4)', category: 'Household', quantity: 18, unit: 'packs', expirationDate: '2029-01-01', location: 'Aisle E', reorderThreshold: 20, lastUpdated: '2026-08-04' },
  { id: 'i17', name: 'Toothpaste', category: 'Household', quantity: 65, unit: 'tubes', expirationDate: '2028-06-01', location: 'Aisle E', reorderThreshold: 25, lastUpdated: '2026-08-03' },
  { id: 'i18', name: 'Canned Soup', category: 'Canned', quantity: 110, unit: 'cans', expirationDate: '2027-07-01', location: 'Aisle B', reorderThreshold: 50, lastUpdated: '2026-08-12' },
  { id: 'i19', name: 'Eggs', category: 'Dairy', quantity: 40, unit: 'dozens', expirationDate: '2026-09-02', location: 'Fridge 2', reorderThreshold: 20, lastUpdated: '2026-08-18' },
  { id: 'i20', name: 'Ground Beef', category: 'Protein', quantity: 25, unit: 'lbs', expirationDate: '2026-12-01', location: 'Freezer 2', reorderThreshold: 30, lastUpdated: '2026-08-14' },
];

export const seedDonations: Donation[] = [
  { id: 'd1', date: '2026-08-18', donorName: 'Sunrise Grocery', donorType: 'grocery', items: [{ name: 'Fresh Apples', category: 'Produce', quantity: 40, unit: 'lbs' }, { name: 'Carrots', category: 'Produce', quantity: 25, unit: 'lbs' }] },
  { id: 'd2', date: '2026-08-15', donorName: 'Community Food Drive', donorType: 'food-drive', items: [{ name: 'Canned Black Beans', category: 'Canned', quantity: 120, unit: 'cans' }, { name: 'Pasta', category: 'Grains', quantity: 30, unit: 'boxes' }] },
  { id: 'd3', date: '2026-08-11', donorName: 'Acme Corp', donorType: 'corporate', items: [{ name: 'Bottled Water', category: 'Beverages', quantity: 200, unit: 'bottles' }] },
  { id: 'd4', date: '2026-08-06', donorName: 'Jane Doe', donorType: 'individual', items: [{ name: 'Peanut Butter', category: 'Protein', quantity: 20, unit: 'jars' }] },
];

export const seedDistributions: Distribution[] = [
  { id: 'x1', date: '2026-08-19', recipient: 'Eastside Shelter', type: 'partner-agency', items: [{ name: 'Canned Black Beans', quantity: 60, unit: 'cans' }, { name: 'White Rice', quantity: 40, unit: 'lbs' }], householdsServed: 45 },
  { id: 'x2', date: '2026-08-17', recipient: 'Mobile Pantry Route 3', type: 'mobile-pantry', items: [{ name: 'Fresh Apples', quantity: 30, unit: 'lbs' }, { name: 'Cereal', quantity: 20, unit: 'boxes' }], householdsServed: 30 },
  { id: 'x3', date: '2026-08-13', recipient: 'Johnson Family', type: 'household', items: [{ name: 'Whole Milk', quantity: 2, unit: 'gallons' }, { name: 'Eggs', quantity: 2, unit: 'dozens' }], householdsServed: 1 },
];
```

- [ ] **Step 7: Verify build + tests, then commit**

Run: `npm test && npm run build`
Expected: Tests PASS; build compiles.
```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Add domain types, inventory logic, and mock seed data"
```

---

### Task 3: Dashboard aggregation helpers (TDD)

**Files:**
- Create: `src/lib/dashboard.ts`
- Test: `src/lib/dashboard.test.ts`

**Interfaces:**
- Consumes: `deriveStatus` from `@/lib/inventory`; types from `@/lib/types`.
- Produces:
  - `statusCounts(inv: InventoryItem[], now?: Date): Record<Status, number>`
  - `categoryTotals(inv: InventoryItem[]): { category: string; total: number }[]`
  - `interface ActivityEntry { id: string; kind: 'donation' | 'distribution'; date: string; title: string; subtitle: string }`
  - `recentActivity(d: Donation[], x: Distribution[], limit?: number): ActivityEntry[]`
  - `flowByWeek(d: Donation[], x: Distribution[], now?: Date, weeks?: number): { label: string; intake: number; outflow: number }[]`

- [ ] **Step 1: Write the failing test `src/lib/dashboard.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { InventoryItem, Donation, Distribution } from './types';
import { statusCounts, categoryTotals, recentActivity, flowByWeek } from './dashboard';

const NOW = new Date('2026-08-20T12:00:00Z');

const inv: InventoryItem[] = [
  { id: '1', name: 'A', category: 'Canned', quantity: 0, unit: 'cans', expirationDate: '2027-01-01', location: '', reorderThreshold: 10, lastUpdated: '2026-08-01' },
  { id: '2', name: 'B', category: 'Canned', quantity: 5, unit: 'cans', expirationDate: '2027-01-01', location: '', reorderThreshold: 10, lastUpdated: '2026-08-01' },
  { id: '3', name: 'C', category: 'Produce', quantity: 100, unit: 'lbs', expirationDate: '2026-08-25', location: '', reorderThreshold: 10, lastUpdated: '2026-08-01' },
  { id: '4', name: 'D', category: 'Produce', quantity: 100, unit: 'lbs', expirationDate: '2027-01-01', location: '', reorderThreshold: 10, lastUpdated: '2026-08-01' },
];

describe('statusCounts', () => {
  it('counts each derived status', () => {
    expect(statusCounts(inv, NOW)).toEqual({ OK: 1, Low: 1, Expiring: 1, Out: 1 });
  });
});

describe('categoryTotals', () => {
  it('sums quantity per category, descending', () => {
    expect(categoryTotals(inv)).toEqual([
      { category: 'Produce', total: 200 },
      { category: 'Canned', total: 5 },
    ]);
  });
});

describe('recentActivity', () => {
  it('merges and sorts by date descending', () => {
    const donations: Donation[] = [
      { id: 'd1', date: '2026-08-10', donorName: 'Acme', donorType: 'grocery', items: [{ name: 'A', category: 'Canned', quantity: 10, unit: 'cans' }] },
    ];
    const dists: Distribution[] = [
      { id: 'x1', date: '2026-08-15', recipient: 'Shelter', type: 'partner-agency', items: [{ name: 'A', quantity: 5, unit: 'cans' }], householdsServed: 3 },
    ];
    const out = recentActivity(donations, dists);
    expect(out.map((e) => e.id)).toEqual(['x1', 'd1']);
    expect(out[0].kind).toBe('distribution');
  });
});

describe('flowByWeek', () => {
  it('buckets intake and outflow into the current week', () => {
    const donations: Donation[] = [
      { id: 'd1', date: '2026-08-20', donorName: 'Acme', donorType: 'grocery', items: [{ name: 'A', category: 'Canned', quantity: 10, unit: 'cans' }] },
    ];
    const dists: Distribution[] = [
      { id: 'x1', date: '2026-08-20', recipient: 'S', type: 'household', items: [{ name: 'A', quantity: 4, unit: 'cans' }] },
    ];
    const out = flowByWeek(donations, dists, NOW, 6);
    expect(out).toHaveLength(6);
    expect(out[5]).toMatchObject({ intake: 10, outflow: 4 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `dashboard.ts` missing.

- [ ] **Step 3: Implement `src/lib/dashboard.ts`**

```ts
import type { InventoryItem, Status, Donation, Distribution } from './types';
import { deriveStatus } from './inventory';

const DAY_MS = 86_400_000;

export function statusCounts(inv: InventoryItem[], now: Date = new Date()): Record<Status, number> {
  const counts: Record<Status, number> = { OK: 0, Low: 0, Expiring: 0, Out: 0 };
  for (const i of inv) counts[deriveStatus(i, now)]++;
  return counts;
}

export function categoryTotals(inv: InventoryItem[]): { category: string; total: number }[] {
  const map = new Map<string, number>();
  for (const i of inv) map.set(i.category, (map.get(i.category) ?? 0) + i.quantity);
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

export interface ActivityEntry {
  id: string;
  kind: 'donation' | 'distribution';
  date: string;
  title: string;
  subtitle: string;
}

function sumItems(items: { quantity: number }[]): number {
  return items.reduce((s, i) => s + i.quantity, 0);
}

export function recentActivity(
  donations: Donation[],
  distributions: Distribution[],
  limit = 8,
): ActivityEntry[] {
  const d: ActivityEntry[] = donations.map((x) => ({
    id: x.id,
    kind: 'donation',
    date: x.date,
    title: `Donation from ${x.donorName}`,
    subtitle: `${sumItems(x.items)} units · ${x.items.length} item${x.items.length !== 1 ? 's' : ''}`,
  }));
  const x: ActivityEntry[] = distributions.map((y) => ({
    id: y.id,
    kind: 'distribution',
    date: y.date,
    title: `Distribution to ${y.recipient}`,
    subtitle: `${sumItems(y.items)} units${y.householdsServed ? ` · ${y.householdsServed} households` : ''}`,
  }));
  return [...d, ...x].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export function flowByWeek(
  donations: Donation[],
  distributions: Distribution[],
  now: Date = new Date(),
  weeks = 6,
): { label: string; intake: number; outflow: number }[] {
  const startOfWeek = (d: Date): Date => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() - x.getUTCDay());
    return x;
  };
  const curStart = startOfWeek(now);
  const buckets = Array.from({ length: weeks }, (_, k) => {
    const start = new Date(curStart.getTime() - (weeks - 1 - k) * 7 * DAY_MS);
    return { start: start.getTime(), label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`, intake: 0, outflow: 0 };
  });
  const first = buckets[0].start;
  const indexOf = (dateISO: string): number => {
    const t = startOfWeek(new Date(dateISO + 'T00:00:00Z')).getTime();
    return Math.round((t - first) / (7 * DAY_MS));
  };
  for (const d of donations) {
    const idx = indexOf(d.date);
    if (idx >= 0 && idx < buckets.length) buckets[idx].intake += sumItems(d.items);
  }
  for (const x of distributions) {
    const idx = indexOf(x.date);
    if (idx >= 0 && idx < buckets.length) buckets[idx].outflow += sumItems(x.items);
  }
  return buckets.map(({ label, intake, outflow }) => ({ label, intake, outflow }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all `dashboard.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Add dashboard aggregation helpers with tests"
```

---

### Task 4: InventoryProvider (state + actions)

**Files:**
- Create: `src/context/InventoryProvider.tsx`
- Modify: `src/components/Providers.tsx`

**Interfaces:**
- Consumes: seed data from `@/data/mock`; `applyDonation`, `applyDistribution`, `newId` from `@/lib/inventory`; types.
- Produces: `useInventory()` returning:
  - `inventory: InventoryItem[]`, `donations: Donation[]`, `distributions: Distribution[]`
  - `addItem(item: Omit<InventoryItem, 'id' | 'lastUpdated'>): void`
  - `adjustQuantity(id: string, delta: number): void`
  - `logDonation(input: Omit<Donation, 'id'>): void`
  - `recordDistribution(input: Omit<Distribution, 'id'>): void`

- [ ] **Step 1: Create `src/context/InventoryProvider.tsx`**

```tsx
'use client';

import { createContext, useContext, useState } from 'react';
import type { InventoryItem, Donation, Distribution } from '@/lib/types';
import { applyDonation, applyDistribution, newId } from '@/lib/inventory';
import { seedInventory, seedDonations, seedDistributions } from '@/data/mock';

interface InventoryContextValue {
  inventory: InventoryItem[];
  donations: Donation[];
  distributions: Distribution[];
  addItem: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => void;
  adjustQuantity: (id: string, delta: number) => void;
  logDonation: (input: Omit<Donation, 'id'>) => void;
  recordDistribution: (input: Omit<Distribution, 'id'>) => void;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>(seedInventory);
  const [donations, setDonations] = useState<Donation[]>(seedDonations);
  const [distributions, setDistributions] = useState<Distribution[]>(seedDistributions);

  const addItem: InventoryContextValue['addItem'] = (item) => {
    setInventory((prev) => [{ ...item, id: newId(), lastUpdated: today() }, ...prev]);
  };

  const adjustQuantity: InventoryContextValue['adjustQuantity'] = (id, delta) => {
    setInventory((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(0, i.quantity + delta), lastUpdated: today() } : i,
      ),
    );
  };

  const logDonation: InventoryContextValue['logDonation'] = (input) => {
    const donation: Donation = { ...input, id: newId() };
    setDonations((prev) => [donation, ...prev]);
    setInventory((prev) => applyDonation(prev, donation));
  };

  const recordDistribution: InventoryContextValue['recordDistribution'] = (input) => {
    const distribution: Distribution = { ...input, id: newId() };
    setDistributions((prev) => [distribution, ...prev]);
    setInventory((prev) => applyDistribution(prev, distribution));
  };

  return (
    <InventoryContext.Provider
      value={{ inventory, donations, distributions, addItem, adjustQuantity, logDonation, recordDistribution }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}
```

- [ ] **Step 2: Wrap `AppShell` with the provider in `src/components/Providers.tsx`**

```tsx
'use client';

import AppShell from './AppShell';
import { InventoryProvider } from '@/context/InventoryProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <InventoryProvider>
      <AppShell>{children}</AppShell>
    </InventoryProvider>
  );
}
```

- [ ] **Step 3: Verify build, then commit**

Run: `npm run build`
Expected: Compiles with no type errors.
```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Add in-memory InventoryProvider with donation/distribution actions"
```

---

### Task 5: Shared UI primitives

**Files:**
- Create: `src/components/StatusPill.tsx`, `src/components/StatCard.tsx`, `src/components/Modal.tsx`, `src/components/FormField.tsx`

**Interfaces:**
- Produces:
  - `<StatusPill status={Status} />`
  - `<StatCard label icon={LucideIcon} value tone? />` where `tone?: 'default' | 'warn' | 'danger'`
  - `<Modal open title onClose>{children}</Modal>`
  - `<FormField label>{children}</FormField>` and `inputClass` export for shared input styling

- [ ] **Step 1: Create `src/components/StatusPill.tsx`**

```tsx
import type { Status } from '@/lib/types';

const STYLES: Record<Status, string> = {
  OK: 'bg-emerald-100 text-emerald-800',
  Low: 'bg-amber-100 text-amber-800',
  Expiring: 'bg-orange-100 text-orange-800',
  Out: 'bg-red-100 text-red-800',
};

export default function StatusPill({ status }: { status: Status }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status}
    </span>
  );
}
```

- [ ] **Step 2: Create `src/components/StatCard.tsx`**

```tsx
import type { LucideIcon } from 'lucide-react';

const TONES = {
  default: 'bg-yellow-100 text-yellow-700',
  warn: 'bg-orange-100 text-orange-700',
  danger: 'bg-red-100 text-red-700',
} as const;

export default function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-stone-500">{label}</span>
        <span className={`grid place-items-center w-8 h-8 rounded-lg ${TONES[tone]}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-stone-900">{value}</div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/Modal.tsx`**

```tsx
'use client';

import { X } from 'lucide-react';

export default function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-4 overflow-y-auto">
      <div className="mt-16 w-full max-w-lg rounded-xl bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
          <h2 className="font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/FormField.tsx`**

```tsx
export const inputClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500';

export default function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 5: Verify build, then commit**

Run: `npm run build`
Expected: Compiles (unused-for-now components are fine).
```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Add shared UI primitives: StatusPill, StatCard, Modal, FormField"
```

---

### Task 6: Inventory screen

**Files:**
- Create: `src/components/InventoryTable.tsx`
- Modify: `src/app/inventory/page.tsx`

**Interfaces:**
- Consumes: `useInventory()`, `deriveStatus`, `StatusPill`, `Modal`, `FormField` + `inputClass`.
- Produces: functional Inventory screen (search, category filter, status filter, add-item modal, inline qty +/-).

- [ ] **Step 1: Create `src/components/InventoryTable.tsx`**

```tsx
'use client';

import type { InventoryItem } from '@/lib/types';
import { deriveStatus } from '@/lib/inventory';
import StatusPill from './StatusPill';
import { Minus, Plus } from 'lucide-react';

export default function InventoryTable({
  items,
  onAdjust,
}: {
  items: InventoryItem[];
  onAdjust: (id: string, delta: number) => void;
}) {
  const now = new Date();
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-stone-500">
            <th className="px-4 py-3 font-medium">Item</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Quantity</th>
            <th className="px-4 py-3 font-medium">Expires</th>
            <th className="px-4 py-3 font-medium">Location</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className="border-b border-stone-100 last:border-0 hover:bg-yellow-50/50">
              <td className="px-4 py-3 font-medium text-stone-900">{i.name}</td>
              <td className="px-4 py-3 text-stone-600">{i.category}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAdjust(i.id, -1)}
                    className="grid place-items-center w-6 h-6 rounded border border-stone-300 text-stone-500 hover:bg-stone-100"
                    aria-label={`Decrease ${i.name}`}
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-16 text-center tabular-nums">
                    {i.quantity} {i.unit}
                  </span>
                  <button
                    onClick={() => onAdjust(i.id, 1)}
                    className="grid place-items-center w-6 h-6 rounded border border-stone-300 text-stone-500 hover:bg-stone-100"
                    aria-label={`Increase ${i.name}`}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </td>
              <td className="px-4 py-3 text-stone-600">{i.expirationDate}</td>
              <td className="px-4 py-3 text-stone-600">{i.location}</td>
              <td className="px-4 py-3">
                <StatusPill status={deriveStatus(i, now)} />
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                No items match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/inventory/page.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { deriveStatus } from '@/lib/inventory';
import type { Category, Status } from '@/lib/types';
import InventoryTable from '@/components/InventoryTable';
import Modal from '@/components/Modal';
import FormField, { inputClass } from '@/components/FormField';

const CATEGORIES: Category[] = ['Canned', 'Produce', 'Dairy', 'Grains', 'Frozen', 'Protein', 'Beverages', 'Household'];
const STATUSES: Status[] = ['OK', 'Low', 'Expiring', 'Out'];

export default function InventoryPage() {
  const { inventory, adjustQuantity, addItem } = useInventory();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [status, setStatus] = useState<string>('All');
  const [open, setOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const filtered = useMemo(
    () =>
      inventory.filter((i) => {
        if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (category !== 'All' && i.category !== category) return false;
        if (status !== 'All' && deriveStatus(i, now) !== status) return false;
        return true;
      }),
    [inventory, search, category, status, now],
  );

  // Add-item form state
  const [form, setForm] = useState({
    name: '',
    category: 'Canned' as Category,
    quantity: 0,
    unit: 'units',
    expirationDate: '',
    location: '',
    reorderThreshold: 10,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    addItem({
      name: form.name.trim(),
      category: form.category,
      quantity: Number(form.quantity),
      unit: form.unit,
      expirationDate: form.expirationDate || new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
      location: form.location || 'Receiving',
      reorderThreshold: Number(form.reorderThreshold),
    });
    setForm({ name: '', category: 'Canned', quantity: 0, unit: 'units', expirationDate: '', location: '', reorderThreshold: 10 });
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items…"
          className={`${inputClass} max-w-xs`}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} max-w-[10rem]`}>
          <option>All</option>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${inputClass} max-w-[10rem]`}>
          <option>All</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setOpen(true)}
          className="ml-auto flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
        >
          <Plus size={16} /> Add item
        </button>
      </div>

      <p className="text-sm text-stone-500">{filtered.length} of {inventory.length} items</p>
      <InventoryTable items={filtered} onAdjust={adjustQuantity} />

      <Modal open={open} title="Add inventory item" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <FormField label="Name">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Category">
              <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Location">
              <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </FormField>
            <FormField label="Quantity">
              <input type="number" min={0} className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </FormField>
            <FormField label="Unit">
              <input className={inputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </FormField>
            <FormField label="Expiration date">
              <input type="date" className={inputClass} value={form.expirationDate} onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} />
            </FormField>
            <FormField label="Reorder threshold">
              <input type="number" min={0} className={inputClass} value={form.reorderThreshold} onChange={(e) => setForm({ ...form, reorderThreshold: Number(e.target.value) })} />
            </FormField>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700">
              Add item
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Verify build + manual check**

Run: `npm run build` then `npm run dev`, open `/inventory`.
Expected: Table lists 20 seed items with status pills (Canned Tuna = Out, Whole Milk/Cheddar/Apples = Expiring, Canned Corn/Pasta/Diapers/Ground Beef = Low). Search filters by name; category/status dropdowns filter; +/- changes quantity and can flip status; "Add item" modal adds a row. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Add inventory screen with table, filters, and add-item modal"
```

---

### Task 7: Donations screen

**Files:**
- Modify: `src/app/donations/page.tsx`

**Interfaces:**
- Consumes: `useInventory()` (`donations`, `logDonation`), `Modal`, `FormField` + `inputClass`, types.
- Produces: donations list + "Log donation" modal (single-item form) that increases inventory.

- [ ] **Step 1: Replace `src/app/donations/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import type { Category, Donation } from '@/lib/types';
import Modal from '@/components/Modal';
import FormField, { inputClass } from '@/components/FormField';

const CATEGORIES: Category[] = ['Canned', 'Produce', 'Dairy', 'Grains', 'Frozen', 'Protein', 'Beverages', 'Household'];
const DONOR_TYPES: Donation['donorType'][] = ['individual', 'grocery', 'corporate', 'food-drive'];

export default function DonationsPage() {
  const { donations, logDonation } = useInventory();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    donorName: '',
    donorType: 'grocery' as Donation['donorType'],
    itemName: '',
    category: 'Canned' as Category,
    quantity: 0,
    unit: 'units',
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.donorName.trim() || !form.itemName.trim()) return;
    logDonation({
      date: new Date().toISOString().slice(0, 10),
      donorName: form.donorName.trim(),
      donorType: form.donorType,
      items: [{ name: form.itemName.trim(), category: form.category, quantity: Number(form.quantity), unit: form.unit }],
    });
    setForm({ donorName: '', donorType: 'grocery', itemName: '', category: 'Canned', quantity: 0, unit: 'units' });
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{donations.length} recorded donations</p>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
        >
          <Plus size={16} /> Log donation
        </button>
      </div>

      <div className="space-y-3">
        {donations.map((d) => (
          <div key={d.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-stone-900">{d.donorName}</div>
                <div className="text-xs uppercase tracking-wide text-stone-400">{d.donorType}</div>
              </div>
              <div className="text-sm text-stone-500">{d.date}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.items.map((it, idx) => (
                <span key={idx} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                  {it.quantity} {it.unit} · {it.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} title="Log donation" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Donor name">
              <input className={inputClass} value={form.donorName} onChange={(e) => setForm({ ...form, donorName: e.target.value })} required />
            </FormField>
            <FormField label="Donor type">
              <select className={inputClass} value={form.donorType} onChange={(e) => setForm({ ...form, donorType: e.target.value as Donation['donorType'] })}>
                {DONOR_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Item">
              <input className={inputClass} value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} required />
            </FormField>
            <FormField label="Category">
              <select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Quantity">
              <input type="number" min={0} className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </FormField>
            <FormField label="Unit">
              <input className={inputClass} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </FormField>
          </div>
          <p className="text-xs text-stone-400">Matching inventory increases automatically; unknown items are added to stock.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700">
              Log donation
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + manual check**

Run: `npm run build` then `npm run dev`, open `/donations`.
Expected: 4 seed donation cards. Logging a donation for "Canned Corn" (Canned, qty 100) adds a card AND, on `/inventory`, Canned Corn jumps from 35 → 135 and flips Low → OK. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Add donations screen that increases inventory"
```

---

### Task 8: Distributions screen

**Files:**
- Modify: `src/app/distributions/page.tsx`

**Interfaces:**
- Consumes: `useInventory()` (`distributions`, `recordDistribution`, `inventory`), `Modal`, `FormField` + `inputClass`, types.
- Produces: distributions list + "Record distribution" modal (single-item form, item chosen from current inventory) that decreases inventory.

- [ ] **Step 1: Replace `src/app/distributions/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import type { Distribution } from '@/lib/types';
import Modal from '@/components/Modal';
import FormField, { inputClass } from '@/components/FormField';

const DIST_TYPES: Distribution['type'][] = ['household', 'partner-agency', 'mobile-pantry'];

export default function DistributionsPage() {
  const { distributions, recordDistribution, inventory } = useInventory();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    recipient: '',
    type: 'partner-agency' as Distribution['type'],
    itemName: inventory[0]?.name ?? '',
    quantity: 0,
    householdsServed: 0,
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.recipient.trim() || !form.itemName) return;
    const unit = inventory.find((i) => i.name === form.itemName)?.unit ?? 'units';
    recordDistribution({
      date: new Date().toISOString().slice(0, 10),
      recipient: form.recipient.trim(),
      type: form.type,
      items: [{ name: form.itemName, quantity: Number(form.quantity), unit }],
      householdsServed: Number(form.householdsServed) || undefined,
    });
    setForm({ recipient: '', type: 'partner-agency', itemName: inventory[0]?.name ?? '', quantity: 0, householdsServed: 0 });
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{distributions.length} recorded distributions</p>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700"
        >
          <Plus size={16} /> Record distribution
        </button>
      </div>

      <div className="space-y-3">
        {distributions.map((d) => (
          <div key={d.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-stone-900">{d.recipient}</div>
                <div className="text-xs uppercase tracking-wide text-stone-400">
                  {d.type}
                  {d.householdsServed ? ` · ${d.householdsServed} households` : ''}
                </div>
              </div>
              <div className="text-sm text-stone-500">{d.date}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {d.items.map((it, idx) => (
                <span key={idx} className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-700">
                  {it.quantity} {it.unit} · {it.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} title="Record distribution" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Recipient / partner">
              <input className={inputClass} value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} required />
            </FormField>
            <FormField label="Type">
              <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Distribution['type'] })}>
                {DIST_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Item">
              <select className={inputClass} value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })}>
                {inventory.map((i) => (
                  <option key={i.id}>{i.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Quantity">
              <input type="number" min={0} className={inputClass} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </FormField>
            <FormField label="Households served">
              <input type="number" min={0} className={inputClass} value={form.householdsServed} onChange={(e) => setForm({ ...form, householdsServed: Number(e.target.value) })} />
            </FormField>
          </div>
          <p className="text-xs text-stone-400">Recording reduces the selected item&apos;s inventory (not below zero).</p>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700">
              Record distribution
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + manual check**

Run: `npm run build` then `npm run dev`, open `/distributions`.
Expected: 3 seed distribution cards. Recording a distribution of "White Rice" qty 40 adds a card AND, on `/inventory`, White Rice drops 140 → 100. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Add distributions screen that decreases inventory"
```

---

### Task 9: Dashboard screen + charts

**Files:**
- Create: `src/components/charts/CategoryChart.tsx`, `src/components/charts/TrendChart.tsx`, `src/components/ActivityFeed.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useInventory()`, `totalStock`, `statusCounts`, `categoryTotals`, `recentActivity`, `flowByWeek`, `StatCard`, `StatusPill`.
- Produces: dashboard with 6 stat cards, category bar chart, intake-vs-outflow area chart, status breakdown, activity feed.

- [ ] **Step 1: Create `src/components/charts/CategoryChart.tsx`**

```tsx
'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function CategoryChart({ data }: { data: { category: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={{ stroke: '#e7e5e4' }} interval={0} angle={-20} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: '#fefce8' }} />
        <Bar dataKey="total" fill="#ca8a04" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Create `src/components/charts/TrendChart.tsx`**

```tsx
'use client';

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function TrendChart({ data }: { data: { label: string; intake: number; outflow: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="intake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ca8a04" stopOpacity={0.5} />
            <stop offset="95%" stopColor="#ca8a04" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="outflow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f4" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={{ stroke: '#e7e5e4' }} />
        <YAxis tick={{ fontSize: 12, fill: '#78716c' }} tickLine={false} axisLine={false} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="intake" name="Intake" stroke="#ca8a04" fill="url(#intake)" strokeWidth={2} />
        <Area type="monotone" dataKey="outflow" name="Outflow" stroke="#f97316" fill="url(#outflow)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Create `src/components/ActivityFeed.tsx`**

```tsx
import type { ActivityEntry } from '@/lib/dashboard';
import { HandHeart, Truck } from 'lucide-react';

export default function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <ul className="divide-y divide-stone-100">
      {entries.map((e) => {
        const Icon = e.kind === 'donation' ? HandHeart : Truck;
        const tone = e.kind === 'donation' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700';
        return (
          <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 py-3">
            <span className={`grid place-items-center w-8 h-8 rounded-lg ${tone}`}>
              <Icon size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-stone-900">{e.title}</div>
              <div className="text-xs text-stone-500">{e.subtitle}</div>
            </div>
            <span className="text-xs text-stone-400">{e.date}</span>
          </li>
        );
      })}
      {entries.length === 0 && <li className="py-6 text-center text-sm text-stone-400">No activity yet.</li>}
    </ul>
  );
}
```

- [ ] **Step 4: Replace `src/app/dashboard/page.tsx`**

```tsx
'use client';

import { useMemo } from 'react';
import { Package, Boxes, AlertTriangle, Clock, HandHeart, Truck } from 'lucide-react';
import { useInventory } from '@/context/InventoryProvider';
import { totalStock } from '@/lib/inventory';
import { statusCounts, categoryTotals, recentActivity, flowByWeek } from '@/lib/dashboard';
import type { Status } from '@/lib/types';
import StatCard from '@/components/StatCard';
import ActivityFeed from '@/components/ActivityFeed';
import CategoryChart from '@/components/charts/CategoryChart';
import TrendChart from '@/components/charts/TrendChart';

const PILL: Record<Status, string> = {
  OK: 'bg-emerald-100 text-emerald-800',
  Low: 'bg-amber-100 text-amber-800',
  Expiring: 'bg-orange-100 text-orange-800',
  Out: 'bg-red-100 text-red-800',
};

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { inventory, donations, distributions } = useInventory();
  const now = useMemo(() => new Date(), []);

  const counts = statusCounts(inventory, now);
  const catData = categoryTotals(inventory);
  const trend = flowByWeek(donations, distributions, now, 6);
  const activity = recentActivity(donations, distributions, 8);

  const weekAgo = daysAgo(7);
  const donationsThisWeek = donations.filter((d) => d.date >= weekAgo).length;
  const distributionsThisWeek = distributions.filter((d) => d.date >= weekAgo).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total stock" value={totalStock(inventory).toLocaleString()} icon={Package} />
        <StatCard label="Distinct SKUs" value={inventory.length} icon={Boxes} />
        <StatCard label="Low stock" value={counts.Low} icon={AlertTriangle} tone="warn" />
        <StatCard label="Expiring soon" value={counts.Expiring} icon={Clock} tone="warn" />
        <StatCard label="Donations / wk" value={donationsThisWeek} icon={HandHeart} />
        <StatCard label="Distributions / wk" value={distributionsThisWeek} icon={Truck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-stone-900">Inventory by category</h2>
          <CategoryChart data={catData} />
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold text-stone-900">Intake vs. outflow (6 wks)</h2>
          <TrendChart data={trend} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold text-stone-900">Stock status</h2>
          <div className="space-y-2">
            {(Object.keys(counts) as Status[]).map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${PILL[s]}`}>{s}</span>
                <span className="text-sm font-medium text-stone-700">{counts[s]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-1 font-semibold text-stone-900">Recent activity</h2>
          <ActivityFeed entries={activity} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify build + manual check**

Run: `npm run build` then `npm run dev`, open `/dashboard`.
Expected: 6 stat cards with real numbers (Low = 4, Expiring = 3), category bar chart, intake-vs-outflow area chart with values in recent weeks, stock-status list, and a recent-activity feed mixing donations & distributions newest-first. Logging a donation/distribution updates these numbers. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Add dashboard with stat cards, charts, and activity feed"
```

---

### Task 10: README + final verification

**Files:**
- Create: `README.md`

**Interfaces:** none (docs + full-suite verification).

- [ ] **Step 1: Create `README.md`**

```markdown
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
```

- [ ] **Step 2: Full verification**

Run: `npm test && npm run build`
Expected: All unit tests PASS; production build succeeds with no type errors.

- [ ] **Step 3: Commit**

```bash
git add -A
git -c user.name='Dat Nguyen' -c user.email='datq.nguyen06@gmail.com' commit -m "Add README and finalize food bank inventory frontend"
```

- [ ] **Step 4: Report push decision to user**

Do NOT push. Tell the user the app is complete and ask whether to push to the shared repo `github.com/pynay/DSAHacks` (remote not yet configured).

---

## Self-Review

**Spec coverage:**
- Stack (Next.js/TS/Tailwind/Recharts/lucide) → Task 1. ✓
- Pale-yellow palette + semantic status colors → Global Constraints + used in Tasks 1, 5, 6–9. ✓
- Layout (sidebar + topbar + canvas) → Task 1. ✓
- Dashboard (stat cards, 2 charts, status breakdown, activity feed) → Task 9. ✓
- Inventory (table, search, category+status filters, add modal, qty adjust, status pills) → Task 6. ✓
- Donations (list + modal, increases inventory) → Task 7. ✓
- Distributions (list + modal, decreases inventory) → Task 8. ✓
- Data model (all types) → Task 2. ✓
- Derived status order → Task 2 (`deriveStatus`) + tested. ✓
- In-memory provider as sole data access → Task 4. ✓
- Mock seed (~20 items + donations + distributions) → Task 2. ✓
- Non-goals (no auth/backend/barcode/recipients CRUD/CSV) → respected; none added. ✓
- Git (author, no attribution, no push w/o confirm) → Global Constraints + Task 10 Step 4. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code; "Coming soon" stubs in Task 1 are explicitly replaced in Tasks 6–9. ✓

**Type consistency:** `deriveStatus(item, now?)`, `applyDonation(inv, d, {now, makeId})`, `applyDistribution(inv, d, {now})`, `useInventory()` action names (`addItem`, `adjustQuantity`, `logDonation`, `recordDistribution`), and `ActivityEntry` shape are used identically across Tasks 2–9. `StatCard` `tone` values (`default|warn|danger`) match usage in Task 9. ✓
