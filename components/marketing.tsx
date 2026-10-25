import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ScanEye,
  AudioLines,
  Radio,
  ShieldCheck,
  Check,
} from "lucide-react";
export function Marketing({ page = "home" }: { page?: string }) {
  const title =
    page === "home"
      ? "The AI that shows you where to click."
      : page === "features"
        ? "Less friction. More possibility."
        : page === "how-it-works"
          ? "Don’t explain. Just show."
          : page === "pricing"
            ? "A little guidance goes a long way."
            : page === "download"
              ? "Your next step, always close."
              : page === "privacy"
                ? "Your screen stays yours."
                : "Built on trust.";
  return (
    <div className="marketing">
      <header>
        <Link href="/" className="logo">
          myn<span>.</span>
        </Link>
        <nav>
          <Link href="/features">Features</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <div>
          <Link href="/login">Sign in</Link>
          <Link href="/signup" className="button primary">
            Get started <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <span className="status-dot" /> YOUR REAL-TIME VISUAL AI COMPANION
          </div>
          <h1>{title}</h1>
          <p>
            {page === "privacy"
              ? "Screen sharing requires your explicit permission. MYN analyzes selected frames on demand and does not save screenshots. Questions, answers and summaries are stored in your private session history. Delete sessions or your account in settings. Audio is sent to OpenAI for transcription and synthesis."
              : page === "terms"
                ? "MYN provides AI-generated guidance that can be inaccurate. Review suggestions before taking action. You control your screen, microphone and all interactions. Billing requires a configured payment provider. These initial terms require legal review before public launch."
                : page === "download"
                  ? "MYN runs in your browser. Use your browser’s install menu to add it to your desktop. Screen sharing requires a compatible desktop browser and HTTPS. Native desktop apps are not available yet."
                  : "Share your screen. Ask anything. Get guidance from an AI that understands what you’re working on."}
          </p>
          <div className="hero-actions">
            <Link href="/try" className="button secondary">
              Experimentar interface
            </Link>
            <Link href="/signup" className="button primary">
              Get started free <ArrowRight size={17} />
            </Link>
            <Link href="/how-it-works" className="button secondary">
              See how MYN works
            </Link>
          </div>
        </section>
        {!["privacy", "terms", "download"].includes(page) && (
          <>
            <div className="hero-demo">
              <div className="demo-bar">
                <span>● ● ●</span>
                <span>YOUR WORKSPACE, WITH A LITTLE CLARITY</span>
                <span className="tiny-tag">ILLUSTRATIVE DEMO</span>
              </div>
              <div className="demo-content">
                <div>
                  <span className="eyebrow">A SHARED PERSPECTIVE</span>
                  <h2>
                    Big ambition.
                    <br />
                    Clear next steps.
                  </h2>
                  <p>
                    Keep your ideas moving.
                    <br />
                    MYN helps you find the way forward.
                  </p>
                  <div className="demo-task">
                    <Check size={16} /> Share your screen
                  </div>
                  <div className="demo-task">
                    <span className="status-dot" /> Get contextual guidance
                  </div>
                  <div className="demo-task muted">
                    3 &nbsp; Complete your task
                  </div>
                </div>
                <div className="demo-assistant">
                  <div className="orb" />
                  <span className="logo">myn.</span>
                  <p>“Let’s take it one step at a time.”</p>
                  <small>Illustration · No AI session running</small>
                </div>
              </div>
            </div>
            <section className="marketing-modes">
              {[
                [AudioLines, "Wake", "Think out loud."],
                [ScanEye, "Guide", "See it. Solve it."],
                [Radio, "Live", "Stay in the moment."],
              ].map(([Icon, name, text]) => {
                const I = Icon as typeof ScanEye;
                return (
                  <Link
                    href={"/app/" + String(name).toLowerCase()}
                    className="surface"
                    key={String(name)}
                  >
                    <I size={28} />
                    <h2>{String(name)}</h2>
                    <p>{String(text)}</p>
                    <ArrowUpRight size={18} />
                  </Link>
                );
              })}
            </section>
            <section className="how-steps">
              <h2>A simpler way to get there.</h2>
              {[
                "Share your screen",
                "Ask naturally",
                "Get guided",
                "Stay in flow",
                "Complete your task",
              ].map((s, i) => (
                <div key={s}>
                  <span>0{i + 1}</span>
                  <h3>{s}</h3>
                </div>
              ))}
            </section>
            <section className="pricing-grid">
              {[
                ["Free", "0", "Start exploring."],
                ["Pro", "10", "Make room for more."],
                ["Max", "19", "Go a little further."],
                ["Teams", "29", "Per seat. Shared workspaces coming later."],
              ].map(([plan, price, copy]) => (
                <div className="surface" key={plan}>
                  <span className="eyebrow">{plan}</span>
                  <h2>
                    ${price}
                    <small>/month</small>
                  </h2>
                  <p>{copy}</p>
                  <Link href="/signup" className="button secondary">
                    Get started <ArrowUpRight size={15} />
                  </Link>
                </div>
              ))}
            </section>
            <div className="final-cta">
              <ShieldCheck />
              <h2>Don’t explain. Just show.</h2>
              <Link href="/signup" className="button primary">
                Find your flow <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </main>
      <footer>
        <Link href="/" className="logo">
          myn.
        </Link>
        <span>Your everyday co-pilot.</span>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/download">Download</Link>
      </footer>
    </div>
  );
}
