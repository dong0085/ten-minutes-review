import { Link } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { Plus } from "lucide-react";
import { SectionTitle } from "@/components/account/account-header";
import { languageLabel } from "@/lib/language-label";

// Tab tints cycle through the palette so neighbouring cards differ.
const TAB_TINTS = [
  "bg-primary/25",
  "bg-warning/25",
  "bg-success/25",
  "bg-destructive/20",
];

// Classrooms as index cards with a coloured tab, like a card box.
export function ClassroomIndex({
  classrooms,
  canAdd,
}: {
  classrooms: {
    id: string;
    name: string;
    targetLanguage: string;
    nativeLanguage: string;
  }[];
  canAdd: boolean;
}) {
  const t = useTranslations("Account");
  const locale = useLocale();

  return (
    <section>
      <SectionTitle
        kicker={t("ClassroomIndex.kicker")}
        title={t("classroomsSection")}
        aside={
          <Link
            to="/classrooms"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("ClassroomIndex.viewAll")}
          </Link>
        }
      />
      <ul className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
        {classrooms.map((classroom, index) => (
          <li key={classroom.id}>
            <Link to={`/classrooms/${classroom.id}`} className="group block">
              <span
                aria-hidden="true"
                className={`index-tab ml-4 block h-3 w-20 transition-all duration-200 group-hover:w-24 ${TAB_TINTS[index % TAB_TINTS.length]}`}
              />
              <span className="paper-lines block rounded-xl border border-border/80 bg-card px-4 pt-3 pb-4 shadow-[0_1px_2px_rgb(var(--shadow-colour)/0.05)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_24px_rgb(var(--shadow-colour)/0.08)]">
                <span className="block truncate font-heading text-lg font-semibold leading-8">
                  {classroom.name}
                </span>
                <span className="block text-xs leading-8 text-muted-foreground">
                  {t("languagePair", {
                    target: languageLabel(classroom.targetLanguage, locale),
                    native: languageLabel(classroom.nativeLanguage, locale),
                  })}
                </span>
              </span>
            </Link>
          </li>
        ))}
        {canAdd ? (
          <li>
            <Link to="/classrooms/new" className="group block">
              <span aria-hidden="true" className="ml-4 block h-3" />
              <span className="grid h-[5.25rem] place-items-center rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                <span className="flex items-center gap-1.5">
                  <Plus className="size-4 transition-transform group-hover:rotate-90" />
                  {t("ClassroomIndex.add")}
                </span>
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
