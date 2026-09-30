import type { en } from "../en";
import type { MessageShape } from "../type";

export const app: MessageShape<(typeof en)["App"]> = {
  Shell: {
    breadcrumb: "Fil d'Ariane",
    back: "Retour",
    closeQuiz: "Fermer le quiz",
    errorTitle: "Un problème est survenu",
    errorBlurb:
      "Cette page n'a pas pu se charger. Vérifiez votre connexion et réessayez.",
    retry: "Réessayer",
    toClassrooms: "Aller aux classes",
  },
  Crumbs: {
    classrooms: "Classes",
    newClassroom: "Nouvelle classe",
    notes: "Notes",
    addNotes: "Ajouter des notes",
    bank: "Banque de questions",
    quizzes: "Quiz",
    settings: "Réglages",
    attempt: "Résultats",
    mistakes: "Carnet d'erreurs",
    account: "Compte",
    profile: "Profil",
    security: "Connexion et sécurité",
    email: "E-mail",
    plan: "Formule et utilisation",
    referrals: "Parrainage",
    tokens: "Jetons d'API",
    data: "Tes données",
  },
  Hub: {
    addNotesBlurb:
      "Tu viens de suivre un cours ? Ajoute ses notes ici. Les nouvelles notions rejoignent tes révisions avec les anciennes.",
    inside: "Dans cette classe",
    notes: "Notes",
    notesMeta:
      "{count, plural, one {# ajout} other {# ajouts}} · dernier ajout : {when}",
    reading:
      "{count, plural, one {# note en cours de traitement} other {# notes en cours de traitement}}",
    bank: "Banque de questions",
    bankMeta:
      "{count, plural, =0 {Ajoute des notes pour commencer} one {# notion prête pour les quiz} other {# notions prêtes pour les quiz}}",
    quizzes: "Quiz",
    quizzesMeta:
      "{count, plural, one {# révision} other {# révisions}} · à revoir quand tu veux",
    mistakes: "Carnet d'erreurs",
    mistakesMeta:
      "{count, plural, =0 {Aucune erreur récente à revoir} one {# question récente à revoir} other {# questions récentes à revoir}}",
    settings: "Réglages",
    settingsMeta: "Nom, langues et révisions quotidiennes",
  },
  QuizDetail: {
    take: "Faire le quiz",
    retake: "Refaire",
    covers: "Ce que tu vas pratiquer",
    attempts: "Tentatives",
    noAttempts:
      "Aucune tentative pour l'instant. Les réponses et les explications s'affichent après l'envoi.",
  },
  AccountHub: {
    settings: "Réglages",
    profile: "Profil",
    profileMeta: "Nom, langue de l'interface et fuseau horaire",
    security: "Connexion et sécurité",
    securityMeta: "Mot de passe et comptes associés",
    email: "E-mail",
    emailMeta: "L'e-mail du quiz quotidien",
    plan: "Formule et utilisation",
    planMeta: "Ton abonnement et ton utilisation cette semaine",
    referrals: "Parrainage",
    referralsMeta: "Invite un ami : un mois offert pour chacun",
    tokens: "Jetons d'API",
    tokensMeta: "Connecter l'extension de navigateur",
    data: "Tes données",
    dataMeta: "Tout exporter, ou supprimer votre compte",
  },
};
