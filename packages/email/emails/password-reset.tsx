import { getMessages } from "@tmr/core";
import { ActionEmailTemplate } from "../src/templates";

export default function PasswordResetPreview() {
  const messages = getMessages("fr").Email;
  return (
    <ActionEmailTemplate
      locale="fr"
      heading={messages.resetSubject}
      body={messages.resetBody}
      actionLabel={messages.resetAction}
      actionUrl="https://example.com/reset?token=apercu"
    />
  );
}
