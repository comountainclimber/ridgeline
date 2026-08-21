import type { Metadata } from "next";
import { MergeApp } from "@/components/gpx/merge-app";

export const metadata: Metadata = {
  title: "Merge GPX",
  description: "Combine GPX recordings into one track.",
};

export default function MergePage() {
  return <MergeApp />;
}
