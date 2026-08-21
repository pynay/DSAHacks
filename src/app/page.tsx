import Link from 'next/link';
import CountUp from '@/components/landing/CountUp';
import DroneMissionStory from '@/components/landing/DroneMissionStory';
import Reveal from '@/components/landing/Reveal';
import ScrollProgress from '@/components/landing/ScrollProgress';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Database,
  ExternalLink,
  PackageOpen,
  RadioTower,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
  Users,
  Video,
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
    detail: 'At this scale, inventory, expiration, and location must connect. Parsel uses the outreach model only to choose where a current field check may improve a food decision.',
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

const eyePopSteps = [
  {
    number: '01',
    icon: RadioTower,
    label: 'Source',
    title: 'Bring in a camera feed',
    body: 'The local bridge accepts a webcam, a recorded file, or a DJI RTMP stream relayed through MediaMTX.',
  },
  {
    number: '02',
    icon: ScanLine,
    label: 'Infer',
    title: 'Run EyePop common objects',
    body: 'EyePop returns labels, boxes, and confidence for visible people, vehicles, and other scene objects.',
  },
  {
    number: '03',
    icon: ShieldCheck,
    label: 'Protect',
    title: 'Blur the served view',
    body: 'The continuous bridge uses face detections, plus a head-region fallback, to obscure faces in the MJPEG feed shown to operators.',
  },
  {
    number: '04',
    icon: Activity,
    label: 'Stabilize',
    title: 'Turn frames into telemetry',
    body: 'A low median over the last five inference counts reduces one-frame spikes. Brightness and drop-zone hazards drive GO, HOLD, or NO-GO.',
  },
  {
    number: '05',
    icon: ClipboardCheck,
    label: 'Review',
    title: 'Apply one aggregate count',
    body: 'The working delivery flow requires one operator capture. It sends count and confidence to the model, never a stream of repeated observations.',
  },
  {
    number: '06',
    icon: BrainCircuit,
    label: 'Adapt',
    title: 'Recompute the need surface',
    body: 'A Gamma-Poisson update changes nearby block intensity, recenters the hotspots, and informs the next food allocation.',
  },
] as const;

const implementationRows = [
  {
    icon: Video,
    state: 'LIVE BRIDGE',
    title: 'Continuous camera telemetry',
    body: 'Annotated MJPEG, people and vehicle counts, stabilized people, face blur status, frame brightness, source identity, and a drop-zone safety verdict.',
    status: 'Working now',
    tone: 'bg-[#071a2b] text-white',
    badge: 'bg-[#3ca875] text-[#071a2b]',
    muted: 'text-slate-400',
  },
  {
    icon: Camera,
    state: 'DELIVERY CAPTURE',
    title: 'Single-frame model update',
    body: 'At the destination, an operator takes or uploads one photo. EyePop counts the people in that frame, then Parsel saves only count, confidence, time, and model-update metadata.',
    status: 'Working now',
    tone: 'bg-[#dff2e7] text-[#071a2b]',
    badge: 'bg-[#071a2b] text-white',
    muted: 'text-[#315c4b]',
  },
  {
    icon: Database,
    state: 'INTEGRATION SEAM',
    title: 'Bridge count to reviewed evidence',
    body: 'The bridge and a tested occupancy-episode gate exist, but the live bridge does not automatically write to the model yet. That connection still needs operator review and calibrated coverage.',
    status: 'Next step',
    tone: 'bg-[#f2c46d] text-[#071a2b]',
    badge: 'bg-[#9b511b] text-white',
    muted: 'text-[#5f3b16]',
  },
] as const;

const savedData = [
  'Aggregate people count',
  'Maximum person confidence',
  'Observation time and coordinates',
  'Coverage, radius, and affected blocks',
];

const excludedData = [
  'Identity or face embedding',
  'Person-level movement history',
  'An inference of homelessness',
  'A claim about food eligibility or hunger',
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

      <header className="header-condense sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="header-shrink mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Parsel home" className="flex items-center gap-2.5">
            <PackageOpen size={25} className="text-[#3ca875]" />
            <span className="text-xl font-semibold tracking-tight">Parsel</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex" aria-label="Landing page">
            <a href="#case-for-action" className="hover:text-[#071a2b]">Why now</a>
            <a href="#drone-concept" className="hover:text-[#071a2b]">Drone mission</a>
            <a href="#eyepop-workflow" className="hover:text-[#071a2b]">How EyePop works</a>
          </nav>
          <Link
            href="/dispatch"
            className="group inline-flex items-center gap-2 rounded-full bg-[#071a2b] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#123a54]"
          >
            Open live delivery <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <ScrollProgress />
      </header>

      <section id="main-story" className="flex min-h-[calc(100svh-5rem)] items-center border-b border-slate-200 bg-white">
        <div className="hero-recede mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="hero-rise inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#176b48]">
            <ScanLine size={14} /> EyePop-powered field sensing for food relief
          </div>
          <h1 className="hero-rise font-display mt-7 max-w-6xl text-6xl font-semibold leading-[0.9] tracking-[-0.045em] sm:text-8xl lg:text-[7.8rem]" style={{ ['--rise-delay' as string]: '90ms' }}>
            See the field.
            <span className="hero-underline mt-2 block text-[#27875b]">Update the plan.</span>
          </h1>

          <div className="hero-rise mt-10 grid max-w-5xl gap-6 border-t border-slate-200 pt-7 md:grid-cols-[1.15fr_.85fr] md:gap-12" style={{ ['--rise-delay' as string]: '200ms' }}>
            <p className="text-xl leading-8 text-slate-700 sm:text-2xl sm:leading-9">
              Parsel turns a drone camera into a privacy-filtered field observation, then uses that evidence to improve where food support is planned.
            </p>
            <p className="text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">
              EyePop supplies the scene understanding. Parsel controls what gets stored, when the model changes, and what still requires a person.
            </p>
          </div>

          <div className="hero-rise mt-9 flex flex-wrap gap-3" style={{ ['--rise-delay' as string]: '330ms' }}>
            <a
              href="#eyepop-workflow"
              className="group inline-flex items-center gap-2 rounded-full bg-[#071a2b] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#123a54]"
            >
              See the EyePop workflow <ArrowDown size={17} className="transition-transform group-hover:translate-y-0.5" />
            </a>
            <Link
              href="/dispatch"
              className="group inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
            >
              Open live delivery <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
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
                  <Reveal>
                    <div className="flex items-center gap-4">
                      <span className={`grid h-11 w-11 place-items-center rounded-full border font-mono text-xs font-bold ${styles.index}`}>
                        {slide.number}
                      </span>
                      <p className={`text-xs font-bold uppercase tracking-[0.18em] ${styles.kicker}`}>
                        {slide.kicker}
                      </p>
                    </div>
                  </Reveal>
                  <Reveal variant="scale" delay={120}>
                    <p className={`font-display parallax-drift mt-12 whitespace-nowrap text-[clamp(5rem,16vw,13rem)] font-semibold leading-[0.8] tracking-[-0.05em] ${styles.stat}`}>
                      <CountUp value={slide.stat} />
                    </p>
                  </Reveal>
                </div>

                <div className="lg:pb-1">
                  <Reveal delay={150}>
                    <h2 id={`impact-slide-${slide.number}`} className="font-display text-3xl font-semibold leading-[1.05] tracking-[-0.03em] sm:text-5xl">
                      {slide.headline}
                    </h2>
                  </Reveal>
                  <Reveal delay={260}>
                    <p className={`mt-6 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8 ${styles.body}`}>
                      {slide.detail}
                    </p>
                  </Reveal>
                  <Reveal delay={370}>
                    <a
                      href={slide.href}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-10 inline-flex max-w-full items-start gap-2 border-t pt-4 text-xs font-semibold uppercase leading-5 tracking-[0.12em] ${styles.source}`}
                    >
                      <span>Source: {slide.source}</span>
                      <ExternalLink size={14} className="mt-0.5 shrink-0" />
                    </a>
                  </Reveal>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <DroneMissionStory />

      <section id="eyepop-workflow" className="scroll-mt-20 bg-[#f4f1e8]" aria-labelledby="eyepop-title">
        <div className="flex min-h-[82svh] items-center border-b border-slate-300">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-end lg:gap-20">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#27875b]">The product at the center</p>
              <h2 id="eyepop-title" className="font-display text-balance mt-5 max-w-5xl text-5xl font-semibold leading-[0.94] tracking-[-0.04em] sm:text-7xl">
                EyePop is the sensing layer.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-xl text-2xl font-semibold leading-tight text-[#27875b] sm:text-3xl">
                Parsel gives each observation a controlled path into a food decision.
              </p>
            </Reveal>
          </div>
        </div>

        <ol className="grid border-b border-slate-300 md:grid-cols-2 xl:grid-cols-3">
          {eyePopSteps.map(({ number, icon: Icon, label, title, body }, index) => (
            <li key={number} className="min-h-[25rem] border-b border-slate-300 p-7 md:border-r sm:p-10 xl:min-h-[29rem] xl:[&:nth-child(n+4)]:border-b-0 xl:[&:nth-child(3n)]:border-r-0">
              <Reveal delay={(index % 3) * 100}>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-[#071a2b] text-[#76d6a7]">
                    <Icon size={21} />
                  </span>
                  <span className="font-mono text-5xl font-semibold tracking-[-0.08em] text-slate-300">{number}</span>
                </div>
                <p className="mt-12 text-xs font-bold uppercase tracking-[0.18em] text-[#27875b]">{label}</p>
                <h3 className="mt-3 max-w-sm text-3xl font-semibold leading-tight">{title}</h3>
                <p className="mt-5 max-w-md text-base leading-7 text-slate-600">{body}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </section>

      <section id="implementation" className="scroll-mt-20 bg-white" aria-labelledby="implementation-title">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-10 lg:grid-cols-[1fr_.8fr] lg:items-end">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#27875b]">What is real in the repository</p>
              <h2 id="implementation-title" className="font-display text-balance mt-5 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-7xl">
                Two EyePop paths. One honest story.
              </h2>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-xl text-lg leading-8 text-slate-600">
                The live camera bridge and the model-updating delivery capture are both working. They are separate paths today, so the interface does not pretend that continuous telemetry is already autonomous evidence.
              </p>
            </Reveal>
          </div>

          <div className="mt-14 grid gap-4">
            {implementationRows.map(({ icon: Icon, state, title, body, status, tone, badge, muted }, index) => (
              <Reveal key={state} delay={index * 100}>
                <article className={`grid gap-8 rounded-[1.75rem] p-7 sm:p-9 lg:grid-cols-[.25fr_.8fr_1.55fr_auto] lg:items-center ${tone}`}>
                  <span className="grid h-12 w-12 place-items-center rounded-full border border-current/20">
                    <Icon size={21} />
                  </span>
                  <p className={`text-xs font-bold uppercase tracking-[0.17em] ${muted}`}>{state}</p>
                  <div>
                    <h3 className="text-2xl font-semibold">{title}</h3>
                    <p className={`mt-3 max-w-2xl text-sm leading-6 ${muted}`}>{body}</p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] ${badge}`}>{status}</span>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="stability" className="flex min-h-[96svh] scroll-mt-20 items-center bg-[#071a2b] text-white">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#76d6a7]/35 bg-[#54b889]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#76d6a7]">
              <Activity size={15} /> Evidence quality
            </div>
          </Reveal>
          <Reveal delay={120}>
            <h2 className="font-display text-balance parallax-drift mt-8 max-w-6xl text-[clamp(4rem,10vw,8.5rem)] font-semibold leading-[0.86] tracking-[-0.05em]">
              A frame is not a fact.
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-px border border-white/15 bg-white/15 lg:grid-cols-3">
            <div className="bg-[#071a2b] p-7 sm:p-9">
              <p className="font-mono text-6xl font-semibold tracking-[-0.08em] text-[#76d6a7]">5</p>
              <h3 className="mt-8 text-2xl font-semibold">Recent inference counts</h3>
              <p className="mt-4 text-sm leading-6 text-slate-400">The bridge takes the low median of a five-sample window so a single high detection cannot become the displayed stable count.</p>
            </div>
            <div className="bg-[#071a2b] p-7 sm:p-9">
              <p className="font-mono text-6xl font-semibold tracking-[-0.08em] text-[#f2c46d]">3s</p>
              <h3 className="mt-8 text-2xl font-semibold">Sustained clear zone</h3>
              <p className="mt-4 text-sm leading-6 text-slate-400">After a hazard leaves the marked landing area, the bridge waits through a clear hold before it can report GO.</p>
            </div>
            <div className="bg-[#071a2b] p-7 sm:p-9">
              <p className="font-mono text-6xl font-semibold tracking-[-0.08em] text-white">1</p>
              <h3 className="mt-8 text-2xl font-semibold">Reviewed model update</h3>
              <p className="mt-4 text-sm leading-6 text-slate-400">The working delivery mission applies one captured count. It does not multiply the same visible people across adjacent frames.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="model-update" className="flex min-h-[96svh] scroll-mt-20 items-center bg-[#3ca875] text-[#071a2b]">
        <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-20">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0b4b33]">What the count changes</p>
            <h2 className="font-display text-balance mt-5 text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-7xl">
              One count. One local model update.
            </h2>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#123f30]">
              Parsel combines the reviewed count, confidence, estimated camera coverage, and observation radius. Nearby block priors update, hotspot centers move, and the food planner gets a new local need estimate.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <ol className="overflow-hidden rounded-[1.75rem] border border-[#0b4b33]/25 bg-[#dff2e7]">
              {[
                ['01', 'EyePop result', 'people count + confidence'],
                ['02', 'Reviewed observation', 'time + location + coverage'],
                ['03', 'Gamma-Poisson update', 'nearby block intensity changes'],
                ['04', 'New operating view', 'hotspots + allocation recommendation'],
              ].map(([number, title, detail]) => (
                <li key={number} className="grid grid-cols-[3.5rem_1fr] gap-4 border-b border-[#0b4b33]/15 p-5 last:border-b-0 sm:grid-cols-[4rem_1fr_auto] sm:items-center sm:p-6">
                  <span className="font-mono text-sm font-bold text-[#176b48]">{number}</span>
                  <span className="text-lg font-semibold">{title}</span>
                  <span className="col-start-2 text-sm text-[#315c4b] sm:col-auto">{detail}</span>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section id="privacy" className="flex min-h-[96svh] scroll-mt-20 items-center bg-[#f4f1e8]">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
          <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:gap-20">
            <Reveal>
              <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-[0.18em] text-[#27875b]">
                <ShieldCheck size={19} /> Privacy and meaning
              </div>
              <h2 className="font-display text-balance mt-5 text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-7xl">
                Count the scene. Do not profile the person.
              </h2>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
                The system is designed around aggregate operational evidence. A visible person count can help plan a field check, but it cannot establish identity, housing status, consent, hunger, or eligibility.
              </p>
            </Reveal>

            <div className="grid gap-5 sm:grid-cols-2">
              <Reveal delay={120}>
                <div className="h-full border border-slate-300 bg-white p-6 sm:p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#27875b]">Saved with an accepted update</p>
                  <ul className="mt-7 space-y-5">
                    {savedData.map((item) => (
                      <li key={item} className="flex gap-3 text-sm font-medium leading-6 text-slate-700">
                        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#27875b]" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={220}>
                <div className="h-full border border-[#9b511b]/30 bg-[#f2c46d] p-6 sm:p-8">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#72400f]">Never treated as evidence</p>
                  <ul className="mt-7 space-y-5">
                    {excludedData.map((item) => (
                      <li key={item} className="flex gap-3 text-sm font-medium leading-6 text-[#5f3b16]">
                        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-[#9b511b]" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      <section id="closing" className="flex min-h-[76svh] scroll-mt-20 items-center border-y border-[#27875b] bg-[#071a2b] text-white">
        <div className="mx-auto w-full max-w-7xl px-5 py-20 sm:px-8">
          <Reveal>
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-[#76d6a7]">
              <Users size={18} /> EyePop observes. People decide.
            </div>
          </Reveal>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <Reveal delay={120}>
              <h2 className="font-display text-balance max-w-5xl text-5xl font-semibold leading-[0.94] tracking-[-0.04em] sm:text-7xl">
                Watch a field observation change the plan.
              </h2>
            </Reveal>
            <Link href="/dispatch" className="group inline-flex w-fit shrink-0 items-center justify-center gap-2 rounded-full bg-[#3ca875] px-7 py-4 text-sm font-bold text-[#071a2b] transition-colors hover:bg-[#76d6a7]">
              Open live delivery <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="flex items-center gap-2 font-semibold">
            <PackageOpen size={20} className="text-[#3ca875]" /> Parsel
          </span>
          <p className="text-sm text-slate-500">EyePop field sensing for human-controlled food-relief planning.</p>
          <Link href="/dispatch" className="inline-flex items-center gap-2 text-sm font-semibold">
            Open live delivery <ArrowRight size={14} />
          </Link>
        </div>
      </footer>
    </main>
  );
}
