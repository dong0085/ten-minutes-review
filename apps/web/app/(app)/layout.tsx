import type { Metadata } from "next";
import { SpaMount } from "@/spa/mount";
import "@/spa/styles.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Every signed-in screen is a React Router app. The layout stays mounted while
// its router moves between /classrooms, /account, and /admin, so the pages below
// only claim those paths for Next and render nothing.
export default function AppLayout() {
  return <SpaMount />;
}
