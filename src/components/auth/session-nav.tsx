"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionUser = {
  email: string | null;
  displayName: string | null;
};

export function SessionNav() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((j) => setUser(j.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setUser(null);
    router.refresh();
  }

  if (user?.email) {
    return (
      <span className="flex items-center gap-4">
        <span className="max-w-[14rem] truncate">{user.email}</span>
        <button type="button" onClick={() => void signOut()} className="text-[#C9D6E3]">
          Sign out
        </button>
      </span>
    );
  }

  return <Link href="/sign-in">Sign in</Link>;
}
