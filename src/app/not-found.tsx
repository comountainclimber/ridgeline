import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#07080A] text-[#F4F1EA]">
      <div className="text-center">
        <Wordmark />
        <h1 className="font-display mt-8 italic text-5xl">Off route</h1>
        <p className="mt-3 text-[#C9D6E3]">That ridge isn&apos;t on the map.</p>
        <Link href="/plan" className="mt-6 inline-block text-[#E85D3A]">
          Back to the planner
        </Link>
      </div>
    </div>
  );
}
