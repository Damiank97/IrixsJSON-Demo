"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setError(result?.error || "Inloggen is niet gelukt.");
      setBusy(false);
      return;
    }

    const requested = new URLSearchParams(window.location.search).get("next") || "/";
    window.location.replace(requested.startsWith("/") && !requested.startsWith("//") ? requested : "/");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(253,185,64,0.20),transparent_24%),radial-gradient(circle_at_20%_85%,rgba(106,83,142,0.18),transparent_30%)]" />
      <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white/90 p-7 shadow-[0_28px_80px_rgba(52,12,70,0.16)] backdrop-blur md:p-9">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent font-mono text-sm font-medium text-brand-yellow">IT</span>
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-brand-yellow-dark">Irixs</p>
            <p className="text-sm font-semibold text-accent">Toolbox <span className="font-normal text-muted">(By Damian)</span></p>
          </div>
        </div>

        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-brand-purple">Interne toegang</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tightest text-accent">Welkom terug.</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Vul het wachtwoord in om de Irixs Toolbox te openen.</p>

        <form onSubmit={login} className="mt-8 space-y-5">
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold text-accent">Wachtwoord</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-12 w-full rounded-xl border border-rule bg-white px-4 text-base text-accent shadow-sm transition placeholder:text-muted/60 focus:border-brand-purple focus:outline-none focus:ring-4 focus:ring-brand-purple/10"
              placeholder="Vul je wachtwoord in"
              required
            />
          </div>

          {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{error}</p>}

          <button type="submit" disabled={busy} className="tool-button-primary w-full">
            {busy ? "Even controleren…" : "Toolbox openen"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">Alleen voor intern gebruik.</p>
      </section>
    </main>
  );
}
