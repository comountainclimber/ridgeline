"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Menu } from "lucide-react";
import { SessionNav } from "@/components/auth/session-nav";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/explore", label: "Picks" },
  { href: "/routes", label: "Library" },
  { href: "/merge", label: "Merge" },
] as const;

export function SiteHeader({
  overlay = false,
  showCta = true,
}: {
  overlay?: boolean;
  showCta?: boolean;
}) {
  return (
    <header
      className={cn(
        "z-10 flex items-center justify-between gap-3",
        overlay
          ? "absolute inset-x-0 top-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:p-6"
          : "px-4 py-4 md:px-6 md:py-5",
      )}
    >
      <div className={cn("min-w-0", overlay && "glass rounded-2xl px-4 py-3")}>
        <Wordmark />
      </div>
      <SiteNav overlay={overlay} showCta={showCta} />
    </header>
  );
}

export function SiteNav({
  overlay = false,
  showCta = true,
}: {
  overlay?: boolean;
  showCta?: boolean;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav
        className={cn(
          "hidden items-center gap-5 text-sm text-[#C9D6E3] md:flex",
          overlay && "glass rounded-2xl px-4 py-3",
        )}
      >
        {LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} active={pathname.startsWith(link.href)}>
            {link.label}
          </NavLink>
        ))}
        <SessionNav />
        {showCta ? (
          <Link
            href="/plan"
            className="rounded-full bg-[#E85D3A] px-4 py-2 text-[#F4F1EA]"
          >
            Open the planner
          </Link>
        ) : (
          <NavLink href="/plan" active={pathname.startsWith("/plan")}>
            Planner
          </NavLink>
        )}
      </nav>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className={cn(
              "text-[#F4F1EA] md:hidden",
              overlay && "glass size-11 rounded-2xl",
            )}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-full max-w-xs border-white/10 bg-[#12151A] p-0 text-[#F4F1EA] data-[side=right]:w-full"
        >
          <SheetHeader className="border-b border-white/10 pr-12">
            <SheetTitle className="font-display italic text-xl text-[#F4F1EA]">
              Ridgeline
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {LINKS.map((link) => (
              <SheetNavLink
                key={link.href}
                href={link.href}
                active={pathname.startsWith(link.href)}
              >
                {link.label}
              </SheetNavLink>
            ))}
            <SheetNavLink href="/plan" active={pathname.startsWith("/plan")}>
              Planner
            </SheetNavLink>
            <div className="mt-3 border-t border-white/10 px-1 pt-3">
              <SessionNav variant="menu" />
            </div>
            {showCta ? (
              <Link
                href="/plan"
                className="mt-4 flex min-h-11 items-center justify-center rounded-full bg-[#E85D3A] px-4 text-sm text-[#F4F1EA]"
              >
                Open the planner
              </Link>
            ) : null}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={active ? "text-[#F4F1EA]" : "text-[#C9D6E3]"}
    >
      {children}
    </Link>
  );
}

function SheetNavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-11 items-center rounded-xl px-3 text-base",
        active ? "bg-white/10 text-[#F4F1EA]" : "text-[#C9D6E3]",
      )}
    >
      {children}
    </Link>
  );
}
