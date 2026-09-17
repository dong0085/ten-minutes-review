import { describe, expect, it } from "vitest";
import {
  renderDailyQuizEmail,
  renderPasswordResetEmail,
  renderVerificationEmail,
} from "./index";

describe("email templates", () => {
  it("renders the verification email in French", async () => {
    const message = await renderVerificationEmail(
      "https://example.com/verify?token=abc",
      "fr",
    );

    expect(message.subject).toBe("Confirme ton adresse e-mail");
    expect(message.html).toContain("Ten Minutes Review");
    expect(message.html).toContain("Confirmer mon adresse");
    expect(message.html).toContain("Si le bouton ne fonctionne pas");
    expect(message.text).toContain("https://example.com/verify?token=abc");
  });

  it("renders the password reset email in English", async () => {
    const message = await renderPasswordResetEmail(
      "https://example.com/reset?token=abc",
      "en",
    );

    expect(message.subject).toBe("Reset your password");
    expect(message.html).toContain("If the button does not work");
    expect(message.text).toContain("Reset password");
  });

  it("renders a localized daily quiz without leaking answers", async () => {
    const message = await renderDailyQuizEmail({
      locale: "fr",
      username: "Marie <script>alert(1)</script>",
      unsubscribeUrl: "https://example.com/unsubscribe?token=abc",
      entries: [
        {
          classroomName: "Français avec Marie",
          quizUrl: "https://example.com/quiz/1",
          questions: [
            {
              position: 0,
              category: "vocabulary",
              type: "mcq",
              stem: "« l'étendoir » veut dire :",
              options: ["the clothes line", "the rent"],
            },
            {
              position: 1,
              category: "grammar",
              type: "true_false",
              stem: "Cette phrase est correcte.",
              options: null,
            },
          ],
        },
      ],
    });

    expect(message.subject).toBe("Le quiz du jour : Français avec Marie");
    expect(message.html).toContain("Vocabulaire");
    expect(message.html).toContain("Grammaire");
    expect(message.html).toContain(">01<!-- -->");
    expect(message.html).toContain("Vrai");
    expect(message.html).toContain("Faux");
    expect(message.html).toContain("https://example.com/unsubscribe?token=abc");
    expect(message.html).toContain("Marie &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(message.html).not.toContain("Marie <script>");
    expect(message.text).toContain("Répondre sur le site");
    expect(message.text).toContain("https://example.com/quiz/1");
    expect(message.text).toContain("https://example.com/unsubscribe?token=abc");
    expect(message.text.match(/LE QUIZ DU JOUR/g)).toHaveLength(1);
    expect(message.text).toContain("A the clothes line");
    expect(message.html).not.toContain("correct answer");
    expect(message.text).not.toContain("correct answer");
  });

  it("renders a multi-classroom English subject", async () => {
    const message = await renderDailyQuizEmail({
      locale: "en",
      username: null,
      unsubscribeUrl: "https://example.com/unsubscribe",
      entries: [
        {
          classroomName: "French",
          quizUrl: "https://example.com/quiz/1",
          questions: [],
        },
        {
          classroomName: "Spanish",
          quizUrl: "https://example.com/quiz/2",
          questions: [],
        },
      ],
    });

    expect(message.subject).toBe("Today's quizzes (2 classrooms)");
    expect(message.text).toContain("Hello,");
    expect(message.html).toContain("French");
    expect(message.html).toContain("Spanish");
  });
});
