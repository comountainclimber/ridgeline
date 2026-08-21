"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionUser = {
  email: string | null;
  displayName: string | null;
};

export function SessionNav({
  variant = "inline",
}: {
  variant?: "inline" | "menu";
}) {
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

  if (variant === "menu") {
    if (user?.email) {
      return (
        <div className="space-y-1">
          <p className="truncate px-3 text-sm text-[#9AA8B5]">{user.email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-base text-[#C9D6E3]"
          >
            Sign out
          </button>
        </div>
      );
    }
    return (
      <Link
        href="/sign-in"
        className="flex min-h-11 items-center rounded-xl px-3 text-base text-[#F4F1EA]"
      >
        Sign in
      </Link>
    );
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
