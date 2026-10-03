import type { en } from "../en";
import type { MessageShape } from "../type";

export const upload: MessageShape<(typeof en)["Upload"]> = {
  Panel: {
    textNotes: "Notes texte",
    image: "Image",
    processed: "Traité",
    failed: "Échec",
    reading: "Traitement en cours",
    queued: "En attente de traitement",
    pasteLabel: "Colle ou écris tes notes",
    textHint:
      "Colle le résumé de ton tuteur ou tes notes de cours, un mot, une expression ou une règle par ligne. Les langues mélangées et les notes en vrac conviennent aussi.",
    pastePlaceholder: "Colle ici les notes de ta séance",
    attachImages: "Joindre des images",
    upToImages: "Jusqu'à {max} images, 10 Mo chacune.",
    dropTitle: "Dépose ici des photos de tes notes manuscrites",
    dropCopy: "JPG, PNG, HEIC ou un autre format d'image",
    chooseImages: "Choisir des images",
    remove: "Retirer",
    notImage: "{name} n'est pas un fichier image.",
    tooLarge: "{name} dépasse 10 Mo.",
    tooMany: "Tu peux joindre jusqu'à {max} images à la fois.",
    emptyForm: "Colle des notes ou joins au moins une image.",
    couldNotSaveNotes: "Impossible d'enregistrer tes notes.",
    couldNotSaveImages: "Impossible d'enregistrer tes images.",
    savingNotes: "Enregistrement des notes…",
    previewTitle: "Vérifie tes notes avant la lecture",
    previewBlurb: "Chaque ligne est lue séparément, et ces numéros sont ceux que tu verras en modifiant ces notes plus tard.",
    previewLines: "{count, plural, one {# ligne sera lue} other {# lignes seront lues}}",
    previewImages: "{count, plural, one {et # image} other {et # images}}",
    previewLongLabel: "Ligne longue",
    previewLong: "{count, plural, one {La ligne {numbers} est longue.} other {Les lignes {numbers} sont longues.}} Un élément par ligne rend les modifications plus rapides et plus précises.",
    previewSplit: "Couper en lignes",
    previewSplitDone: "Lignes longues coupées.",
    previewUndo: "Annuler",
    previewUsesUpload: "{left, plural, one {Cela utilise ton dernier ajout gratuit de la semaine.} other {Utilise {used, plural, one {# ajout} other {# ajouts}} sur les # ajouts gratuits qu’il te reste cette semaine.}}",
    previewBack: "Revenir aux notes",
    previewConfirm: "{count, plural, one {Lire # ligne} other {Lire # lignes}}",
    uploadNotes: "Envoyer les notes",
    limitTitle: "Tu as utilisé ton ajout gratuit de la semaine",
    limitBody:
      "Avec Pro, ajoute tes notes après chaque cours pour que ton quiz du jour ait toujours du nouveau. 2,99 $/mois.",
    limitNext: "Prochain ajout gratuit : {date}.",
    backgroundHint:
      "Tu peux quitter cette page après l'ajout. Le traitement continue en arrière-plan.",
    statusKicker: "Préparation de ta révision",
    readingNotes: "Nous repérons les points à pratiquer…",
    processingFinished: "Traitement terminé",
    processingBlurb:
      "Tes notes sont traitées en arrière-plan. Tu peux quitter cette page ou en ajouter d'autres.",
    finishedBlurb:
      "Ces notes sont enregistrées. Les nouvelles notions rejoignent les révisions avec les plus anciennes et les erreurs récentes.",
    checkStatus: "Vérifier l'état",
    waiting: "Nous cherchons les notes que tu viens d'ajouter…",
    pointsPrefix: "{points, plural, one {+# notion, } other {+# notions, }}",
    linesSkipped:
      "{count, plural, one {# ligne ignorée} other {# lignes ignorées}}",
    extractionFailed: "Le traitement des notes a échoué.",
    keptBlurb:
      "Tes notes sont enregistrées. Le traitement reprendra automatiquement et tu peux retrouver le contenu dans l'historique.",
    pointsAdded:
      "{count, plural, one {# nouvelle notion tirée de ces notes.} other {# nouvelles notions tirées de ces notes.}}",
    viewHistory: "Voir l'historique des notes",
    guestModalTitle: "Notes ajoutées !",
    guestModalDescription:
      "Nous transformons tes notes en notions à réviser. Crée un compte pour recevoir ton quiz quotidien de dix minutes et conserver tes notes.",
    guestModalSignUp: "S'inscrire pour recevoir le quiz",
    guestModalContinue: "Continuer l'aperçu",
    guestStatusPrompt:
      "Notes ajoutées ! Crée un compte pour recevoir ton quiz quotidien et conserver ta classe.",
    guestUploadLimit:
      "L'essai sans compte est limité à un ajout de notes. Crée un compte pour en ajouter d'autres.",
    startReview: "Pratiquer maintenant",
    openBank: "Voir les notions repérées",
  },
};
