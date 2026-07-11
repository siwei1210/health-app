"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold mb-1">Health</h1>
        <p className="text-muted mb-8">5×5 workout &amp; sleep tracker</p>

        {sent ? (
          <div className="rounded-2xl bg-surface p-5 text-center">
            <p className="text-lg font-semibold mb-1">Check your email</p>
            <p className="text-muted text-sm">
              We sent a magic sign-in link to
              <br />
              <span className="text-fg">{email}</span>
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-accent text-sm"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={signIn} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full rounded-xl bg-surface px-4 py-3 outline-none focus:ring-2 focus:ring-accent placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
            {error && <p className="text-accent text-sm">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
