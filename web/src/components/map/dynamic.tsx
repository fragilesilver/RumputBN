"use client";

import dynamic from "next/dynamic";

const loading = () => (
  <div className="flex h-full items-center justify-center bg-[#1f2a1f] text-sm text-white/70">Loading map…</div>
);

export const JobMap = dynamic(() => import("./JobMap"), { ssr: false, loading });
export const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), { ssr: false, loading });
