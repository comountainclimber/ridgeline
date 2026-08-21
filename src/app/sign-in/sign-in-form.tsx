"use client";

import { useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/magic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Could not send a link.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#07080A] px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        <Wordmark />
        <h1 className="font-display mt-6 italic text-4xl">Sign in</h1>
        {sent ? (
          <p className="mt-2 text-sm text-[#C9D6E3]">
            Check {email} for a link. It expires in 15 minutes. Saving still works on this
            device in the meantime.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-[#C9D6E3]">
              Saving already works on this device. Email a link to keep your library when you
              switch browsers.
            </p>
            <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus
                required
              />
              {error && <p className="text-sm text-[#E85D3A]">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Email me a link"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
