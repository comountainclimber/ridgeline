import Link from "next/link";
import { cn } from "@/lib/utils";

export function Wordmark({
  href = "/",
  className,
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-display italic tracking-tight text-snow text-xl leading-none",
        className,
      )}
      style={{ color: "#F4F1EA" }}
    >
      Ridgeline
    </Link>
  );
}
