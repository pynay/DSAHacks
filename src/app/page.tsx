import Link from 'next/link';
import DroneMissionStory from '@/components/landing/DroneMissionStory';
import {
  Activity,
  ArrowRight,
  BarChart3,
  Boxes,
  BrainCircuit,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Database,
  HandHeart,
  Map,
  PackageCheck,
  PackageOpen,
  Plane,
  ShieldCheck,
  TriangleAlert,
  Warehouse,
} from 'lucide-react';

const systemFacts = [
  {
    label: 'Hotspot initializer',
    value: 'Experimental spatial ensemble',
    detail: 'Graph diffusion, spatial KDE, and Tweedie XGBoost',
  },
  {
    label: 'Latest block observation',
    value: 'January 2025',
    detail: 'The application marks the committed forecast stale',
  },
  {
    label: 'Field feedback',
    value: 'One reviewed aggregate count',
    detail: 'Applied manually; repeated video frames are not accumulated',
  },
  {
    label: 'Mission control',
    value: 'Operator decision support',
    detail: 'No autonomous flight or payload release',
  },
];

const proofPoints = [
  ['261', 'block priors', 'Seeded from the newer DSDP longitudinal panel'],
  ['6', 'movable hotspots', 'Recomputed when reviewed field feedback is applied'],
  ['Jan 2025', 'latest block source', 'Verification is required before operational use'],
];

const workflow = [
  {
    number: '01',
    icon: Database,
    title: 'Build a documented evidence base',
    body: 'Normalize public observations and contextual signals in DuckDB while preserving source, grain, date, and known bias.',
  },
  {
    number: '02',
    icon: BrainCircuit,
    title: 'Initialize block-level hotspots',
    body: 'A leakage-tested ensemble estimates a starting intensity surface. It is an experimental prior—not a live census.',
  },
  {
    number: '03',
    icon: Camera,
    title: 'Review a field observation',
    body: 'An operator selects a target and may apply one stabilized EyePop person count. Parsel stores no identity or face data.',
  },
  {
    number: '04',
    icon: PackageCheck,
    title: 'Recalculate the plan',
    body: 'A Gamma-Poisson update can move the hotspots. Only field-updated zones become eligible for deterministic FEFO allocation.',
  },
];

const capabilities = [
  {
    icon: BarChart3,
    title: 'Operations dashboard',
    body: 'Review stock, intake, outflow, and recent activity without presenting browser-held demo records as a live production ledger.',
    note: 'Demo operational state',
    href: '/dashboard',
  },
  {
    icon: Activity,
    title: 'Community signals',
    body: 'Explore PIT, shelter, 311, parking, and food-access data with contextual proxies clearly separated from headcounts.',
    note: 'Aggregate public data',
    href: '/signals',
  },
  {
    icon: Boxes,
    title: 'Inventory and food flow',
    body: 'Record inventory, donations, and distributions with derived stock and expiration status. Current records reset on reload.',
    note: 'Browser-held demo state',
    href: '/inventory',
  },
  {
    icon: Map,
    title: 'Delivery planning',
    body: 'Inspect six model-derived hotspots on a 3D map and test a separate 311-pressure scenario without presenting requests as people.',
    note: 'Experimental model + contextual scenario',
    href: '/delivery',
  },
  {
    icon: ClipboardCheck,
    title: 'Explainable allocation',
    body: 'Split available stock proportionally and move earlier-expiring items first—but only for zones with reviewed field evidence.',
    note: 'Field-gated deterministic FEFO',
    href: '/allocation',
  },
  {
    icon: Plane,
    title: 'Drone-camera feedback',
    body: 'Use a local video bridge to review people and objects, receive a clear/hold aid, and manually apply one aggregate person count.',
    note: 'No autopilot or payload control',
    href: '/drone',
  },
];

const boundaries = [
  'The historical block prior is not a current or exact date-and-time population forecast.',
  'A visible-person estimate is not identity, eligibility, consent, or a complete census.',
  '311 requests, parking, enforcement, shelter capacity, and weather are context—not people.',
  'The hotspot state and inventory are not yet durable across restarts or multiple servers.',
  'An operator approves field evidence, mission decisions, payload release, and handoff.',
];

export default function Home() {
  return (
    <main id="main-content" className="min-h-screen overflow-hidden bg-white text-[#071a2b]">
      <a
        href="#main-story"
        className="sr-only z-50 rounded-md bg-[#071a2b] px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Parsel home" className="flex items-center gap-2.5">
            <PackageOpen size={25} className="text-[#3ca875]" />
            <span className="text-xl font-semibold tracking-tight">Parsel</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex" aria-label="Landing page">
            <a href="#drone-concept" className="hover:text-[#071a2b]">Drone concept</a>
            <a href="#platform" className="hover:text-[#071a2b]">What works</a>
            <a href="#feedback-loop" className="hover:text-[#071a2b]">Feedback loop</a>
          </nav>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[#071a2b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123a54]"
          >
            Open demo <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section id="main-story" className="border-b border-slate-200">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.03fr_.97fr] lg:items-center lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#176b48]">
              <ShieldCheck size={14} /> Research demo · operator reviewed
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Plan food relief with evidence.{' '}
              <span className="text-[#27875b]">Verify before you act.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              Parsel connects food inventory, documented San Diego signals, an experimental
              block-level hotspot model, and reviewed field observations. It helps an operator
              compare options; it does not make autonomous delivery decisions.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#3ca875] px-6 py-3.5 text-sm font-bold text-[#071a2b] hover:bg-[#54b889]"
              >
                Explore the demo <ArrowRight size={17} />
              </Link>
              <a
                href="#feedback-loop"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                See the feedback loop
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-600">
              {['Aggregate observations only', 'Proxy labels preserved', 'Human approval required'].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#27875b]" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="border border-[#071a2b] bg-[#071a2b] p-5 text-white shadow-[10px_10px_0_0_#54b889] sm:p-7">
            <div className="flex items-start justify-between gap-5 border-b border-white/15 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#76d6a7]">Current system state</p>
                <h2 className="mt-2 text-2xl font-semibold">What the demo can claim today</h2>
              </div>
              <span className="rounded-full border border-amber-300/50 px-3 py-1 text-xs font-semibold text-amber-200">
                Field check required
              </span>
            </div>
            <dl className="divide-y divide-white/10">
              {systemFacts.map((fact) => (
                <div key={fact.label} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{fact.label}</dt>
                  <dd>
                    <p className="font-semibold text-slate-100">{fact.value}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{fact.detail}</p>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-start gap-3 border border-amber-300/25 bg-amber-300/[0.07] p-4 text-sm leading-6 text-slate-300">
              <TriangleAlert size={19} className="mt-0.5 shrink-0 text-amber-300" />
              <p>The latest block-level source is stale. Parsel surfaces that warning instead of presenting the forecast as live truth.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-[#f3f7f8]" aria-label="Model facts">
        <div className="mx-auto grid max-w-7xl divide-y divide-slate-200 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
          {proofPoints.map(([value, label, note]) => (
            <div key={label} className="px-2 py-8 sm:px-7">
              <p className="text-3xl font-semibold tracking-tight">{value}</p>
              <p className="mt-1 text-sm font-bold text-[#27875b]">{label}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <DroneMissionStory />

      <section id="platform" className="scroll-mt-8 bg-[#f8fafb] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#27875b]">What works today</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">One demo, six system areas.</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Each area labels its data mode and limits. The product combines real aggregate
              sources with demo operational records instead of pretending every value is live.
            </p>
          </div>

          <div className="mt-12 grid overflow-hidden border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, body, note, href }) => (
              <Link key={title} href={href} className="bg-white p-7 hover:bg-emerald-50">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#071a2b] text-[#76d6a7]">
                    <Icon size={20} />
                  </span>
                  <ArrowRight size={17} className="text-slate-400" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
                <p className="mt-5 border-t border-slate-200 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {note}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="feedback-loop" className="scroll-mt-8 bg-[#071a2b] py-20 text-white sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#76d6a7]">The adaptive feedback loop</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">The map can move—but only after review.</h2>
            <p className="mt-5 text-lg leading-8 text-slate-400">
              Offline modeling supplies the starting map. A person decides whether a field count
              is suitable evidence before it changes the current hotspot surface.
            </p>
          </div>

          <ol className="mt-14 grid border border-white/15 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map(({ number, icon: Icon, title, body }) => (
              <li key={number} className="border-b border-white/15 p-7 last:border-b-0 md:border-r md:[&:nth-child(2)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2)]:border-r lg:last:border-r-0">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#3ca875] text-[#071a2b]">
                    <Icon size={20} />
                  </span>
                  <span className="font-mono text-xs text-slate-600">{number}</span>
                </div>
                <h3 className="mt-7 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 grid gap-4 border border-[#54b889]/30 bg-[#54b889]/[0.07] p-5 text-sm leading-6 text-slate-300 sm:grid-cols-[auto_1fr]">
            <ShieldCheck size={23} className="text-[#76d6a7]" />
            <p>
              <strong className="text-white">Why one reviewed count?</strong> Adjacent video frames
              contain many of the same people. Automatically submitting every frame would multiply-count
              them, so Drone Ops requires an explicit operator action.
            </p>
          </div>
        </div>
      </section>

      <section id="evidence" className="scroll-mt-8 bg-white py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#27875b]">Decision gate</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">The model can suggest. Field evidence unlocks action.</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              Parsel does not turn a stale prediction directly into a food distribution. The
              starting surface is useful for deciding where to verify; only the locally updated
              zone is allowed into the allocation workflow.
            </p>
            <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
              <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">01 · Prior</p>
                <div>
                  <p className="font-semibold text-slate-900">Choose where to verify</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Historical model output stays visible but is marked planning-only.</p>
                </div>
              </div>
              <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">02 · Review</p>
                <div>
                  <p className="font-semibold text-slate-900">Apply one aggregate observation</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">A person accepts the count before it updates nearby blocks.</p>
                </div>
              </div>
              <div className="grid gap-2 py-5 sm:grid-cols-[8rem_1fr]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">03 · Allocate</p>
                <div>
                  <p className="font-semibold text-slate-900">Unlock only the updated zone</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Unverified priors cannot stage distributions or decrement inventory.</p>
                </div>
              </div>
            </div>
            <Link href="/allocation" className="mt-7 inline-flex items-center gap-2 text-sm font-bold underline decoration-[#3ca875] decoration-2 underline-offset-4">
              Inspect the allocation gate <ArrowRight size={15} />
            </Link>
          </div>

          <div className="border border-slate-200 bg-[#f3f7f8] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#27875b] text-white">
                <TriangleAlert size={20} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Non-negotiable limits</p>
                <h3 className="mt-1 text-2xl font-semibold">What Parsel does not claim</h3>
              </div>
            </div>
            <ul className="mt-7 divide-y divide-slate-200 border-y border-slate-200">
              {boundaries.map((boundary) => (
                <li key={boundary} className="flex gap-3 py-4 text-sm leading-6 text-slate-700">
                  <CheckCircle2 size={17} className="mt-1 shrink-0 text-[#27875b]" />
                  {boundary}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-slate-600">
              <Warehouse size={18} className="mt-1 shrink-0 text-[#071a2b]" />
              <p>Real deployment requires durable inventory and mission records, partner confirmation, calibrated coverage, and site-specific flight and safety review.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#27875b] bg-[#3ca875] py-16 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 sm:px-8 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#0b3f2b]">
              <HandHeart size={18} /> See the system, including its caveats
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Follow the demo from data to allocation.</h2>
          </div>
          <Link href="/login" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#071a2b] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#123a54]">
            Open Parsel <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="flex items-center gap-2 font-semibold">
            <PackageOpen size={20} className="text-[#3ca875]" /> Parsel
          </span>
          <p className="text-sm text-slate-500">Evidence-informed food-relief planning with people in control.</p>
          <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold">
            Open demo <ArrowRight size={14} />
          </Link>
        </div>
      </footer>
    </main>
  );
}
