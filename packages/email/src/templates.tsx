import React from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";
import { formatMessage, getMessages } from "@tmr/core";
import type { Category, QuestionAnswer, QuestionType, UiLocale } from "@tmr/core";

const colours = {
  paper: "#fbfaf6",
  paperDeep: "#f2efe7",
  ink: "#2f2c27",
  muted: "#756f66",
  border: "#d9d3c6",
  mint: "#4d796b",
  mintDeep: "#315c50",
  mintSoft: "#e4eee9",
  white: "#fffefa",
} as const;

const bodyStyle: CSSProperties = {
  backgroundColor: colours.paperDeep,
  color: colours.ink,
  fontFamily: "Arial, Helvetica, sans-serif",
  margin: 0,
  padding: "28px 12px",
};

const containerStyle: CSSProperties = {
  backgroundColor: colours.paper,
  border: `1px solid ${colours.border}`,
  borderRadius: "18px",
  margin: "0 auto",
  maxWidth: "600px",
  overflow: "hidden",
  width: "100%",
};

const contentStyle: CSSProperties = {
  padding: "34px 38px 38px",
};

const brandStyle: CSSProperties = {
  borderBottom: `1px solid ${colours.border}`,
  padding: "22px 38px",
};

const brandMarkStyle: CSSProperties = {
  backgroundColor: colours.mint,
  borderRadius: "10px",
  color: colours.white,
  display: "inline-block",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: "36px",
  marginRight: "11px",
  textAlign: "center",
  verticalAlign: "middle",
  width: "36px",
};

const brandNameStyle: CSSProperties = {
  color: colours.ink,
  display: "inline-block",
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "17px",
  fontWeight: 700,
  lineHeight: "24px",
  margin: 0,
  verticalAlign: "middle",
};

const headingStyle: CSSProperties = {
  color: colours.ink,
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "29px",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: "1.2",
  margin: "0 0 18px",
};

const paragraphStyle: CSSProperties = {
  color: colours.ink,
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "0 0 16px",
};

const buttonStyle: CSSProperties = {
  backgroundColor: colours.mint,
  borderRadius: "10px",
  color: colours.white,
  display: "inline-block",
  fontSize: "14px",
  fontWeight: 700,
  lineHeight: "1",
  padding: "13px 19px",
  textDecoration: "none",
};

const mutedStyle: CSSProperties = {
  color: colours.muted,
  fontSize: "12px",
  lineHeight: "1.55",
  margin: "0 0 10px",
};

type EmailShellProps = {
  locale: UiLocale;
  preview: string;
  children: ReactNode;
  footer?: ReactNode;
};

function EmailShell({ locale, preview, children, footer }: EmailShellProps) {
  return (
    <Html lang={locale} dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body lang={locale} dir="ltr" style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={brandStyle}>
            <span style={brandMarkStyle}>10′</span>{" "}
            <span style={brandNameStyle}>Ten Minutes Review</span>
          </Section>
          <Section style={contentStyle}>{children}</Section>
          {footer ? (
            <Section style={{ padding: "0 38px 28px" }}>
              <Hr style={{ borderColor: colours.border, margin: "0 0 20px" }} />
              {footer}
            </Section>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}

export type ActionEmailTemplateProps = {
  locale: UiLocale;
  heading: string;
  body: string;
  actionLabel: string;
  actionUrl: string;
};

export function ActionEmailTemplate({
  locale,
  heading,
  body,
  actionLabel,
  actionUrl,
}: ActionEmailTemplateProps) {
  const { actionFallback } = getMessages(locale).Email;

  return (
    <EmailShell locale={locale} preview={heading}>
      <Heading as="h1" style={headingStyle}>
        {heading}
      </Heading>
      <Text style={paragraphStyle}>{body}</Text>
      <Section style={{ margin: "24px 0" }}>
        <Button href={actionUrl} style={buttonStyle}>
          {actionLabel}
        </Button>
      </Section>
      <Text style={mutedStyle}>{actionFallback}</Text>
      <Link
        href={actionUrl}
        style={{
          color: colours.mintDeep,
          fontSize: "12px",
          lineHeight: "1.55",
          overflowWrap: "anywhere",
          textDecoration: "underline",
        }}
      >
        {actionUrl}
      </Link>
    </EmailShell>
  );
}

export type DailyQuizEmailEntry = {
  classroomName: string;
  quizUrl: string;
  includeAnswers: boolean;
  questions: {
    position: number;
    category: Category;
    type: QuestionType;
    stem: string;
    options: string[] | null;
    answer?: QuestionAnswer | null;
    explanation?: string | null;
  }[];
};

export type DailyQuizEmailTemplateProps = {
  locale: UiLocale;
  username: string | null;
  entries: DailyQuizEmailEntry[];
  unsubscribeUrl: string;
};

export function dailyQuizEmailCopy(input: DailyQuizEmailTemplateProps) {
  const messages = getMessages(input.locale).Email;
  const greeting = input.username
    ? formatMessage(messages.greetingNamed, { name: input.username })
    : messages.greetingAnonymous;
  const subject =
    input.entries.length === 1
      ? formatMessage(messages.dailySubjectOne, {
          classroom: input.entries[0]?.classroomName ?? messages.yourClassroom,
        })
      : formatMessage(messages.dailySubjectMany, { count: input.entries.length });
  const intro = input.entries.length > 1 ? messages.dailyIntroMany : messages.dailyIntro;

  return { greeting, intro, messages, subject };
}

type AllMessages = ReturnType<typeof getMessages>;

function resolveEmailOptions(
  question: DailyQuizEmailEntry["questions"][number],
  allMessages: AllMessages,
): string[] {
  return (
    question.options ??
    (question.type === "true_false"
      ? [allMessages.Quiz.QuestionReview.true, allMessages.Quiz.QuestionReview.false]
      : [])
  );
}

function formatEmailAnswer(
  question: DailyQuizEmailEntry["questions"][number],
  allMessages: AllMessages,
): string {
  const answer = question.answer;
  if (!answer) {
    return allMessages.Quiz.QuestionReview.noAnswer;
  }
  if ("value" in answer) {
    if (answer.value === true) {
      return allMessages.Quiz.QuestionReview.true;
    }
    if (answer.value === false) {
      return allMessages.Quiz.QuestionReview.false;
    }
    return allMessages.Quiz.QuestionReview.noAnswer;
  }
  if ("index" in answer) {
    const options = resolveEmailOptions(question, allMessages);
    const letter = String.fromCharCode(65 + answer.index);
    const text =
      options[answer.index] ??
      formatMessage(allMessages.Quiz.QuestionReview.option, { number: answer.index + 1 });
    return `${letter}. ${text}`;
  }
  const blanks = "blanks" in answer ? answer.blanks : [];
  if (blanks.length === 0 || blanks.every((blank) => !blank || blank.trim() === "")) {
    return allMessages.Quiz.QuestionReview.noAnswer;
  }
  return blanks.map((blank) => (blank && blank.trim() !== "" ? blank : "—")).join(", ");
}

function Option({ index, children }: { index: number; children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: colours.paper,
        border: `1px solid ${colours.border}`,
        borderRadius: "9px",
        margin: "7px 0 0",
        padding: "9px 11px",
      }}
    >
      <Text style={{ color: colours.ink, fontSize: "13px", lineHeight: "1.5", margin: 0 }}>
        <span
          style={{
            backgroundColor: colours.mintSoft,
            borderRadius: "6px",
            color: colours.mintDeep,
            display: "inline-block",
            fontSize: "11px",
            fontWeight: 700,
            lineHeight: "22px",
            marginRight: "9px",
            textAlign: "center",
            width: "22px",
          }}
        >
          {String.fromCharCode(65 + index)}
        </span>
        {" "}
        {children}
      </Text>
    </Section>
  );
}

export function DailyQuizEmailTemplate(input: DailyQuizEmailTemplateProps) {
  const { greeting, intro, messages, subject } = dailyQuizEmailCopy(input);
  const allMessages = getMessages(input.locale);

  return (
    <EmailShell
      locale={input.locale}
      preview={subject}
      footer={
        <Text style={{ ...mutedStyle, margin: 0 }}>
          {messages.unsubscribeWhy}{" "}
          <Link
            href={input.unsubscribeUrl}
            style={{ color: colours.mintDeep, textDecoration: "underline" }}
          >
            {messages.unsubscribeAction}
          </Link>
        </Text>
      }
    >
      <Heading as="h1" style={headingStyle}>
        {subject}
      </Heading>
      <Text style={{ ...paragraphStyle, fontWeight: 700, marginBottom: "8px" }}>
        {greeting}
      </Text>
      <Text style={{ ...paragraphStyle, color: colours.muted, marginBottom: "26px" }}>
        {intro}
      </Text>

      {input.entries.map((entry, entryIndex) => (
        <Section
          key={`${entry.classroomName}-${entryIndex}`}
          style={{
            backgroundColor: colours.white,
            border: `1px solid ${colours.border}`,
            borderRadius: "14px",
            margin: entryIndex === input.entries.length - 1 ? "0" : "0 0 20px",
            padding: "22px",
          }}
        >
          <Heading
            as="h2"
            style={{
              color: colours.ink,
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "21px",
              lineHeight: "1.3",
              margin: "0 0 18px",
            }}
          >
            {entry.classroomName}
          </Heading>

          {entry.questions.map((question, questionIndex) => {
            const options = resolveEmailOptions(question, allMessages);

            return (
              <Section
                key={`${question.position}-${questionIndex}`}
                style={{
                  borderTop: questionIndex === 0 ? undefined : `1px solid ${colours.border}`,
                  padding: questionIndex === 0 ? "0 0 20px" : "20px 0",
                }}
              >
                <Text
                  style={{
                    color: colours.mintDeep,
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    margin: "0 0 8px",
                    textTransform: "uppercase",
                  }}
                >
                  {String(question.position + 1).padStart(2, "0")} ·{" "}
                  {allMessages.Category[question.category]}
                </Text>
                <Text
                  style={{
                    color: colours.ink,
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "17px",
                    fontWeight: 700,
                    lineHeight: "1.45",
                    margin: options.length > 0 ? "0 0 11px" : 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {question.stem}
                </Text>
                {options.map((option, optionIndex) => (
                  <Option key={`${optionIndex}-${option}`} index={optionIndex}>
                    {option}
                  </Option>
                ))}
              </Section>
            );
          })}

          {entry.includeAnswers ? (
            <Section
              style={{
                borderTop: `1px solid ${colours.border}`,
                paddingTop: "20px",
              }}
            >
              <Text
                style={{
                  color: colours.mintDeep,
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  margin: "0 0 10px",
                  textTransform: "uppercase",
                }}
              >
                {messages.answersHeading}
              </Text>
              {entry.questions.map((question, questionIndex) => (
                <Section
                  key={`answer-${question.position}-${questionIndex}`}
                  style={{ margin: "0 0 10px" }}
                >
                  <Text style={{ color: colours.ink, fontSize: "14px", lineHeight: "1.5", margin: 0 }}>
                    {String(question.position + 1).padStart(2, "0")} ·{" "}
                    {formatEmailAnswer(question, allMessages)}
                  </Text>
                  {question.explanation ? (
                    <Text
                      style={{
                        color: colours.muted,
                        fontSize: "12px",
                        lineHeight: "1.55",
                        margin: "4px 0 0",
                      }}
                    >
                      {question.explanation}
                    </Text>
                  ) : null}
                </Section>
              ))}
            </Section>
          ) : null}

          <Section style={{ marginTop: "4px" }}>
            <Button href={entry.quizUrl} style={buttonStyle}>
              {messages.answerOnWeb}
            </Button>
          </Section>
        </Section>
      ))}
    </EmailShell>
  );
}
