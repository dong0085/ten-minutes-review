import { SiteFooter } from "@/components/site-footer";
import { SmoothScroll } from "@/components/smooth-scroll";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SmoothScroll />
      {children}
      <SiteFooter />
    </>
  );
}
