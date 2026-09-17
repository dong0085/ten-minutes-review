import { SiteFooter } from "@/components/site-footer";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {children}
      <SiteFooter />
    </>
  );
}
