import { getMessages } from "@tmr/core";
import { ActionEmailTemplate } from "../src/templates";

export default function VerificationPreview() {
  const messages = getMessages("en").Email;
  return (
    <ActionEmailTemplate
      locale="en"
      heading={messages.verificationSubject}
      body={messages.verificationBody}
      actionLabel={messages.verificationAction}
      actionUrl="https://example.com/verify?token=preview"
    />
  );
}
