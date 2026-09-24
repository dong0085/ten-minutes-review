"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Lock, Plus } from "lucide-react";
import { BillingButton } from "@/components/account/billing-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
        <Link href="/classrooms/new">
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
