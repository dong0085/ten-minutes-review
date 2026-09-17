import browser from "webextension-polyfill";
import { refreshClassrooms, rebuildMenusFromStorage } from "./classrooms";
import { handleMenuClick } from "./save";

browser.runtime.onInstalled.addListener(() => {
  void refreshClassrooms();
});

browser.runtime.onStartup.addListener(() => {
  void refreshClassrooms();
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  void handleMenuClick(info, tab);
});

// The popup patches storage.local and pings us; menus persist across worker
// restarts, so a plain rebuild from storage is enough.
browser.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === "object" &&
    message !== null &&
    (message as { type?: unknown }).type === "state-changed"
  ) {
    void rebuildMenusFromStorage();
  }
});
