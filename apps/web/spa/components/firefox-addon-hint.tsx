import { useTranslations } from "use-intl";
import { ArrowUpRight, Puzzle } from "lucide-react";
import { FIREFOX_ADDON_URL } from "@tmr/core";

/** A quiet pointer to the Firefox add-on, which saves selected text as a note. */
export function FirefoxAddonHint({ hint }: { hint: "notesHint" | "tokensHint" }) {
  const t = useTranslations("App.FirefoxAddon");
  return (
    <aside className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm leading-6">
      <Puzzle className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-muted-foreground">
        {t(hint)}{" "}
        <a
          href={FIREFOX_ADDON_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline"
        >
          {t("action")}
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
      </p>
    </aside>
  );
}
