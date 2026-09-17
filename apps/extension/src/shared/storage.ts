import browser from "webextension-polyfill";
import type { RecentSave, StoredState } from "./types";

export const DEFAULT_BASE_URL = "http://localhost:3000";
export const RECENT_SAVES_CAP = 10;

const STORAGE_KEY = "state";

const FALLBACK: StoredState = {
  baseUrl: DEFAULT_BASE_URL,
  token: null,
  user: null,
  classrooms: [],
  defaultClassroomId: null,
  recentSaves: [],
};

// The token lives in storage.local only — never storage.sync, which would
// roam it to every machine signed into the browser account.
export async function getState(): Promise<StoredState> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  const value = stored[STORAGE_KEY] as Partial<StoredState> | undefined;
  return { ...FALLBACK, ...(value ?? {}) };
}

export async function patchState(partial: Partial<StoredState>): Promise<StoredState> {
  const next = { ...(await getState()), ...partial };
  await browser.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function pushRecentSave(save: RecentSave): Promise<void> {
  const { recentSaves } = await getState();
  await patchState({ recentSaves: [save, ...recentSaves].slice(0, RECENT_SAVES_CAP) });
}

export function originPattern(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/*`;
}
