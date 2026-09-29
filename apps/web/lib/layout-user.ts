import { cache } from "react";
import { getCurrentUserOrGuest } from "./session";

// The root layout and the site header both read the visitor; one lookup serves both.
export const getLayoutUser = cache(getCurrentUserOrGuest);
