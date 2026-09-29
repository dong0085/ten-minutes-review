"use client";

import dynamic from "next/dynamic";

// The router reads window.location as it loads, so the app renders only in the browser.
const SpaRoot = dynamic(() => import("./root"), { ssr: false });

export function SpaMount() {
  return (
    <div className="flex min-h-screen flex-col">
      <SpaRoot />
    </div>
  );
}
