import browser from "webextension-polyfill";
import { ApiError, createTextUpload } from "../shared/api-client";
import { flashBadge, notify, tryOpenPopup } from "../shared/feedback";
import { buildNoteText, preview } from "../shared/format";
import { DEFAULT_BASE_URL, getState, originPattern, pushRecentSave } from "../shared/storage";
import { CLASSROOM_MENU_PREFIX } from "./menus";

// info.selectionText can be truncated or empty on some selections (and in
// Firefox); the menu click grants activeTab, so read the real selection
// straight from the page and fall back to the menu text when injection fails
// (chrome:// pages, PDFs, extension pages).
async function readSelection(tab: browser.Tabs.Tab | undefined, fallback: string): Promise<string> {
  if (tab?.id === undefined) {
    return fallback;
  }
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => String(window.getSelection() ?? ""),
    });
    const text = results[0]?.result;
    return typeof text === "string" && text.trim() ? text : fallback;
  } catch {
    return fallback;
  }
}

export async function handleMenuClick(
  info: browser.Menus.OnClickData,
  tab: browser.Tabs.Tab | undefined,
): Promise<void> {
  const selection = (await readSelection(tab, info.selectionText ?? "")).trim();
  if (!selection) {
    await flashBadge("!", true);
    await notify("No selectable text was found on this page.");
    return;
  }

  const state = await getState();
  if (!state.token) {
    await flashBadge("!", true);
    await notify("Sign in from the extension popup first.");
    await tryOpenPopup();
    return;
  }

  const hasPermission = await browser.permissions.contains({
    origins: [originPattern(DEFAULT_BASE_URL)],
  });
  if (!hasPermission) {
    await flashBadge("!", true);
    await notify(`Allow access to ${DEFAULT_BASE_URL} in the extension's permissions, then try again.`);
    return;
  }

  const clickedId = typeof info.menuItemId === "string" ? info.menuItemId : "";
  const classroomId = clickedId.startsWith(CLASSROOM_MENU_PREFIX)
    ? clickedId.slice(CLASSROOM_MENU_PREFIX.length)
    : state.defaultClassroomId;
  const classroom = state.classrooms.find((entry) => entry.id === classroomId);
  if (!classroom) {
    await flashBadge("!", true);
    await notify("Pick a classroom first — open the extension popup.");
    await tryOpenPopup();
    return;
  }

  const pageTitle = tab?.title ?? "";
  const pageUrl = info.pageUrl ?? tab?.url ?? "";

  try {
    await createTextUpload(classroom.id, buildNoteText(selection, pageTitle, pageUrl));
    await pushRecentSave({
      classroomId: classroom.id,
      classroomName: classroom.name,
      preview: preview(selection),
      title: pageTitle,
      url: pageUrl,
      savedAt: new Date().toISOString(),
    });
    await flashBadge("✓", false);
    await notify(`Saved to ${classroom.name}`);
  } catch (error) {
    await flashBadge("!", true);
    if (error instanceof ApiError && error.status === 401) {
      await notify("Signed out or token revoked — sign in again from the popup.");
      await tryOpenPopup();
    } else if (error instanceof ApiError) {
      await notify(error.message);
    } else {
      await notify(`Could not reach ${DEFAULT_BASE_URL}. Is the server running?`);
    }
  }
}
