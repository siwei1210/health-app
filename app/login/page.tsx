"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    // Full navigation so the middleware/layout pick up the new session cookie.
    window.location.href = "/";
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-3xl font-bold">Health</h1>
        <p className="mb-8 text-muted">5×5 workout &amp; sleep tracker</p>

        {step === "email" ? (
          <form onSubmit={sendCode} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-xl bg-surface px-4 py-3 outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Email me a code"}
            </button>
            {error && <p className="text-sm text-accent">{error}</p>}
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-3">
            <p className="text-sm text-muted">
              Enter the 6-digit code sent to{" "}
              <span className="text-fg">{email}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full rounded-xl bg-surface px-4 py-3 text-center text-2xl tracking-[0.5em] outline-none placeholder:text-muted placeholder:tracking-normal focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              disabled={loading || code.length < 6}
              className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify & sign in"}
            </button>
            {error && <p className="text-sm text-accent">{error}</p>}
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
              className="text-sm text-muted"
            >
              Use a different email
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
