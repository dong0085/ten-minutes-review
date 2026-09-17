"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    goatcounter?: {
      count: (vars?: { path?: string }) => void;
    };
  }
}

/**
 * Loads GoatCounter's count.js and reports client-side navigations to it.
 * count.js reports the initial page load on its own and skips localhost
 * traffic; the pathname effect covers App Router transitions, which count.js
 * leaves to the app.
 */
export function GoatCounterAnalytics({ endpoint }: { endpoint: string }) {
  const pathname = usePathname();
  const initialLoad = useRef(true);

  useEffect(() => {
    if (initialLoad.current) {
      initialLoad.current = false;
      return;
    }
    window.goatcounter?.count({ path: pathname + location.search });
  }, [pathname]);

  return (
    <Script
      src="https://gc.zgo.at/count.js"
      data-goatcounter={endpoint}
      strategy="afterInteractive"
    />
  );
}
