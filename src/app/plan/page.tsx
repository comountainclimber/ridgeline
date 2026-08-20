"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";

const PlannerApp = dynamic(
  () => import("@/components/planner/planner-app").then((m) => m.PlannerApp),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-dvh place-items-center bg-[#07080A] text-[#C9D6E3]">
        Raising the ridge…
      </div>
    ),
  },
);

export default function PlanPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-dvh place-items-center bg-[#07080A] text-[#C9D6E3]">
          Raising the ridge…
        </div>
      }
    >
      <PlannerApp />
    </Suspense>
  );
}
