"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.assign("/");
        return;
      }
      setError((await res.json()).error);
    } catch {
      setError("Couldn't reach tinkr. Try again.");
    }
    setBusy(false);
  };

  return (
    <main className="grid h-dvh place-items-center px-6">
      <form onSubmit={submit} className="w-full max-w-[20rem]">
        <p className="tinkr-wordmark mb-8">
          <span className="tinkr-mark" aria-hidden />
          tinkr.
        </p>
        <input
          className="tinkr-ask"
          type="password"
          value={password}
          placeholder="Password"
          aria-label="Password"
          autoComplete="current-password"
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="mt-4 flex items-center justify-between">
          <button type="submit" className="tinkr-pill" disabled={busy || !password}>
            Enter
          </button>
          <span className="text-[13px] text-warn" role="alert">{error}</span>
        </div>
      </form>
    </main>
  );
}
