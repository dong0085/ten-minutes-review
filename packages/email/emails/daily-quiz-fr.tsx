import { DailyQuizEmailTemplate } from "../src/templates";

export default function DailyQuizFrenchPreview() {
  return (
    <DailyQuizEmailTemplate
      locale="fr"
      username="Marie"
      unsubscribeUrl="https://example.com/unsubscribe?token=apercu"
      entries={[
        {
          classroomName: "Anglais du quotidien",
          quizUrl: "https://example.com/classrooms/english/quiz/today",
          questions: [
            {
              position: 0,
              category: "expression",
              type: "mcq",
              stem: "Choisis la formulation la plus naturelle.",
              options: ["I look forward to seeing you", "I wait to see you"],
            },
          ],
        },
      ]}
    />
  );
}
