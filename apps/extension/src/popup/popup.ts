import browser from "webextension-polyfill";
import {
  authenticateWithToken,
  revokeCurrentToken,
  signInWithPassword,
} from "../shared/api-client";
import { getState, originPattern, patchState } from "../shared/storage";
import { applyClassrooms, syncClassrooms } from "../shared/sync";
import {
  renderSignedIn,
  renderSignedOut,
  setBusy,
  showError,
  type PopupHandlers,
} from "./views";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("missing #app root");
}

async function notifyStateChanged(): Promise<void> {
  await browser.runtime.sendMessage({ type: "state-changed" }).catch(() => undefined);
}

async function ensureOriginPermission(baseUrl: string): Promise<boolean> {
  return browser.permissions.request({ origins: [originPattern(baseUrl)] });
}

async function safeSyncClassrooms(): Promise<void> {
  try {
    await syncClassrooms();
  } catch {
    // classroom list refreshes on the next popup open or browser start
  }
}

const handlers: PopupHandlers = {
  async signIn(email, password) {
    setBusy(root, true);
    showError(root, null);
    try {
      const { baseUrl } = await getState();
      const granted = await ensureOriginPermission(baseUrl);
      if (!granted) {
        showError(root, `Allow access to ${baseUrl} to sign in.`);
        return;
      }
      const { token, user } = await signInWithPassword(email, password);
      await patchState({ token, user });
      await safeSyncClassrooms();
      await notifyStateChanged();
      await render();
    } catch (error) {
      showError(root, error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setBusy(root, false);
    }
  },

  async useToken(token) {
    setBusy(root, true);
    showError(root, null);
    try {
      const trimmed = token.trim();
      const { baseUrl } = await getState();
      const granted = await ensureOriginPermission(baseUrl);
      if (!granted) {
        showError(root, `Allow access to ${baseUrl} to continue.`);
        return;
      }
      const { user, classrooms } = await authenticateWithToken(trimmed);
      await patchState({ token: trimmed, user });
      await applyClassrooms(classrooms);
      await notifyStateChanged();
      await render();
    } catch (error) {
      showError(root, error instanceof Error ? error.message : "That token did not work.");
    } finally {
      setBusy(root, false);
    }
  },

  async saveBaseUrl(baseUrl) {
    setBusy(root, true);
    showError(root, null);
    try {
      const normalized = baseUrl.trim().replace(/\/+$/, "");
      const granted = await ensureOriginPermission(normalized);
      if (!granted) {
        showError(root, `Permission to access ${normalized} was denied.`);
        return;
      }
      await patchState({ baseUrl: normalized });
      await render();
    } catch {
      showError(root, "Could not save the server URL.");
    } finally {
      setBusy(root, false);
    }
  },

  async signOut() {
    setBusy(root, true);
    await revokeCurrentToken();
    await patchState({
      token: null,
      user: null,
      classrooms: [],
      defaultClassroomId: null,
      recentSaves: [],
    });
    await notifyStateChanged();
    await render();
    setBusy(root, false);
  },

  async setDefaultClassroom(classroomId) {
    await patchState({ defaultClassroomId: classroomId || null });
    await notifyStateChanged();
  },
};

// Arrow (not a hoisted function declaration) so `root` keeps its non-null narrowing here.
const render = async (): Promise<void> => {
  const state = await getState();
  if (state.token && state.user) {
    renderSignedIn(root, state, handlers);
  } else {
    renderSignedOut(root, state, handlers);
  }
};

void (async () => {
  await render();
  const state = await getState();
  if (state.token) {
    await safeSyncClassrooms();
    await notifyStateChanged();
    await render();
  }
})();
