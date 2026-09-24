import { getTranslations } from "next-intl/server";

export async function AccountHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const t = await getTranslations("Account");

  return (
    <div className="border-b border-border/70 pb-7">
      <p className="eyebrow">{t("title")}</p>
      <h1 className="mt-2 font-heading text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
        {title}
      </h1>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
