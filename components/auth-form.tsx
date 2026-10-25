"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { browserDb } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
export function AuthForm({
  mode,
}: {
  mode: "login" | "signup" | "forgot-password";
}) {
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget),
      email = String(form.get("email")),
      password = String(form.get("password"));
    try {
      const client = browserDb();
      let result;
      if (mode === "signup")
        result = await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + "/auth/callback" },
        });
      else if (mode === "forgot-password")
        result = await client.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/auth/callback?type=recovery",
        });
      else result = await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (mode === "login") {
        router.push("/app");
        router.refresh();
      } else setNotice("Check your inbox to continue.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <Link href="/" className="logo">
        myn<span>.</span>
      </Link>
      <div className="auth-card">
        <span className="eyebrow">YOUR EVERYDAY CO-PILOT</span>
        <h1>
          {mode === "signup"
            ? "A new way to find your flow."
            : mode === "login"
              ? "Welcome back."
              : "Let’s get you back in."}
        </h1>
        <p>
          {mode === "signup"
            ? "Less figuring it out alone. More getting things done."
            : "Your next step is waiting."}
        </p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </label>
          {mode !== "forgot-password" && (
            <label>
              Password
              <input
                type="password"
                name="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
                minLength={8}
              />
            </label>
          )}
          <Button disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : "Send recovery email"}
          </Button>
        </form>
        <p role="alert" className="error">
          {error}
        </p>
        <p role="status">{notice}</p>
        {process.env.NEXT_PUBLIC_ENABLE_GOOGLE === "true" && (
          <Button
            variant="secondary"
            onClick={async () => {
              try {
                const { error } = await browserDb().auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo: location.origin + "/auth/callback" },
                });
                if (error) throw error;
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Google sign-in failed",
                );
              }
            }}
          >
            Continue with Google
          </Button>
        )}
        <div className="auth-links">
          <Link href="/try">Experimentar interface sem conta →</Link>
          <Link href={mode === "signup" ? "/login" : "/signup"}>
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </Link>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>
        <p className="fineprint">
          By continuing, you agree to our <Link href="/terms">Terms</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  );
}
