import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { SpaMount } from "@/spa/mount";
import "@/spa/styles.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Every signed-in screen is a React Router app. The layout stays mounted while
// its router moves between /classrooms, /account, and /admin, so the pages below
// only claim those paths for Next and render nothing. The theme provider renders
// here on the server so its inline script sets the dark class before first paint.
export default function AppLayout() {
  return (
    <ThemeProvider>
      <SpaMount />
    </ThemeProvider>
  );
}
