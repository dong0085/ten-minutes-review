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
    "Voici ton quiz du jour. Tu peux réfléchir aux réponses dans cet e-mail ou ouvrir le site pour répondre, voir ton score et lire les explications.",
  dailyIntroMany:
    "Voici les quiz du jour. Tu peux réfléchir aux réponses dans cet e-mail ou ouvrir le site pour répondre, voir ton score et lire les explications.",
  answerOnWeb: "Ouvrir le quiz et répondre",
  answersHeading: "Réponses",
  unsubscribeWhy: "Tu reçois cet e-mail parce que les quiz quotidiens sont activés.",
  unsubscribeAction: "Se désabonner",
};
