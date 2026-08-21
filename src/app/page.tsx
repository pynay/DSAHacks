import Link from 'next/link';
import { ArrowRight, Boxes, Database, Map, PackageOpen, Plane, TrendingUp } from 'lucide-react';
import DroneScrollStory from '@/components/landing/DroneScrollStory';

const capabilities = [
  ['01', 'See the whole operation', 'Inventory, donations, distributions, shelter capacity, and neighborhood signals—together, not across five tools.', '/dashboard'],
  ['02', 'Forecast the next need', 'A backtested model projects 311 demand three months forward so teams can prepare instead of chase.', '/allocation'],
  ['03', 'Protect every donation', 'Expiration-aware inventory moves food that should ship first and shows exactly what remains.', '/inventory'],
  ['04', 'Verify before dispatch', 'Drone telemetry and computer vision add a current field signal before an operator approves a drop.', '/drone'],
];

const stack = ['Next.js', 'React', 'TypeScript', 'DuckDB', 'Python', 'scikit-learn', 'Mapbox GL', 'EyePop.ai'];

export default function Home() {
  return (
    <main id="main-content" className="min-h-screen bg-white text-[#071a2b]">
      <a href="#story" className="sr-only z-50 rounded-md bg-[#071a2b] px-4 py-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to main content</a>

      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Parsel home" className="flex items-center gap-2.5"><PackageOpen size={25} className="text-[#3ca875]" /><span className="text-xl font-semibold tracking-tight">Parsel</span></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex" aria-label="Landing page">
            <a href="#story" className="hover:text-[#071a2b]">Why Parsel</a>
            <a href="#system" className="hover:text-[#071a2b]">The system</a>
            <a href="#technology" className="hover:text-[#071a2b]">Technology</a>
          </nav>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full bg-[#071a2b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123a54]">Open console <ArrowRight size={15} /></Link>
        </div>
      </header>

      <section id="story" className="relative flex min-h-screen items-end overflow-hidden pb-16 pt-32 sm:items-center sm:pb-0">
        <div className="absolute right-[-12rem] top-[-10rem] h-[42rem] w-[42rem] rounded-full bg-[#dff5e9] blur-3xl" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-slate-200" />
        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#27875b]">Food relief intelligence</p>
          <h1 className="mt-6 max-w-6xl text-[clamp(3.75rem,9vw,8.75rem)] font-semibold leading-[0.86] tracking-[-0.065em] text-[#071a2b]">
            Less guessing.<br /><span className="text-[#3ca875]">More food where it matters.</span>
          </h1>
          <div className="mt-10 flex flex-col justify-between gap-8 border-t border-slate-200 pt-7 sm:flex-row sm:items-end">
            <p className="max-w-xl text-lg leading-8 text-slate-600">Parsel gives food banks one evidence-based path from changing community need to a right-sized, operator-approved delivery.</p>
            <Link href="#system" className="group inline-flex items-center gap-3 self-start text-sm font-semibold text-[#071a2b] sm:self-auto">See the system <span className="grid h-10 w-10 place-items-center rounded-full border border-slate-300 transition group-hover:border-[#3ca875] group-hover:bg-[#3ca875] group-hover:text-white"><ArrowRight size={16} /></span></Link>
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-36">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#27875b]">The problem</p>
          <div><h2 className="text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-6xl">Food is available. Need is visible. The connection between them is still too slow.</h2><div className="mt-10 grid gap-8 text-lg leading-8 text-slate-600 sm:grid-cols-2"><p>Food-bank teams work across changing inventory, expiration windows, uneven donations, and neighborhood demand that can shift faster than a monthly report.</p><p>Parsel combines those signals without pretending they are perfect. It makes the tradeoffs visible, keeps people in control, and helps every unit travel with purpose.</p></div></div>
        </div>
      </section>

      <DroneScrollStory />

      <section id="system" className="scroll-mt-8 bg-[#f3f7f8] py-24 sm:py-36">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#27875b]">One connected system</p><h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-7xl">Everything an allocation decision needs. Nothing it doesn&apos;t.</h2></div>
          <div className="mt-16 border-t border-slate-300">
            {capabilities.map(([number, title, body, href]) => <Link key={number} href={href} className="group grid gap-4 border-b border-slate-300 py-8 transition sm:grid-cols-[5rem_0.8fr_1.2fr_2rem] sm:items-center"><span className="font-mono text-xs text-[#27875b]">{number}</span><h3 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h3><p className="max-w-xl leading-7 text-slate-600">{body}</p><ArrowRight className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#27875b]" size={20} /></Link>)}
          </div>
        </div>
      </section>

      <section className="bg-[#071a2b] py-24 text-white sm:py-36">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:items-center">
          <div><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#54b889]">The operating picture</p><h2 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl">Real San Diego signals. Clear limits. Useful action.</h2><p className="mt-7 max-w-xl text-lg leading-8 text-slate-300">The data commons unifies eight-plus public and challenge sources while keeping lineage and known bias attached. Signals guide relative allocation; they are never presented as individual tracking or a census.</p><Link href="/dashboard" className="mt-9 inline-flex items-center gap-3 font-semibold text-[#76d6a7]">Explore the data <ArrowRight size={18} /></Link></div>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10">
            {[[Database, '8+', 'data sources'], [TrendingUp, '3 mo.', 'forecast horizon'], [Map, '6', 'downtown zones'], [Plane, '1', 'verified route']].map(([Icon, value, label]) => { const StatIcon = Icon as typeof Database; return <div key={label as string} className="bg-[#0b2538] p-7 sm:p-9"><StatIcon className="text-[#54b889]" size={20} /><p className="mt-8 text-4xl font-semibold">{value as string}</p><p className="mt-2 text-sm text-slate-400">{label as string}</p></div>; })}
          </div>
        </div>
      </section>

      <section id="technology" className="scroll-mt-8 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#27875b]">Technology</p><div className="mt-8 grid border-l border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-4">{stack.map((item) => <div key={item} className="flex min-h-32 items-end border-b border-r border-slate-200 p-5 text-xl font-semibold tracking-tight">{item}</div>)}</div><p className="mt-8 max-w-2xl leading-7 text-slate-600">Plus Recharts, GeoJSON, USGS elevation, HUD PIT counts, DSDP data, Get It Done 311, shelter capacity, and a deterministic FEFO allocation engine.</p></div>
      </section>

      <section className="px-5 pb-24 sm:px-8 sm:pb-32"><div className="mx-auto max-w-7xl rounded-[2rem] bg-[#3ca875] px-6 py-16 sm:px-14 sm:py-20"><Boxes size={28} className="text-[#071a2b]" /><h2 className="mt-12 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] text-[#071a2b] sm:text-7xl">Put the next delivery on stronger evidence.</h2><Link href="/dashboard" className="mt-10 inline-flex items-center gap-3 rounded-full bg-[#071a2b] px-6 py-3.5 font-semibold text-white">Open Parsel <ArrowRight size={17} /></Link></div></section>

      <footer className="border-t border-slate-200"><div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span className="flex items-center gap-2 font-semibold"><PackageOpen size={20} className="text-[#3ca875]" />Parsel</span><p className="text-sm text-slate-500">Built for food banks—and the people they show up for.</p><Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold">Open console <ArrowRight size={14} /></Link></div></footer>
    </main>
  );
}
