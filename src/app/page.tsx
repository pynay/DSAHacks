import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight, BarChart3, Box, Boxes, BrainCircuit, CheckCircle2, ChevronRight,
  CircleDot, Database, Drone, HandHeart, HeartHandshake, Map, PackageCheck,
  Plane, Radar, Route, ScanSearch, ShieldCheck, Sparkles, TrendingUp, Warehouse,
} from 'lucide-react';

const workflow = [
  { number: '01', icon: Database, title: 'Understand the need', body: 'Parsel brings together neighborhood-level homelessness signals, 311 requests, shelter capacity, enforcement activity, weather, and historical counts into one honest data commons.' },
  { number: '02', icon: BrainCircuit, title: 'Predict where pressure is heading', body: 'A leakage-tested spatial ensemble estimates block-level demand and recomputes six movable hotspots, while the app clearly marks stale source data.' },
  { number: '03', icon: Drone, title: 'Verify on the ground', body: 'A camera-equipped drone or ground team can capture one reviewed EyePop count. The feedback layer updates nearby blocks and moves hotspot centers.' },
  { number: '04', icon: PackageCheck, title: 'Send the right amount', body: 'Parsel matches verified need with available, soonest-expiring inventory, then creates a clear distribution plan for every neighborhood.' },
];

const features = [
  { icon: BarChart3, title: 'One operational picture', body: 'Live KPIs, intake versus outflow, stock health, shelter capacity, and real San Diego need signals in one friendly dashboard.', href: '/dashboard', accent: 'bg-amber-100 text-amber-800' },
  { icon: Boxes, title: 'Inventory that thinks ahead', body: 'Track quantities, locations, reorder thresholds, and expiration dates. Parsel prioritizes food that should move first.', href: '/inventory', accent: 'bg-lime-100 text-lime-800' },
  { icon: HeartHandshake, title: 'Donations in, impact out', body: 'Log incoming donations and outgoing distributions while inventory updates automatically across the whole operation.', href: '/donations', accent: 'bg-rose-100 text-rose-800' },
  { icon: Map, title: 'Moving delivery hotspots', body: 'See model-derived downtown hotspots in 3D with need, requests, tents, vehicles, distance, terrain, and custom points.', href: '/delivery', accent: 'bg-sky-100 text-sky-800' },
  { icon: TrendingUp, title: 'Explainable allocation', body: 'Compare model demand and 311 context, split available stock proportionally, and stage distribution records with one click.', href: '/allocation', accent: 'bg-violet-100 text-violet-800' },
  { icon: ScanSearch, title: 'Food intake checks', body: 'Use EyePop object detection and a reviewable freshness check to flag questionable donations without replacing food-safety staff.', href: '/food-check', accent: 'bg-cyan-100 text-cyan-800' },
  { icon: Plane, title: 'Drone operations', body: 'View the live camera, receive an operator-facing clear or hold signal, and apply one stabilized aggregate count to the hotspot model.', href: '/drone', accent: 'bg-orange-100 text-orange-800' },
];

const technologyGroups = [
  { label: 'Product', icon: Box, items: ['Next.js 16', 'React 19', 'TypeScript', 'Tailwind CSS', 'Recharts'] },
  { label: 'Data + intelligence', icon: BrainCircuit, items: ['Python', 'DuckDB', 'scikit-learn', 'Stacked spatial ensemble', 'XGBoost'] },
  { label: 'Maps + feedback', icon: Radar, items: ['Mapbox GL', 'EyePop.ai', 'USGS elevation', 'GeoJSON', 'Gamma-Poisson updates'] },
  { label: 'Community signals', icon: Database, items: ['DSDP counts', 'Get It Done 311', 'HUD PIT', 'SDHC shelters', 'Parking activity'] },
];

export default function Home() {
  return (
    <main id="main-content" className="min-h-screen overflow-hidden bg-[#fffdf5] text-stone-900">
      <a href="#main-story" className="sr-only z-50 rounded-lg bg-stone-950 px-4 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to main content
      </a>
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Parsel home" className="inline-flex items-center">
            <Image src="/parsel-logo.png" alt="Parsel" width={1401} height={437} className="h-9 w-auto" preload />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-stone-600 md:flex" aria-label="Landing page">
            <a href="#how-it-works" className="transition hover:text-stone-950">How it works</a>
            <a href="#platform" className="transition hover:text-stone-950">Platform</a>
            <a href="#technology" className="transition hover:text-stone-950">Technology</a>
          </nav>
          <Link href="/dashboard" className="group inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600">
            Open Parsel <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      <section id="main-story" className="relative isolate min-h-[760px] scroll-mt-4 pt-32 sm:pt-40">
        <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_78%_30%,#fde68a_0,transparent_35%),radial-gradient(circle_at_15%_55%,#ecfccb_0,transparent_28%)]" />
        <div className="absolute -right-28 top-36 -z-10 h-96 w-96 rounded-full border border-amber-300/60" />
        <div className="absolute -right-10 top-52 -z-10 h-64 w-64 rounded-full border border-amber-400/50" />
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 sm:px-8 lg:grid-cols-[1.08fr_.92fr] lg:pb-32">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800 shadow-sm backdrop-blur"><Sparkles size={14} /> Food relief, precisely delivered</div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-stone-950 sm:text-6xl lg:text-7xl">Know where food is needed. <span className="text-amber-600">Move before hunger waits.</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-stone-600 sm:text-xl">Parsel helps food banks turn scattered community data and changing inventory into one clear answer: <strong className="font-semibold text-stone-900">what should go where, and when?</strong></p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/dashboard" className="group inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3.5 text-sm font-bold text-stone-950 shadow-lg shadow-amber-300/30 transition hover:-translate-y-0.5 hover:bg-amber-400">Explore the platform <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" /></Link>
              <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 px-6 py-3.5 text-sm font-semibold text-stone-700 transition hover:border-stone-500 hover:bg-white">See how it works <ChevronRight size={16} /></a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-stone-600">
              {['Built for food banks', 'Explainable recommendations', 'Real San Diego signals'].map((item) => <span key={item} className="flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-600" />{item}</span>)}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:mx-0">
            <div className="relative rounded-[2rem] border border-white/80 bg-stone-950 p-3 shadow-2xl shadow-stone-900/20">
              <div className="overflow-hidden rounded-[1.45rem] bg-[#1c1917] p-5 text-white sm:p-7">
                <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.17em] text-amber-400">Today&apos;s allocation</p><p className="mt-1 text-xl font-semibold">Downtown response plan</p></div><span className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Ready</span></div>
                <div className="relative mt-7 h-64 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#292524,#1c1917)]">
                  <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(#fbbf2420_1px,transparent_1px),linear-gradient(90deg,#fbbf2420_1px,transparent_1px)] [background-size:32px_32px]" />
                  <svg viewBox="0 0 500 250" className="absolute inset-0 h-full w-full" aria-hidden="true"><path d="M55 210 C135 175, 160 80, 255 136 S390 82, 455 42" fill="none" stroke="#fbbf24" strokeWidth="3" strokeDasharray="7 8" /><circle cx="55" cy="210" r="8" fill="#fbbf24" /><circle cx="255" cy="136" r="10" fill="#fb7185" /><circle cx="455" cy="42" r="13" fill="#a3e635" /></svg>
                  <div className="absolute left-5 top-5 rounded-xl border border-white/10 bg-black/40 px-3 py-2 backdrop-blur"><p className="text-[10px] uppercase tracking-wider text-stone-400">Predicted pressure</p><p className="mt-0.5 text-sm font-semibold text-lime-300">East Village ↑ 18%</p></div>
                  <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur"><Drone size={17} className="text-amber-400" /><div><p className="text-[10px] text-stone-400">Vision check</p><p className="text-xs font-semibold text-emerald-300">CLEAR TO DROP</p></div></div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">{[['1,240', 'units ready'], ['6', 'priority zones'], ['87%', 'need covered']].map(([value, label]) => <div key={label} className="rounded-xl bg-white/[0.06] p-3"><p className="text-lg font-semibold text-amber-300">{value}</p><p className="text-[11px] text-stone-400">{label}</p></div>)}</div>
              </div>
            </div>
            <div className="absolute -bottom-7 -left-5 hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-xl sm:block"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-lime-100 text-lime-700"><PackageCheck size={20} /></span><div><p className="text-xs text-stone-500">FEFO protected</p><p className="text-sm font-bold text-stone-900">Less food wasted</p></div></div></div>
          </div>
        </div>
      </section>

      <section className="border-y border-stone-200/80 bg-white" aria-label="Platform outcomes">
        <div className="mx-auto grid max-w-7xl divide-y divide-stone-200 px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
          {[['10', 'integrated source groups', 'One shared picture of demand'], ['3 months', 'forecast horizon', 'Time to prepare, not react'], ['Every unit', 'assigned transparently', 'No black-box allocation']].map(([value, label, note]) => <div key={label} className="px-4 py-8 sm:px-8"><p className="text-3xl font-semibold tracking-tight text-stone-950">{value}</p><p className="mt-1 text-sm font-semibold text-amber-700">{label}</p><p className="mt-2 text-sm text-stone-500">{note}</p></div>)}
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
          <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">The problem</p><h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.035em] text-stone-950 sm:text-5xl">Food banks have the heart. They need a clearer signal.</h2></div>
          <div className="space-y-6 text-lg leading-8 text-stone-600"><p>Need changes block by block and week by week. Donations arrive unevenly. Fresh food expires. Meanwhile, the information that could guide a better response lives across spreadsheets, public datasets, maps, and field observations.</p><p className="font-medium text-stone-900">That makes allocation one of the hardest parts of food relief: send too little and people go without; send too much and limited food, time, and transportation are wasted.</p><p>We built Parsel to give food-bank teams a friendly, evidence-informed co-pilot—one that respects their judgment while making the next best action easier to see.</p></div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-10 bg-stone-950 py-24 text-white sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-400">A closed loop from signal to service</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">From a super dataset to a smarter food drop.</h2><p className="mt-5 text-lg leading-8 text-stone-400">Parsel combines analysis, prediction, field verification, and inventory—so each decision gets better context.</p></div>
          <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-4">
            {workflow.map(({ number, icon: Icon, title, body }) => <article key={number} className="group bg-stone-950 p-7 transition hover:bg-stone-900"><div className="flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-400 text-stone-950"><Icon size={21} /></span><span className="font-mono text-xs text-stone-600">{number}</span></div><h3 className="mt-8 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-stone-400">{body}</p></article>)}
          </div>
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5 text-sm leading-6 text-stone-300"><ShieldCheck size={22} className="mt-0.5 shrink-0 text-amber-400" /><p><strong className="text-white">Human judgment stays in the loop.</strong> Drone vision can flag a questionable item for trained staff to remove safely; it does not autonomously discard food. Community signals are proxies—not individual tracking or a census.</p></div>
        </div>
      </section>

      <section id="platform" className="scroll-mt-10 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">Built around the whole food bank</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-stone-950 sm:text-5xl">One platform, from loading dock to drop zone.</h2></div><Link href="/dashboard" className="group inline-flex items-center gap-2 text-sm font-bold text-stone-900">View live console <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" /></Link></div>
          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{features.map(({ icon: Icon, title, body, href, accent }) => <Link key={title} href={href} className="group rounded-3xl border border-stone-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:border-amber-300 hover:shadow-xl hover:shadow-amber-100/50"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${accent}`}><Icon size={23} /></span><h3 className="mt-7 flex items-center justify-between text-xl font-semibold text-stone-950">{title}<ArrowRight size={17} className="text-stone-300 transition group-hover:translate-x-1 group-hover:text-amber-600" /></h3><p className="mt-3 text-sm leading-6 text-stone-600">{body}</p></Link>)}</div>
        </div>
      </section>

      <section className="bg-amber-400 py-20 sm:py-24">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-stone-700">Food quality, protected</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-stone-950 sm:text-5xl">Better allocation starts inside the warehouse.</h2><p className="mt-5 max-w-xl text-lg leading-8 text-stone-800">Before a delivery goes out, Parsel considers what is available and what expires first. Food Check uses EyePop to identify donated items and flag possible freshness concerns for safe staff review—keeping quality high and waste low.</p></div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[[ScanSearch, 'Vision-assisted checks', 'Flag quality concerns without replacing trained food-safety decisions.'], [Warehouse, 'Live availability', 'Know exactly what can be packed before promising a delivery.'], [Route, 'FEFO planning', 'Move soonest-expiring food first to protect every donation.'], [HandHeart, 'Right-sized drops', 'Match available food to verified neighborhood demand.']].map(([Icon, title, body]) => { const FeatureIcon = Icon as typeof ScanSearch; return <div key={title as string} className="rounded-2xl bg-stone-950 p-5 text-white"><FeatureIcon size={22} className="text-amber-400" /><h3 className="mt-4 font-semibold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-stone-400">{body as string}</p></div>; })}
          </div>
        </div>
      </section>

      <section id="technology" className="scroll-mt-10 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">Technology with a purpose</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] text-stone-950 sm:text-5xl">Modern tools. Practical answers.</h2><p className="mt-5 text-lg leading-8 text-stone-600">Every layer is chosen to make a food-bank decision faster, clearer, and easier to explain.</p></div>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{technologyGroups.map(({ label, icon: Icon, items }) => <div key={label} className="rounded-3xl border border-stone-200 bg-white p-6"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-800"><Icon size={19} /></span><h3 className="font-semibold text-stone-950">{label}</h3></div><ul className="mt-6 space-y-3 text-sm text-stone-600">{items.map((item) => <li key={item} className="flex items-center gap-2"><CircleDot size={11} className="text-amber-500" />{item}</li>)}</ul></div>)}</div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8 sm:pb-32">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-stone-950 px-6 py-16 text-center text-white sm:px-12 sm:py-20"><div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_15%_20%,#fbbf24_0,transparent_24%),radial-gradient(circle_at_85%_80%,#84cc16_0,transparent_20%)]" /><div className="relative mx-auto max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-400">Ready when your community needs you</p><h2 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Turn your food bank&apos;s data into more meals, delivered with confidence.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-stone-400">See the live Parsel demo and follow a donation from inventory to an explainable, need-based delivery plan.</p><Link href="/dashboard" className="group mt-9 inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3.5 text-sm font-bold text-stone-950 transition hover:bg-amber-300">Launch the demo <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></Link></div></div>
      </section>

      <footer className="border-t border-stone-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8"><Image src="/parsel-logo.png" alt="Parsel" width={1401} height={437} className="h-7 w-auto" /><p className="text-sm text-stone-500">Built for food banks—and the people they show up for.</p><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-800">Open console <ArrowRight size={14} /></Link></div></footer>
    </main>
  );
}
