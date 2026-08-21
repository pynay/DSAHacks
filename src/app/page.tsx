import Image from 'next/image';
import Link from 'next/link';
import {
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
  Plane,
  ScanSearch,
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
    detail: 'No autonomous flight, release, or food disposal',
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
    body: 'A Gamma-Poisson update can move the hotspots, then deterministic FEFO allocation matches available demo inventory to demand.',
  },
];

const capabilities = [
  {
    icon: BarChart3,
    title: 'Operations dashboard',
    body: 'Explore inventory status alongside PIT, shelter, 311, parking, and food-access signals. Contextual proxies remain clearly separated from headcounts.',
    note: 'Aggregate public data + demo operations',
    href: '/dashboard',
  },
  {
    icon: Boxes,
    title: 'Inventory and food flow',
    body: 'Record inventory, donations, and distributions with derived stock and expiration status. The current records are browser-held demo state.',
    note: 'Resets on a full reload',
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
    body: 'Split available stock proportionally and move earlier-expiring items first. Quantities are generic demo units, not a production packing manifest.',
    note: 'Deterministic FEFO logic',
    href: '/allocation',
  },
  {
    icon: ScanSearch,
    title: 'Food intake assistance',
    body: 'Run EyePop object detection and an optional freshness suggestion for staff review. It does not certify food safety or discard food.',
    note: 'Human review required',
    href: '/food-check',
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
  'A visible-person estimate is not identity, eligibility, consent, or a complete census.',
  '311 requests, parking, enforcement, shelter capacity, and weather are context—not people.',
  'The hotspot state and inventory are not yet durable across restarts or multiple servers.',
  'A trained person approves food disposition, mission launch, payload release, and handoff.',
];

export default function Home() {
  return (
    <main id="main-content" className="min-h-screen overflow-hidden bg-[#f7f4ed] text-stone-950">
      <a
        href="#main-story"
        className="sr-only z-50 rounded-lg bg-stone-950 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <header className="border-b border-stone-300/80 bg-[#f7f4ed]">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Parsel home" className="inline-flex items-center">
            <Image
              src="/parsel-logo.png"
              alt="Parsel"
              width={1401}
              height={437}
              className="h-9 w-auto"
              preload
            />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex" aria-label="Landing page">
            <a href="#platform" className="hover:text-stone-950">What works</a>
            <a href="#feedback-loop" className="hover:text-stone-950">Feedback loop</a>
            <a href="#evidence" className="hover:text-stone-950">Evidence &amp; limits</a>
          </nav>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Open demo <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section id="main-story" className="border-b border-stone-300/80">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.03fr_.97fr] lg:items-center lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-amber-900">
              <ShieldCheck size={14} /> Research demo · operator reviewed
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Plan food relief with evidence.{' '}
              <span className="text-[#c6532f]">Verify before you act.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-600 sm:text-xl">
              Parsel connects food inventory, documented San Diego signals, an experimental
              block-level hotspot model, and reviewed field observations. It helps an operator
              compare options; it does not make autonomous delivery decisions.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-[#e7673f] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#c6532f]"
              >
                Explore the demo <ArrowRight size={17} />
              </Link>
              <a
                href="#feedback-loop"
                className="inline-flex items-center gap-2 rounded-full border border-stone-400 bg-white px-6 py-3.5 text-sm font-semibold text-stone-800 hover:bg-stone-50"
              >
                See the feedback loop
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3 text-sm text-stone-600">
              {['Aggregate observations only', 'Proxy labels preserved', 'Human approval required'].map((item) => (
                <span key={item} className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-700" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="border border-stone-800 bg-stone-950 p-5 text-white shadow-[10px_10px_0_0_#e7b33f] sm:p-7">
            <div className="flex items-start justify-between gap-5 border-b border-white/15 pb-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400">Current system state</p>
                <h2 className="mt-2 text-2xl font-semibold">What the demo can claim today</h2>
              </div>
              <span className="rounded-full border border-amber-400/50 px-3 py-1 text-xs font-semibold text-amber-300">
                Field check required
              </span>
            </div>
            <dl className="divide-y divide-white/10">
              {systemFacts.map((fact) => (
                <div key={fact.label} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">{fact.label}</dt>
                  <dd>
                    <p className="font-semibold text-stone-100">{fact.value}</p>
                    <p className="mt-1 text-xs leading-5 text-stone-400">{fact.detail}</p>
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex items-start gap-3 border border-amber-400/25 bg-amber-400/[0.07] p-4 text-sm leading-6 text-stone-300">
              <TriangleAlert size={19} className="mt-0.5 shrink-0 text-amber-400" />
              <p>The latest block-level source is stale. Parsel surfaces that warning instead of presenting the forecast as live truth.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-stone-300/80 bg-white" aria-label="Model facts">
        <div className="mx-auto grid max-w-7xl divide-y divide-stone-300 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
          {proofPoints.map(([value, label, note]) => (
            <div key={label} className="px-2 py-8 sm:px-7">
              <p className="text-3xl font-semibold tracking-tight text-stone-950">{value}</p>
              <p className="mt-1 text-sm font-bold text-[#b74628]">{label}</p>
              <p className="mt-2 text-sm leading-6 text-stone-500">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="platform" className="scroll-mt-8 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b74628]">What works today</p>
              <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">One demo, six operational views.</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-stone-600">
              Each view labels its data mode and limits. The product combines real aggregate
              sources with demo operational records instead of pretending every value is live.
            </p>
          </div>

          <div className="mt-12 grid overflow-hidden border border-stone-300 bg-stone-300 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, body, note, href }) => (
              <Link key={title} href={href} className="bg-white p-7 hover:bg-amber-50">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-stone-950 text-amber-300">
                    <Icon size={20} />
                  </span>
                  <ArrowRight size={17} className="text-stone-400" />
                </div>
                <h3 className="mt-6 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{body}</p>
                <p className="mt-5 border-t border-stone-200 pt-4 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {note}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="feedback-loop" className="scroll-mt-8 bg-stone-950 py-20 text-white sm:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-400">The adaptive feedback loop</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">The map can move—but only after review.</h2>
            <p className="mt-5 text-lg leading-8 text-stone-400">
              Offline modeling supplies the starting map. A person decides whether a field count
              is suitable evidence before it changes the current hotspot surface.
            </p>
          </div>

          <ol className="mt-14 grid border border-white/15 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map(({ number, icon: Icon, title, body }) => (
              <li key={number} className="border-b border-white/15 p-7 last:border-b-0 md:border-r md:[&:nth-child(2)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2)]:border-r lg:last:border-r-0">
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-amber-400 text-stone-950">
                    <Icon size={20} />
                  </span>
                  <span className="font-mono text-xs text-stone-600">{number}</span>
                </div>
                <h3 className="mt-7 text-xl font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-400">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-8 grid gap-4 border border-amber-400/25 bg-amber-400/[0.06] p-5 text-sm leading-6 text-stone-300 sm:grid-cols-[auto_1fr]">
            <ShieldCheck size={23} className="text-amber-400" />
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
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#b74628]">Model evidence</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Better than persistence in backtesting. Still experimental.</h2>
            <p className="mt-5 text-lg leading-8 text-stone-600">
              The selected stacked ensemble was tested on forward time folds rather than random
              train/test splits. These results describe historical evaluation, not guaranteed field accuracy.
            </p>
            <div className="mt-8 grid grid-cols-2 border border-stone-300">
              <div className="border-r border-stone-300 p-5">
                <p className="text-3xl font-semibold">1.789</p>
                <p className="mt-1 text-sm font-bold text-[#b74628]">ensemble MAE</p>
                <p className="mt-2 text-xs leading-5 text-stone-500">Per block, historical benchmark</p>
              </div>
              <div className="p-5">
                <p className="text-3xl font-semibold">1.911</p>
                <p className="mt-1 text-sm font-bold text-stone-600">persistence MAE</p>
                <p className="mt-2 text-xs leading-5 text-stone-500">Last-observation baseline</p>
              </div>
            </div>
            <Link href="/delivery" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-stone-950 underline decoration-amber-500 decoration-2 underline-offset-4">
              Inspect the hotspot map <ArrowRight size={15} />
            </Link>
          </div>

          <div className="border border-stone-300 bg-[#f7f4ed] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e7673f] text-white">
                <TriangleAlert size={20} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-stone-500">Non-negotiable limits</p>
                <h3 className="mt-1 text-2xl font-semibold">What Parsel does not claim</h3>
              </div>
            </div>
            <ul className="mt-7 divide-y divide-stone-300 border-y border-stone-300">
              {boundaries.map((boundary) => (
                <li key={boundary} className="flex gap-3 py-4 text-sm leading-6 text-stone-700">
                  <CheckCircle2 size={17} className="mt-1 shrink-0 text-emerald-700" />
                  {boundary}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex items-start gap-3 text-sm leading-6 text-stone-600">
              <Warehouse size={18} className="mt-1 shrink-0 text-stone-900" />
              <p>Real deployment requires durable inventory and mission records, partner confirmation, calibrated coverage, and site-specific flight and safety review.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-stone-300 bg-amber-300 py-16 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 sm:px-8 lg:flex-row lg:items-center">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-stone-700">
              <HandHeart size={18} /> See the system, including its caveats
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Follow the demo from data to allocation.</h2>
          </div>
          <Link href="/dashboard" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-stone-950 px-6 py-3.5 text-sm font-bold text-white hover:bg-stone-800">
            Open Parsel <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      <footer className="bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Image src="/parsel-logo.png" alt="Parsel" width={1401} height={437} className="h-7 w-auto" />
          <p className="text-sm text-stone-500">Evidence-informed food-relief planning with people in control.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-800">
            Open demo <ArrowRight size={14} />
          </Link>
        </div>
      </footer>
    </main>
  );
}
