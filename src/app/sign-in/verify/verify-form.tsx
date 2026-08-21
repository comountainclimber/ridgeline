"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export function VerifyForm({ token, next }: { token: string; next: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : "Missing sign-in link.");

  async function continueSignIn() {
    if (!token) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/magic/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, next }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(json.error ?? "That link expired or was already used.");
      return;
    }
    router.push(typeof json.next === "string" ? json.next : next);
    router.refresh();
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#07080A] px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        <Wordmark />
        <h1 className="font-display mt-6 italic text-4xl">Continue</h1>
        <p className="mt-2 text-sm text-[#C9D6E3]">
          Finish signing in to keep this device’s library on your account.
        </p>
        {error && <p className="mt-4 text-sm text-[#E85D3A]">{error}</p>}
        <Button
          className="mt-6 w-full"
          disabled={loading || !token}
          onClick={() => void continueSignIn()}
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </div>
    </div>
  );
}
