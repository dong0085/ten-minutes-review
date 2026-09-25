
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { Lock, Plus } from "lucide-react";
import { BillingButton } from "@/components/account/billing-button";
import { Badge } from "@tmr/ui/components/badge";
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

export function NewClassroomButton({
  locked,
  billingEnabled,
}: {
  locked: boolean;
  billingEnabled: boolean;
}) {
  const t = useTranslations("Classroom.ListPage");

  if (!locked) {
    return (
      <Button asChild>
        <Link to="/classrooms/new">
          <Plus />
          {t("newClassroom")}
        </Link>
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label={t("lockedLabel")}>
          <Lock />
          {t("newClassroom")}
          <Badge>{t("proBadge")}</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("lockedTitle")}</DialogTitle>
          <DialogDescription>{t("lockedBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:items-start">
          <DialogClose asChild>
            <Button variant="ghost">{t("lockedClose")}</Button>
          </DialogClose>
          {billingEnabled ? <BillingButton action="checkout" /> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
