import type { en } from "../en";
import type { MessageShape } from "../type";

export const category: MessageShape<(typeof en)["Category"]> = {
  vocabulary: "Vocabulaire",
  phrase: "Expressions et tournures",
  grammar: "Grammaire",
  expression: "Idées et expression",
  comprehension: "Compréhension écrite",
};
