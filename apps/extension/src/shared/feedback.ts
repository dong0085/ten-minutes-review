import browser from "webextension-polyfill";

const SUCCESS_COLOR = "#16a34a";
const ERROR_COLOR = "#dc2626";

export async function flashBadge(text: string, isError: boolean, ms = 3000): Promise<void> {
  await browser.action.setBadgeBackgroundColor({
    color: isError ? ERROR_COLOR : SUCCESS_COLOR,
  });
  await browser.action.setBadgeText({ text });
  setTimeout(() => {
    void browser.action.setBadgeText({ text: "" }).catch(() => undefined);
  }, ms);
}

export async function notify(message: string, title = "Ten Minute Review"): Promise<void> {
  await browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("icons/icon-128.png"),
    title,
    message,
  });
}

// openPopup is gated on a user gesture and missing in older browsers — best effort.
export async function tryOpenPopup(): Promise<void> {
  try {
    const action = browser.action as unknown as { openPopup?: () => Promise<void> };
    await action.openPopup?.();
  } catch {
    // opening the popup is a convenience; ignore failures
  }
}
