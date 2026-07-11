"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      window.location.href = "/";
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        window.location.href = "/"; // logged in immediately (email confirmation off)
      } else {
        setInfo(
          "Account created. If sign-in fails, turn off “Confirm email” in Supabase (Authentication → Providers → Email), then sign in."
        );
        setMode("signin");
      }
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-3xl font-bold">Health</h1>
        <p className="mb-8 text-muted">5×5 workout &amp; sleep tracker</p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-xl bg-surface px-4 py-3 outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-xl bg-surface px-4 py-3 outline-none placeholder:text-muted focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
          >
            {loading
              ? "…"
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
          {error && <p className="text-sm text-accent">{error}</p>}
          {info && <p className="text-sm text-muted">{info}</p>}
        </form>

        <button
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
            setInfo(null);
          }}
          className="mt-4 text-sm text-muted"
        >
          {mode === "signin"
            ? "First time? Create an account"
            : "Have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
