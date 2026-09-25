
import { useState } from "react";
import { useTranslations } from "use-intl";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { readError } from "@/lib/read-error";

export function BillingButton({ action }: { action: "checkout" | "portal" }) {
  const t = useTranslations("Account");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/billing/${action}`, { method: "POST" });
      if (!response.ok) {
        throw new Error((await readError(response)) ?? t("billingError"));
      }
      const { url } = (await response.json()) as { url: string };
      window.location.assign(url);
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : t("billingError"));
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        variant={action === "checkout" ? "default" : "outline"}
        onClick={open}
        disabled={loading}
      >
        {loading ? t("openingBilling") : action === "checkout" ? t("upgrade") : t("manageBilling")}
      </Button>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
