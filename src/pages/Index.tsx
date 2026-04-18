import { WaitlistForm } from "@/components/WaitlistForm";
import { Lock, FileCheck2, Zap, Database } from "lucide-react";

const Index = () => {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--gradient-hero)" }}
      >
        {/* Decorative grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-primary)" }}
        />

        <div className="container relative mx-auto grid gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28 lg:py-32">
          <div className="text-primary-foreground">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/80" />
              Early access — request an invite
            </div>

            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
              The marketplace for{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "var(--gradient-primary)" }}
              >
                structured data
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-primary-foreground/75 md:text-lg">
              Uber4Data connects data sellers with verified buyers. Compliant,
              anonymised, and priced by the record.
            </p>

            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-primary-foreground/70">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60" />
                GDPR-aware pipelines
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60" />
                Auto-generated licences
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/60" />
                Per-record pricing
              </li>
            </ul>
          </div>

          <div className="md:pl-6">
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Trust section */}
      <section className="border-t border-border bg-background py-20 md:py-28">
        <div className="container mx-auto px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Built for trust
            </p>
            <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              A safer way to exchange data
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">
              Every dataset on Uber4Data is anonymised, scored, and licensed
              before it ever reaches a buyer.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Lock className="h-5 w-5" />}
              title="Anonymisation first"
              body="Every dataset is processed and risk-scored before it reaches buyers."
            />
            <FeatureCard
              icon={<FileCheck2 className="h-5 w-5" />}
              title="Licensing built in"
              body="Each transaction generates a legal data usage licence automatically."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Instant delivery"
              body="After payment, buyers receive access immediately — no back and forth."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/40 py-10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Uber4Data</span>
            <span>· The marketplace for structured data</span>
          </div>
          <p>© {new Date().getFullYear()} Uber4Data. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
};

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

export default Index;
