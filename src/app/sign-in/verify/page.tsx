import { safeNextPath } from "@/lib/auth/token";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "Continue sign in" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; next?: string | string[] }>;
}) {
  const sp = await searchParams;
  const token = Array.isArray(sp.token) ? sp.token[0] : sp.token;
  const next = Array.isArray(sp.next) ? sp.next[0] : sp.next;
  return <VerifyForm token={token ?? ""} next={safeNextPath(next)} />;
}
