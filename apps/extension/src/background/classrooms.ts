import { syncClassrooms } from "../shared/sync";
import { getState } from "../shared/storage";
import { rebuildMenus } from "./menus";

export async function rebuildMenusFromStorage(): Promise<void> {
  const state = await getState();
  await rebuildMenus(state.classrooms, state.defaultClassroomId);
}

export async function refreshClassrooms(): Promise<void> {
  const { token } = await getState();
  if (token) {
    try {
      await syncClassrooms();
    } catch {
      // signed out since startup or server unreachable — keep the cached list
    }
  }
  await rebuildMenusFromStorage();
}
