import type { en } from "../en";
import type { MessageShape } from "../type";

export const email: MessageShape<(typeof en)["Email"]> = {
  actionFallback: "Si le bouton ne fonctionne pas, ouvre ce lien :",
  verificationSubject: "Confirme ton adresse e-mail",
  verificationBody: "Un clic et ton compte Ten Minutes Review est prêt.",
  verificationAction: "Confirmer mon adresse",
  resetSubject: "Réinitialise ton mot de passe",
  resetBody:
    "Choisis un nouveau mot de passe avec le lien ci-dessous. Le lien expire dans une heure.",
  resetAction: "Réinitialiser mon mot de passe",
  greetingNamed: "Bonjour {name},",
  greetingAnonymous: "Bonjour,",
  yourClassroom: "ta classe",
  dailySubjectOne: "Le quiz du jour : {classroom}",
  dailySubjectMany: "Les quiz du jour ({count} classes)",
  dailyIntro:
    "Voici le quiz du jour. Tu peux répondre de tête ici même, ou ouvrir le site pour le score et les explications.",
  dailyIntroMany:
    "Voici le menu des quiz du jour. Tu peux répondre de tête ici même, ou ouvrir le site pour le score et les explications.",
  answerOnWeb: "Répondre sur le site",
  answersHeading: "Réponses",
  unsubscribeWhy: "Tu reçois cet e-mail parce que les quiz quotidiens sont activés.",
  unsubscribeAction: "Se désinscrire",
};
