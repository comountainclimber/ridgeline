"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name || "Athlete" }),
    });
    router.push("/routes");
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#07080A] px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        <Wordmark />
        <h1 className="font-display mt-6 italic text-4xl">Sign in</h1>
        <p className="mt-2 text-sm text-[#C9D6E3]">
          A name is enough to keep your library on this device. Clerk can be layered on later.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoFocus
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entering…" : "Continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
