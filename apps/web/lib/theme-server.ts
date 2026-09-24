import { cookies } from "next/headers";
import { resolveTheme, UI_THEME_COOKIE } from "./theme";

export async function getTheme(accountTheme: string | null | undefined) {
  const cookieStore = await cookies();
  return resolveTheme(accountTheme, cookieStore.get(UI_THEME_COOKIE)?.value);
}
