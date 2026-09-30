import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { Button } from "@tmr/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@tmr/ui/components/dialog";
import { BillingButton } from "@/spa/components/account/billing-button";
import { useSession } from "@/spa/lib/session";

/** Managing the bank is part of Pro. The trigger opens the upgrade prompt. */
export function BankProDialog({ children }: { children: ReactNode }) {
  const t = useTranslations("Classroom.BankPage");
  const { data: session } = useSession();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("proTitle")}</DialogTitle>
          <DialogDescription>{t("proBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:items-start">
          <DialogClose asChild>
            <Button variant="ghost">{t("proClose")}</Button>
          </DialogClose>
          {session?.features.billing ? <BillingButton action="checkout" /> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Whether the signed-in learner can edit and omit points from the bank. */
export function useCanManageBank() {
  const { data: session } = useSession();
  return session?.plan.isPaid ?? false;
}
