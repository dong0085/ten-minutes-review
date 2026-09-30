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
  dailySubjectOne: "Ta révision de cours : {classroom}",
  dailySubjectMany: "Révisions entre deux cours ({count} classes)",
  dailyIntro:
    "Continue à pratiquer tes notes de cours avec une courte révision. Réfléchis aux questions ici, ou ouvre la révision pour répondre et lire les explications.",
  dailyIntroMany:
    "Choisis une classe pour une courte révision aujourd’hui. Réfléchis aux questions ici, ou ouvre la révision pour répondre et lire les explications.",
  answerOnWeb: "Commencer ma révision",
  answersHeading: "Réponses",
  unsubscribeWhy:
    "Tu reçois cet e-mail parce que les quiz quotidiens sont activés.",
  unsubscribeAction: "Se désabonner",
};
