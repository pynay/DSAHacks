import Link from 'next/link';
import DroneMissionStory from '@/components/landing/DroneMissionStory';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BarChart3,
  Boxes,
  BrainCircuit,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Database,
  ExternalLink,
  HandHeart,
  Map,
  PackageCheck,
  PackageOpen,
  Plane,
  ShieldCheck,
  TriangleAlert,
  Warehouse,
} from 'lucide-react';

const impactSlides = [
  {
    number: '01',
    stat: '9,803',
    kicker: 'The need is still near five figures',
    headline: 'people were experiencing homelessness across San Diego County in the 2026 count.',
    detail: 'That is only 1% lower than 2025. Progress is real, but the scale remains urgent.',
    source: 'Regional Task Force on Homelessness, 2026 PIT Count',
    href: 'https://www.rtfhsd.org/unsheltered-homelessness-drops-11-across-san-diego-region-as-investments-show-results/',
    tone: 'night',
  },
  {
    number: '02',
    stat: '10 / 14',
    kicker: 'The system remains under pressure',
    headline: 'people found housing for every 14 who experienced homelessness for the first time.',
    detail: 'That is the regional monthly average across the latest 12-month period published by RTFH.',
    source: 'RTFH monthly homelessness data reports, accessed August 2026',
    href: 'https://www.rtfhsd.org/reports-data/',
    tone: 'signal',
  },
  {
    number: '03',
    stat: '400K+',
    kicker: 'Food support operates at immense scale',
    headline: 'people receive food assistance each month through the San Diego Food Bank.',
    detail: 'The organization distributes about 53 million pounds of food each year through more than 450 nonprofit hunger-relief partners. At this scale, timing and placement matter.',
    source: 'San Diego Food Bank, audited FY2025 financial statements',
    href: 'https://www.sandiegofoodbank.org/wp-content/uploads/2026/01/JCSDFB-2025-FS.pdf',
    tone: 'paper',
  },
  {
    number: '04',
    stat: '1 night',
    kicker: 'Our clearest location picture is a snapshot',
    headline: 'is what the annual Point-in-Time Count is designed to capture.',
    detail: 'The count is essential evidence and a minimum estimate. It cannot tell an operator where need has moved by tomorrow afternoon. Parsel starts with a January 2025 block prior, then uses reviewed field observations to narrow that gap.',
    source: 'RTFH 2026 Point-in-Time Count methodology',
    href: 'https://www.rtfhsd.org/unsheltered-homelessness-drops-11-across-san-diego-region-as-investments-show-results/',
    tone: 'warm',
  },
] as const;

const slideStyles = {
  night: {
    section: 'border-[#17384c] bg-[#071a2b] text-white',
    kicker: 'text-[#76d6a7]',
    stat: 'text-[#76d6a7]',
    body: 'text-slate-300',
    source: 'border-white/15 text-slate-400 hover:text-white',
    index: 'border-white/20 text-slate-500',
  },
  signal: {
    section: 'border-[#2d9867] bg-[#3ca875] text-[#071a2b]',
    kicker: 'text-[#0b4b33]',
    stat: 'text-[#071a2b]',
    body: 'text-[#123f30]',
    source: 'border-[#176b48]/30 text-[#0b4b33] hover:text-[#071a2b]',
    index: 'border-[#071a2b]/25 text-[#0b4b33]',
  },
  paper: {
    section: 'border-slate-200 bg-[#f4f1e8] text-[#071a2b]',
    kicker: 'text-[#9b511b]',
    stat: 'text-[#d66b22]',
    body: 'text-slate-600',
    source: 'border-slate-300 text-slate-500 hover:text-[#071a2b]',
    index: 'border-slate-300 text-slate-500',
  },
  warm: {
    section: 'border-[#d7b98c] bg-[#f2c46d] text-[#071a2b]',
    kicker: 'text-[#72400f]',
    stat: 'text-[#071a2b]',
    body: 'text-[#5f3b16]',
    source: 'border-[#72400f]/30 text-[#72400f] hover:text-[#071a2b]',
    index: 'border-[#72400f]/30 text-[#72400f]',
  },
} as const;

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
    body: 'A leakage-tested ensemble estimates a starting intensity surface. It is an experimental prior, not a live census.',
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
    title: 'Response planning map',
    body: 'Inspect six model-derived hotspots on a 3D map and test a separate 311-pressure scenario without presenting requests as people.',
    note: 'Experimental model + contextual scenario',
    href: '/delivery',
  },
  {
    icon: ClipboardCheck,
    title: 'Explainable allocation',
    body: 'Split available stock proportionally and move earlier-expiring items first, but only for zones with reviewed field evidence.',
    note: 'Field-gated deterministic FEFO',
    href: '/allocation',
  },
  {
    icon: Plane,
    title: 'Drone sensing feedback',
    body: 'Use a local video bridge to gather aggregate people and object observations, then manually apply one reviewed count to the model.',
    note: 'Information gathering · no drone delivery',
    href: '/drone',
  },
];

const boundaries = [
  'The historical block prior is not a current or exact date-and-time population forecast.',
  'A visible-person estimate is not identity, eligibility, consent, or a complete census.',
  '311 requests, parking, enforcement, shelter capacity, and weather are context, not people.',
  'The hotspot state and inventory are not yet durable across restarts or multiple servers.',
  'An operator approves field evidence, sensing missions, response recommendations, dispatch, and food handoff.',
];

export default function Home() {
  return (
    <main id="main-content" className="min-h-screen bg-white text-[#071a2b]">
      <a
        href="#main-story"
        className="sr-only z-50 rounded-md bg-[#071a2b] px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Parsel home" className="flex items-center gap-2.5">
            <PackageOpen size={25} className="text-[#3ca875]" />
            <span className="text-xl font-semibold tracking-tight">Parsel</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex" aria-label="Landing page">
            <a href="#case-for-action" className="hover:text-[#071a2b]">Why now</a>
            <a href="#drone-concept" className="hover:text-[#071a2b]">How it learns</a>
            <a href="#platform" className="hover:text-[#071a2b]">Explore Parsel</a>
          </nav>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[#071a2b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#123a54]"
          >
            Open demo <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      <section id="main-story" className="flex min-h-[calc(100svh-5rem)] items-center border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#176b48]">
            <ShieldCheck size={14} /> San Diego research demo · operator reviewed
          </div>
          <h1 className="mt-7 max-w-6xl text-5xl font-semibold leading-[0.91] tracking-[-0.06em] sm:text-7xl lg:text-[7.25rem]">
            Need moves.{' '}
            <span className="text-[#27875b]">Our picture should too.</span>
          </h1>
          <div className="mt-9 grid gap-8 border-t border-slate-200 pt-7 md:grid-cols-[1.15fr_.85fr] md:items-end">
            <p className="max-w-3xl text-xl leading-8 text-slate-600 sm:text-2xl sm:leading-9">
              Parsel helps food-relief teams decide where to look, verify what is happening now,
              and update how supplies are allocated. The model guides attention. People approve action.
            </p>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#071a2b] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#123a54]"
              >
                Open the demo <ArrowRight size={17} />
              </Link>
              <a
                href="#case-for-action"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                See why it matters <ArrowDown size={17} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <div id="case-for-action" className="scroll-mt-20" aria-label="Why Parsel matters">
        {impactSlides.map((slide) => {
          const styles = slideStyles[slide.tone];

          return (
            <section
              key={slide.number}
              className={`flex min-h-[100svh] items-center border-b ${styles.section}`}
              aria-labelledby={`impact-slide-${slide.number}`}
            >
              <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.2fr_.8fr] lg:items-end lg:gap-20">
                <div>
                  <div className="flex items-center gap-4">
                    <span className={`grid h-11 w-11 place-items-center rounded-full border font-mono text-xs font-bold ${styles.index}`}>
                      {slide.number}
                    </span>
                    <p className={`text-xs font-bold uppercase tracking-[0.18em] ${styles.kicker}`}>
                      {slide.kicker}
                    </p>
                  </div>
                  <p className={`mt-12 whitespace-nowrap text-[clamp(5rem,16vw,13rem)] font-semibold leading-[0.76] tracking-[-0.08em] ${styles.stat}`}>
                    {slide.stat}
                  </p>
                </div>

                <div className="lg:pb-1">
                  <h2 id={`impact-slide-${slide.number}`} className="text-3xl font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                    {slide.headline}
                  </h2>
                  <p className={`mt-6 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8 ${styles.body}`}>
                    {slide.detail}
                  </p>
                  <a
                    href={slide.href}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-10 inline-flex max-w-full items-start gap-2 border-t pt-4 text-xs font-semibold uppercase leading-5 tracking-[0.12em] ${styles.source}`}
                  >
                    <span>Source: {slide.source}</span>
                    <ExternalLink size={14} className="mt-0.5 shrink-0" />
                  </a>
                </div>
              </div>
            </section>
          );
        })}
      </div>

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
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">The map can move, but only after review.</h2>
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
