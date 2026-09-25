
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@tmr/ui/components/button";

export function CopyButton({ value }: { value: string }) {
  const t = useTranslations("Account");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={() => void onCopy()}>
      {copied ? t("linkCopied") : t("copyLink")}
    </Button>
  );
}
