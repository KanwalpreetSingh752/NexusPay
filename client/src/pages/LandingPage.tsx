import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  Code2,
  CreditCard,
  Globe2,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from 'lucide-react';

const featureCards = [
  {
    icon: BarChart3,
    title: 'Payment intelligence',
    description: 'Track balances, settlements, and payment performance from one clear dashboard.',
  },
  {
    icon: WalletCards,
    title: 'Flexible checkout',
    description: 'Give customers a fast, reliable checkout experience across modern payment methods.',
  },
  {
    icon: Globe2,
    title: 'Built for scale',
    description: 'Connect your business to the payment rails and currencies your customers use.',
  },
  {
    icon: LockKeyhole,
    title: 'Secure by design',
    description: 'Idempotency, signed webhooks, and resilient workflows protect every transaction.',
  },
];

export const LandingPage: React.FC = () => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const landingRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const landing = landingRef.current;
    if (!landing) return;

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const updateCursor = () => {
      landing.style.setProperty('--cursor-x', `${pointerX}px`);
      landing.style.setProperty('--cursor-y', `${pointerY}px`);
      frame = 0;
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      landing.style.setProperty('--cursor-opacity', '1');
      if (!frame) {
        frame = window.requestAnimationFrame(updateCursor);
      }
    };

    const handlePointerLeave = () => {
      landing.style.setProperty('--cursor-opacity', '0');
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    landing.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      landing.removeEventListener('pointerleave', handlePointerLeave);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={landingRef} className="landing-page min-h-screen overflow-hidden bg-[#080909] text-white">
      <header className="landing-shell sticky top-0 z-30 border-b border-white/[0.08] bg-[#080909]/90 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white text-black">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-[0.18em]">NEXUSPAY</span>
          </Link>

          <div className="hidden items-center gap-8 text-xs text-white/55 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#security" className="transition hover:text-white">Security</a>
            <a href="#developers" className="transition hover:text-white">Developers</a>
            <a href="#support" className="transition hover:text-white">Support</a>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <Link to="/login" className="text-xs text-white/70 transition hover:text-white">Log in</Link>
            <Link to="/register" className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition hover:bg-white/85">
              Start building
            </Link>
          </div>

          <button
            type="button"
            className="rounded-lg border border-white/10 p-2 text-white/70 md:hidden"
            aria-label="Toggle navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
        {menuOpen && (
          <div className="border-t border-white/[0.08] px-5 py-5 md:hidden">
            <div className="flex flex-col gap-5 text-sm text-white/65">
              <a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
              <a href="#security" onClick={() => setMenuOpen(false)}>Security</a>
              <a href="#developers" onClick={() => setMenuOpen(false)}>Developers</a>
              <a href="#support" onClick={() => setMenuOpen(false)}>Support</a>
              <div className="flex items-center gap-4 border-t border-white/10 pt-5">
                <Link to="/login" onClick={() => setMenuOpen(false)}>Log in</Link>
                <Link to="/register" onClick={() => setMenuOpen(false)} className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black">
                  Start building
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="landing-grid relative mx-auto max-w-7xl px-5 pb-24 pt-20 sm:px-8 sm:pt-28 lg:pb-32 lg:pt-36">
          <div className="relative z-10 max-w-2xl">
            <div className="landing-reveal landing-delay-1 mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/55">
              <Sparkles className="h-3 w-3 text-white/80" />
              The modern payment gateway
            </div>
            <h1 className="landing-reveal landing-delay-2 max-w-3xl text-5xl font-light leading-[1.05] tracking-[-0.06em] text-white sm:text-8xl">
              Payments that move
              <span className="block text-white/35">your business forward.</span>
            </h1>
            <p className="landing-reveal landing-delay-3 mt-7 max-w-lg text-base leading-7 text-white/45 sm:text-lg">
              NexusPay gives modern businesses the infrastructure to accept payments,
              manage money, and grow with confidence.
            </p>
            <div className="landing-reveal landing-delay-4 mt-9 flex flex-wrap items-center gap-3">
              <Link to="/register" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-medium text-black transition hover:bg-white/85">
                Create your account <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#developers" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-xs text-white/75 transition hover:border-white/35 hover:text-white">
                Explore the platform
              </a>
            </div>
          </div>

          <div className="hero-orbit pointer-events-none absolute -right-32 top-12 hidden h-[500px] w-[500px] rounded-full border border-white/[0.08] lg:block">
            <div className="absolute inset-16 rounded-full border border-white/[0.08]" />
            <div className="absolute inset-32 rounded-full border border-white/[0.08]" />
            <div className="hero-core absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-3xl border border-white/20 bg-white/[0.07] shadow-2xl shadow-black">
              <CreditCard className="h-8 w-8 text-white/70" />
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-24 sm:px-8 lg:pb-32">
          <div className="mb-10 flex items-end justify-between border-b border-white/[0.08] pb-5">
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-white/35">One platform</p>
              <h2 className="text-2xl font-light tracking-[-0.04em] sm:text-4xl">Powerful tools for modern payments</h2>
            </div>
            <ChevronDown className="mb-1 hidden h-5 w-5 rotate-[-45deg] text-white/30 sm:block" />
          </div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.09] bg-white/[0.09] sm:grid-cols-2 lg:grid-cols-4">
            {featureCards.map(({ icon: Icon, title, description }) => (
              <article key={title} className="landing-card bg-[#0d0e0e] p-6 transition hover:bg-[#121414]">
                <Icon className="mb-16 h-5 w-5 text-white/60" />
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="mt-3 text-xs leading-6 text-white/40">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="security" className="border-y border-white/[0.08] bg-[#0c0d0d]">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.2fr] lg:py-32">
            <div>
              <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/35">Reliability & ecosystem</p>
              <h2 className="max-w-md text-3xl font-light leading-tight tracking-[-0.05em] sm:text-5xl">
                Infrastructure you can build your business on.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-white/40">
                From first payment to global scale, NexusPay keeps your money moving with
                secure, observable, and resilient payment workflows.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['99.9%', 'Historical uptime for services'],
                ['4.7%', 'Average conversion lift'],
                ['24/7', 'Transaction monitoring'],
                ['1 API', 'Every payment workflow'],
              ].map(([value, label]) => (
                <div key={label} className="landing-card rounded-2xl border border-white/[0.09] bg-white/[0.03] p-6">
                  <p className="text-4xl font-light tracking-[-0.05em]">{value}</p>
                  <p className="mt-2 text-sm text-white/40">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="developers" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8 lg:py-32">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 rounded-2xl border border-white/[0.1] bg-[#0c0d0d] p-5 shadow-2xl shadow-black/30 lg:order-1">
              <div className="mb-5 flex items-center gap-2 border-b border-white/[0.08] pb-4 text-[10px] text-white/35">
                <Code2 className="h-3.5 w-3.5" /> nexuspay / create-payment.ts
              </div>
              <pre className="overflow-x-auto text-sm leading-7 text-white/60"><code>{`const payment = await nexuspay.payments.create({
  amount: 12500,
  currency: 'INR',
  customer: customer.id,
  idempotencyKey: request.id,
});`}</code></pre>
              <div className="mt-5 flex items-center gap-2 border-t border-white/[0.08] pt-4 text-[10px] text-emerald-400/80">
                <Check className="h-3.5 w-3.5" /> Payment intent created successfully
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <p className="mb-4 text-[11px] uppercase tracking-[0.2em] text-white/35">Built for developers</p>
              <h2 className="max-w-lg text-3xl font-light leading-tight tracking-[-0.05em] sm:text-5xl">
                One simple API. Every way to get paid.
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-white/40">
                Launch quickly with predictable APIs, clear webhooks, and the tools you
                need to create payment experiences your customers will trust.
              </p>
              <Link to="/register" className="mt-8 inline-flex items-center gap-2 text-xs text-white underline decoration-white/25 underline-offset-8 transition hover:decoration-white">
                Read the developer docs <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section id="support" className="border-t border-white/[0.08] px-5 py-24 text-center sm:px-8 lg:py-32">
          <p className="mb-4 text-[10px] uppercase tracking-[0.2em] text-white/35">Ready when you are</p>
          <h2 className="mx-auto max-w-2xl text-4xl font-light tracking-[-0.06em] sm:text-6xl">Build the future of payments.</h2>
          <p className="mx-auto mt-6 max-w-md text-sm leading-7 text-white/40">Start with a free sandbox account and take your first payment in minutes.</p>
          <Link to="/register" className="mt-9 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-medium text-black transition hover:bg-white/85">
            Get started with NexusPay <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-white/[0.08] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-xs text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} NexusPay. Payment infrastructure for modern businesses.</span>
          <div className="flex gap-5">
            <Link to="/login" className="transition hover:text-white/70">Log in</Link>
            <Link to="/register" className="transition hover:text-white/70">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
