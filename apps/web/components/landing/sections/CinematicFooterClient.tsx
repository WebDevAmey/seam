"use client";
import dynamic from "next/dynamic";

const CinematicFooter = dynamic(() => import("./CinematicFooter").then((mod) => mod.CinematicFooter), {
  ssr: false,
  loading: () => <div className="h-screen w-full bg-[#0D0D0D]" aria-hidden="true" />,
});

export { CinematicFooter };
