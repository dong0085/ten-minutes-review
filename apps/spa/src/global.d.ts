import type { MessagesShape, UiLocale } from "@tmr/core";

declare module "use-intl" {
  interface AppConfig {
    Locale: UiLocale;
    Messages: MessagesShape;
  }
}
