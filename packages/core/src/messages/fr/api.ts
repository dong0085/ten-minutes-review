import type { en } from "../en";
import type { MessageShape } from "../type";

export const api: MessageShape<(typeof en)["Api"]> = {
  unauthorized: "Non autorisé",
  notFound: "Introuvable",
  invalidRequest: "Vérifie le formulaire et réessaie.",
  generic: "Une erreur est survenue. Réessaie.",
  emailRegistered: "Cet e-mail est déjà utilisé",
  inviteRequired: "Code d'invitation requis",
  invalidToken: "Jeton manquant ou invalide",
  invalidExpiredToken: "Jeton invalide ou expiré",
  freePlanLimit: "Le forfait gratuit est limité à 3 classes",
  emptyBank: "Ajoute des notes pour créer un quiz",
  attemptInvalid: "La session du quiz a expiré",
  attemptSubmitted: "Ce quiz a déjà été envoyé",
  attemptRecord: "Impossible d'enregistrer le quiz",
  uploadLimit: "Limite atteinte : 50 envois par jour",
  invalidFormData: "Données du formulaire invalides",
  imageCount: "Joins entre 1 et 10 images",
  fileTooLarge: "{name} dépasse 10 Mo",
  fileWrongType: "{name} doit être une image JPEG, PNG, WebP, GIF, AVIF ou HEIC",
  invalidDate: "Date invalide",
  invalidTimezone: "Fuseau horaire invalide",
  passwordIncorrect: "Ton mot de passe actuel est incorrect.",
  unlinkWithoutPassword: "Définis un mot de passe avant de délier Google.",
};
