import Link from 'next/link';
import DroneMissionStory from '@/components/landing/DroneMissionStory';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Boxes,
  BrainCircuit,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Database,
  ExternalLink,
  HandHeart,
  PackageCheck,
  PackageOpen,
  ShieldCheck,
  TriangleAlert,
  Warehouse,
} from 'lucide-react';

const impactSlides = [
  {
    number: '01',
    stat: '850K',
    kicker: 'Food insecurity touches every community',
    headline: 'San Diegans are estimated to be nutrition insecure.',
    detail: 'As of March 2026, more than 1 in 4 residents could not afford three nutritious meals a day. San Diego has now remained at or above 25% nutrition insecurity for two years.',
    source: 'San Diego Hunger Coalition, March 2026 Data Release & Analysis',
    href: 'https://www.sdhunger.org/research',
    tone: 'night',
  },
  {
    number: '02',
    stat: '4.1M',
    kicker: 'Millions of meals are still missing',
    headline: 'additional meals were needed in March for a hunger-free San Diego County.',
    detail: 'The hunger-relief sector provided 29 million meals that month and met 88% of estimated need. The remaining gap shows why food availability and placement both matter.',
    source: 'San Diego Hunger Coalition, March 2026 Data Release & Analysis',
    href: 'https://www.sdhunger.org/research',
    tone: 'signal',
  },
  {
    number: '03',
    stat: '400K',
    kicker: 'Relief already operates at massive scale',
    headline: 'people are fed each month by the San Diego Food Bank and its partners.',
    detail: 'A network of 450 nonprofit partners moves food through pantries, schools, shelters, senior centers, and other community programs across the county.',
    source: 'San Diego Food Bank, Hunger Facts & Research',
    href: 'https://www.sandiegofoodbank.org/about/hunger-facts-research/',
    tone: 'paper',
  },
  {
    number: '04',
    stat: '52M lbs',
    kicker: 'Inventory is not a side feature',
    headline: 'of food and supplies moved through the San Diego Food Bank in FY2024-25.',
    detail: 'At this scale, inventory, expiration, and location must connect. Parsel’s current block model estimates visible outreach demand, not food insecurity, so it is used to choose where to verify before allocation.',
    source: 'San Diego Food Bank, Hunger Facts & Research',
    href: 'https://www.sandiegofoodbank.org/about/hunger-facts-research/',
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
    title: 'Build a food-access evidence base',
    body: 'Connect nutrition insecurity, meal gaps, inventory, and public contextual signals while preserving source, date, grain, and known bias.',
  },
  {
    number: '02',
    icon: BrainCircuit,
    title: 'Prioritize a field check',
    body: 'An experimental block ensemble estimates where visible outreach demand may concentrate. It does not measure food insecurity or meals required.',
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
    title: 'Recalculate food allocation',
    body: 'A Gamma-Poisson update can move the hotspots. Only field-updated zones become eligible for deterministic FEFO allocation.',
  },
];

const operatingLayers = [
  {
    number: '01',
    icon: Activity,
    eyebrow: 'See need',
    title: 'Start with food access, not assumptions.',
    body: 'Compare nutrition insecurity, meal gaps, benefit access, and retailer coverage. Outreach hotspots are kept separate and used only to choose where a current field check may help.',
    links: [
      { label: 'Community signals', href: '/signals' },
      { label: 'Response map', href: '/delivery' },
    ],
    tone: 'paper',
  },
  {
    number: '02',
    icon: Boxes,
    eyebrow: 'Know stock',
    title: 'Turn donated food into usable inventory.',
    body: 'Track what arrived, what is available, what expires first, and what already left the building. Parsel keeps the food ledger visible before it recommends another allocation.',
    links: [
      { label: 'Inventory', href: '/inventory' },
      { label: 'Donations', href: '/donations' },
      { label: 'Distributions', href: '/distributions' },
    ],
    tone: 'signal',
  },
  {
    number: '03',
    icon: ClipboardCheck,
    eyebrow: 'Decide response',
    title: 'Allocate only after the location is reviewed.',
    body: 'A reviewed aggregate observation can update the outreach map. Deterministic FEFO then moves earlier-expiring food first while the operator remains responsible for approval and handoff.',
    links: [
      { label: 'Live Delivery', href: '/dispatch' },
      { label: 'Allocation', href: '/allocation' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
    tone: 'night',
  },
] as const;

const layerStyles = {
  paper: {
    section: 'bg-white text-[#071a2b]',
    accent: 'text-[#27875b]',
    icon: 'bg-[#071a2b] text-[#76d6a7]',
    body: 'text-slate-600',
    line: 'border-slate-200',
    link: 'border-slate-300 text-[#071a2b] hover:bg-[#071a2b] hover:text-white',
  },
  signal: {
    section: 'bg-[#dff2e7] text-[#071a2b]',
    accent: 'text-[#176b48]',
    icon: 'bg-[#3ca875] text-[#071a2b]',
    body: 'text-[#315c4b]',
    line: 'border-[#176b48]/25',
    link: 'border-[#176b48]/35 text-[#0b4b33] hover:bg-[#071a2b] hover:text-white',
  },
  night: {
    section: 'bg-[#071a2b] text-white',
    accent: 'text-[#76d6a7]',
    icon: 'bg-[#3ca875] text-[#071a2b]',
    body: 'text-slate-400',
    line: 'border-white/15',
    link: 'border-white/20 text-white hover:border-[#76d6a7] hover:text-[#76d6a7]',
  },
} as const;

const decisionSteps = [
  {
    number: '01',
    label: 'Prior',
    title: 'Choose where to verify',
    body: 'Historical model output remains planning-only.',
  },
  {
    number: '02',
    label: 'Review',
    title: 'Accept one aggregate observation',
    body: 'A person decides whether the count is suitable evidence.',
  },
  {
    number: '03',
    label: 'Allocate',
    title: 'Unlock the updated zone',
    body: 'Untouched priors cannot stage food or decrement inventory.',
  },
];

const boundaries = [
  'The historical hotspot prior estimates visible outreach demand, not food insecurity, eligibility, or meals required.',
  'A visible-person estimate is not identity, consent, or a complete census.',
  'PIT, 311, parking, enforcement, shelter capacity, and weather are context, not food need.',
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
            <ShieldCheck size={14} /> Food insecurity decision-support demo
          </div>
          <h1 className="mt-7 max-w-6xl text-5xl font-semibold leading-[0.91] tracking-[-0.06em] sm:text-7xl lg:text-[7.25rem]">
            Hunger is local.{' '}
            <span className="text-[#27875b]">Relief should be precise.</span>
          </h1>
          <div className="mt-9 grid gap-8 border-t border-slate-200 pt-7 md:grid-cols-[1.15fr_.85fr] md:items-end">
            <p className="max-w-3xl text-xl leading-8 text-slate-600 sm:text-2xl sm:leading-9">
              Parsel connects food inventory, nutrition-insecurity data, a planning model, and
              reviewed drone observations to help operators decide what food to send, where, and when.
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

      <section id="platform" className="scroll-mt-20" aria-labelledby="platform-title">
        <div className="flex min-h-[72svh] items-center bg-[#f4f1e8]">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9b511b]">After the drone lands</p>
              <h2 id="platform-title" className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.94] tracking-[-0.055em] sm:text-7xl">
                Evidence becomes an operating decision.
              </h2>
            </div>
            <p className="max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">
              Parsel is not one heatmap. It connects the need outside, the food inside,
              and the person responsible for deciding what happens next.
            </p>
          </div>
        </div>

        {operatingLayers.map((layer) => {
          const styles = layerStyles[layer.tone];
          const Icon = layer.icon;

          return (
            <article key={layer.number} className={`flex min-h-[76svh] items-center border-t ${styles.line} ${styles.section}`}>
              <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.72fr_1.28fr] lg:items-end lg:gap-20">
                <div>
                  <div className="flex items-center gap-4">
                    <span className={`grid h-12 w-12 place-items-center rounded-full ${styles.icon}`}>
                      <Icon size={21} />
                    </span>
                    <p className={`text-xs font-bold uppercase tracking-[0.18em] ${styles.accent}`}>
                      {layer.number} · {layer.eyebrow}
                    </p>
                  </div>
                  <p className={`mt-10 font-mono text-[clamp(5rem,14vw,11rem)] leading-none tracking-[-0.08em] ${styles.accent}`} aria-hidden="true">
                    {layer.number}
                  </p>
                </div>

                <div>
                  <h3 className="max-w-3xl text-4xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl">
                    {layer.title}
                  </h3>
                  <p className={`mt-6 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8 ${styles.body}`}>
                    {layer.body}
                  </p>
                  <div className="mt-9 flex flex-wrap gap-3">
                    {layer.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold transition-colors ${styles.link}`}
                      >
                        {link.label} <ArrowRight size={15} />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section id="feedback-loop" className="flex min-h-[100svh] scroll-mt-20 items-center bg-[#071a2b] text-white">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#76d6a7]">The adaptive feedback loop</p>
              <h2 className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.93] tracking-[-0.055em] sm:text-7xl">
                The model can move the map.
              </h2>
            </div>
            <p className="max-w-xl text-2xl font-semibold leading-tight text-[#76d6a7] sm:text-3xl">
              Only people move food.
            </p>
          </div>

          <ol className="mt-16 grid gap-px border border-white/15 bg-white/15 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map(({ number, icon: Icon, title, body }) => (
              <li key={number} className="bg-[#071a2b] p-6 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-[#3ca875] text-[#071a2b]">
                    <Icon size={20} />
                  </span>
                  <span className="font-mono text-4xl font-semibold tracking-[-0.08em] text-white/15">{number}</span>
                </div>
                <h3 className="mt-10 text-2xl font-semibold leading-tight">{title}</h3>
                <p className="mt-4 text-sm leading-6 text-slate-400">{body}</p>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid gap-4 border-t border-[#54b889]/35 pt-7 text-sm leading-6 text-slate-300 sm:grid-cols-[auto_1fr]">
            <ShieldCheck size={24} className="text-[#76d6a7]" />
            <p className="max-w-4xl">
              <strong className="text-white">One observation, one deliberate update.</strong>{' '}
              Adjacent frames contain many of the same people. Live Delivery waits for an operator
              to apply one stabilized aggregate count instead of multiplying people across frames.
            </p>
          </div>
        </div>
      </section>

      <section id="evidence" className="flex min-h-[100svh] scroll-mt-20 items-center bg-[#f2c46d] text-[#071a2b]">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#72400f]/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#72400f]">
            <TriangleAlert size={15} /> Decision gate
          </div>
          <h2 className="mt-8 max-w-6xl text-[clamp(4.25rem,11vw,9rem)] font-semibold leading-[0.82] tracking-[-0.07em]">
            No field evidence.
            <span className="mt-3 block text-[#9b511b]">No allocation.</span>
          </h2>
          <p className="mt-10 max-w-3xl text-lg leading-8 text-[#5f3b16] sm:text-xl">
            The current model estimates visible mobile-outreach demand. It does not diagnose
            hunger or authorize a distribution. A reviewed local observation is the gate between
            a planning prior and a food recommendation.
          </p>

          <ol className="mt-14 grid gap-px border border-[#72400f]/25 bg-[#72400f]/25 md:grid-cols-3">
            {decisionSteps.map((step) => (
              <li key={step.number} className="bg-[#f2c46d] p-6 sm:p-8">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.15em] text-[#72400f]">
                  {step.number} · {step.label}
                </p>
                <h3 className="mt-7 text-2xl font-semibold">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#5f3b16]">{step.body}</p>
              </li>
            ))}
          </ol>

          <Link href="/allocation" className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#071a2b] px-6 py-3.5 text-sm font-bold text-white hover:bg-[#123a54]">
            Inspect the allocation gate <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section id="human-control" className="flex min-h-[92svh] scroll-mt-20 items-center bg-[#f4f1e8]">
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[.8fr_1.2fr] lg:items-start lg:gap-20">
          <div className="lg:sticky lg:top-28">
            <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-[#27875b]">
              <HandHeart size={19} /> Human control is the product
            </div>
            <h2 className="mt-5 text-5xl font-semibold leading-[0.94] tracking-[-0.055em] sm:text-7xl">
              What stays human.
            </h2>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              Parsel shortens the distance between evidence and a decision. It does not remove
              the people accountable for consent, safety, food quality, dispatch, or handoff.
            </p>
          </div>

          <div>
            <ol className="border-y border-slate-300">
              {boundaries.map((boundary, index) => (
                <li key={boundary} className="grid gap-4 border-b border-slate-300 py-6 last:border-b-0 sm:grid-cols-[4rem_1fr] sm:items-start">
                  <span className="font-mono text-sm text-[#27875b]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-lg font-medium leading-7 text-slate-800">{boundary}</span>
                </li>
              ))}
            </ol>
            <div className="mt-8 flex items-start gap-4 border border-slate-300 bg-white p-5 text-sm leading-6 text-slate-600">
              <Warehouse size={20} className="mt-0.5 shrink-0 text-[#071a2b]" />
              <p>Real deployment still requires durable inventory and mission records, partner confirmation, calibrated coverage, and site-specific flight and safety review.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="closing" className="flex min-h-[72svh] scroll-mt-20 items-center border-y border-[#27875b] bg-[#3ca875]">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#0b3f2b]">
            <CheckCircle2 size={18} /> From evidence to food flow
          </div>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <h2 className="max-w-5xl text-5xl font-semibold leading-[0.92] tracking-[-0.055em] sm:text-7xl">
              Follow food from donation to verified allocation.
            </h2>
            <Link href="/login" className="inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-full bg-[#071a2b] px-7 py-4 text-sm font-bold text-white hover:bg-[#123a54]">
              Open Parsel <ArrowRight size={17} />
            </Link>
          </div>
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
