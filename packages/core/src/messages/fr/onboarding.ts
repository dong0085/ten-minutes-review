import type { en } from "../en";
import type { MessageShape } from "../type";

export const onboarding: MessageShape<(typeof en)["Onboarding"]> = {
  skip: "Passer pour l'instant",
  steps: {
    language: "Langue",
    tour: "Fonctionnement",
    notes: "Vos notes",
  },
  Welcome: {
    kicker: "Bienvenue",
    title:
      "Retrouve ce que tu as appris en cours avec <highlight>un peu de pratique chaque jour.</highlight>",
    blurb:
      "Choisis ta langue, ajoute tes notes de cours et essaie ta première révision. Des notes d’exemple sont disponibles si besoin.",
    stepLanguage: "Choisissez la langue que vous apprenez",
    stepTour: "Révise avant ton prochain cours",
    stepNotes: "Ajoute les notes de ton dernier cours",
    start: "Commencer ma première révision",
  },
  Language: {
    kicker: "Étape 1",
    title: "Quelle langue apprenez-vous ?",
    blurb:
      "Ta classe réunira les notes et les révisions de tes cours dans cette langue.",
    speak: "Je parle",
    continue: "Ajouter mes notes de cours",
    seeExample: "Voir un exemple de révision",
  },
  Tour: {
    paperTitle: "Quiz d'exemple · {language}",
    instructions: "Répondez à chaque question, puis rendez votre copie.",
    progress: "{current} sur {total}",
    back: "Retour",
    next: "Suivant",
    finish: "Passer à mes notes",
    skipPart: "Passer cette partie",
    answered: "{answered} sur {total} répondues",
    submit: "Rendre",
    scoreLine: "{correct} sur {total} justes",
    header: {
      title: "Voici votre copie",
      body: "Une révision rassemble quelques exercices tirés de tes notes. Regarde leur contenu et la durée conseillée avant de commencer.",
    },
    choice: {
      title: "Partie I · Choix multiple",
      body: "Touchez une bulle pour choisir. Vous pouvez changer d'avis jusqu'à ce que vous rendiez la copie.",
    },
    trueFalse: {
      title: "Partie II · Vrai ou faux",
      body: "Indiquez si chaque affirmation est vraie ou fausse.",
    },
    fillBlank: {
      title: "Partie III · Texte à trous",
      body: "Écrivez la réponse directement sur la ligne. Entrée passe au trou suivant.",
    },
    bar: {
      title: "Rendez la copie",
      body: "Cette barre compte vos réponses. Appuyez sur Rendre quand vous avez fini. Rien n'est révélé avant.",
    },
    marks: {
      title: "Corrigé au stylo rouge",
      body: "La copie revient corrigée : une coche ou une croix par question, la bonne réponse écrite, et une courte explication.",
    },
    score: {
      title: "Votre note",
      body: "Tes résultats indiquent quoi revoir. Après les explications, tu peux terminer pour aujourd’hui ou recommencer si tu le souhaites.",
    },
  },
  Notes: {
    kicker: "Tes notes de cours",
    title: "Repars de ton dernier cours.",
    blurb:
      "Colle le résumé de ton tuteur ou photographie une page de ton cahier. Inutile de tout remettre au propre.",
    photoTab: "Photo",
    textTab: "Texte",
    dropTitle: "Prenez ou choisissez une photo",
    dropCopy: "Les pages manuscrites fonctionnent bien.",
    photoLimit: "Jusqu'à {max, plural, one {# photo} other {# photos}}",
    addPhoto: "Ajouter une photo",
    remove: "Retirer",
    textPlaceholder:
      "Collez les mots, expressions ou points de grammaire étudiés…",
    lineCount: "{count, plural, one {# ligne} other {# lignes}} · un élément par ligne, c’est l’idéal",
    useSample: "Pas de notes sous la main ? Utilisez des notes d'exemple",
    submit: "Lire mes notes",
    submitting: "Enregistrement…",
    classroomName: "Mon {language}",
    emptyForm: "Ajoutez d'abord une photo ou du texte.",
    readingTitle: "Lecture de vos notes…",
    readingBlurb:
      "Nous repérons les mots, les expressions et la grammaire à réviser entre deux cours.",
    slowHint:
      "Cela peut prendre une minute. Vous pouvez partir : vos notes continuent d'être traitées.",
    doneTitle:
      "{count, plural, =0 {Rien à réviser pour l'instant} one {# élément à réviser} other {# éléments à réviser}}",
    doneBlurb:
      "Essaie une courte révision maintenant. Ces notes serviront aussi aux suivantes, avec les notions plus anciennes de ta classe.",
    emptyBlurb:
      "Nous n'avons rien trouvé à réviser. Essayez une page avec des mots ou des expressions.",
    failedTitle: "Impossible de lire ces notes",
    makeQuiz: "Commencer ma première révision",
    openClassroom: "Aller à ma classe",
    tryAgain: "Essayer d'autres notes",
    guestTitle: "Gardez votre progression",
    guestBlurb:
      "Crée un compte gratuit pour conserver ces notes et ta progression, et activer les révisions quotidiennes par e-mail.",
    guestAction: "Créer un compte",
    composingTitle: "Rédaction de votre quiz…",
    composingBlurb: "Cela prend en général moins d'une minute.",
    composeFailed:
      "Impossible de rédiger le quiz cette fois. Vous pouvez réessayer depuis votre classe.",
  },
};
