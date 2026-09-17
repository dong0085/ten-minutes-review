import { DailyQuizEmailTemplate } from "../src/templates";

export default function DailyQuizEnglishPreview() {
  return (
    <DailyQuizEmailTemplate
      locale="en"
      username="Alex"
      unsubscribeUrl="https://example.com/unsubscribe?token=preview"
      entries={[
        {
          classroomName: "French with Marie",
          quizUrl: "https://example.com/classrooms/french/quiz/today",
          questions: [
            {
              position: 0,
              category: "vocabulary",
              type: "mcq",
              stem: "What does « l'étendoir » mean?",
              options: ["The clothes line", "The ceiling", "The rent"],
            },
            {
              position: 1,
              category: "grammar",
              type: "true_false",
              stem: "« Il faut partir » expresses necessity.",
              options: null,
            },
          ],
        },
        {
          classroomName: "Spanish conversation",
          quizUrl: "https://example.com/classrooms/spanish/quiz/today",
          questions: [
            {
              position: 0,
              category: "phrase",
              type: "fill_blank",
              stem: "Complete: Me gustaría ___ una mesa.",
              options: null,
            },
          ],
        },
      ]}
    />
  );
}
