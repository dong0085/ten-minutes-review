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
          includeAnswers: false,
          questions: [
            {
              position: 0,
              category: "vocabulary",
              type: "mcq",
              stem: "« l'étendoir » veut dire :",
              options: ["the clothes line", "the rent"],
              answer: { index: 1 },
              explanation: "Un étendoir sert à faire sécher le linge.",
            },
            {
              position: 1,
              category: "grammar",
              type: "true_false",
              stem: "Cette phrase est correcte.",
              options: null,
              answer: { value: false },
              explanation: "L'accord du participe est nécessaire ici.",
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
    expect(message.html).not.toContain("Réponses");
    expect(message.text).not.toContain("Réponses");
    expect(message.html).not.toContain("sécher le linge");
    expect(message.text).not.toContain("sécher le linge");
    expect(message.html).not.toContain("accord du participe");
    expect(message.text).not.toContain("accord du participe");
  });

  it("renders the answer key when includeAnswers is on", async () => {
    const message = await renderDailyQuizEmail({
      locale: "en",
      username: "Alex",
      unsubscribeUrl: "https://example.com/unsubscribe",
      entries: [
        {
          classroomName: "French with Marie",
          quizUrl: "https://example.com/quiz/1",
          includeAnswers: true,
          questions: [
            {
              position: 0,
              category: "vocabulary",
              type: "mcq",
              stem: "What does « l'étendoir » mean?",
              options: ["The clothes line", "The rent"],
              answer: { index: 0 },
              explanation: "The rack you hang laundry on to dry.",
            },
            {
              position: 1,
              category: "grammar",
              type: "true_false",
              stem: "« Il faut partir » expresses necessity.",
              options: null,
              answer: { value: true },
            },
            {
              position: 2,
              category: "phrase",
              type: "fill_blank",
              stem: "Complete: Me gustaría ___ una mesa.",
              options: null,
              answer: { blanks: ["reservar"] },
            },
          ],
        },
        {
          classroomName: "Spanish conversation",
          quizUrl: "https://example.com/quiz/2",
          includeAnswers: false,
          questions: [
            {
              position: 0,
              category: "phrase",
              type: "fill_blank",
              stem: "Complete: Vamos a ___ un café.",
              options: null,
              answer: { blanks: ["tomar"] },
              explanation: "Tomar is the everyday verb for having a drink.",
            },
          ],
        },
      ],
    });

    expect(message.text.match(/Answers/g)).toHaveLength(1);
    expect(message.text).toContain("A. The clothes line");
    expect(message.text).toContain("02 · True");
    expect(message.text).toContain("03 · reservar");
    expect(message.html).toContain("The rack you hang laundry on to dry.");
    expect(message.text).toContain("The rack you hang laundry on to dry.");
    expect(message.html).not.toContain("tomar");
    expect(message.text).not.toContain("tomar");
    expect(message.html).not.toContain("Tomar is the everyday verb");
    expect(message.text).not.toContain("Tomar is the everyday verb");
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
          includeAnswers: false,
          questions: [],
        },
        {
          classroomName: "Spanish",
          quizUrl: "https://example.com/quiz/2",
          includeAnswers: false,
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
