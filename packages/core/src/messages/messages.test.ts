import { describe, expect, it } from "vitest";
import { getMessages, UI_LOCALES } from "./index";

describe("localization catalogs", () => {
  for (const locale of UI_LOCALES) {
    it(`catalogs for ${locale} contain required strings`, () => {
      const messages = getMessages(locale);

      // Home
      expect(messages.Home.tryAsGuest).toBeTruthy();
      expect(messages.Home.highlights.kicker).toBeTruthy();
      expect(messages.Home.highlights.title).toBeTruthy();
      expect(messages.Home.highlights.noPressure.title).toBeTruthy();
      expect(messages.Home.highlights.noPressure.copy).toBeTruthy();
      expect(messages.Home.highlights.pause.title).toBeTruthy();
      expect(messages.Home.highlights.pause.copy).toBeTruthy();
      expect(messages.Home.highlights.notes.title).toBeTruthy();
      expect(messages.Home.highlights.notes.copy).toBeTruthy();

      // Classroom guest preview banner & daily quiz CTA
      expect(messages.Classroom.HomePage.guestBanner).toBeTruthy();
      expect(messages.Classroom.HomePage.guestBannerAction).toBeTruthy();
      expect(messages.Classroom.HomePage.guestDailyQuizTitle).toBeTruthy();
      expect(messages.Classroom.HomePage.guestDailyQuizBlurb).toBeTruthy();
      expect(messages.Classroom.HomePage.guestDailyQuizCta).toBeTruthy();

      // Upload guest prompt & modal
      expect(messages.Upload.Panel.guestModalTitle).toBeTruthy();
      expect(messages.Upload.Panel.guestModalDescription).toBeTruthy();
      expect(messages.Upload.Panel.guestModalSignUp).toBeTruthy();
      expect(messages.Upload.Panel.guestModalContinue).toBeTruthy();
      expect(messages.Upload.Panel.guestStatusPrompt).toBeTruthy();
      expect(messages.Upload.Panel.guestUploadLimit).toBeTruthy();
    });
  }
});
