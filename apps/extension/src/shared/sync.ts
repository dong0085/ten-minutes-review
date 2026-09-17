import { listClassrooms } from "./api-client";
import { patchState } from "./storage";
import type { ClassroomLite, StoredState } from "./types";

// Store a fresh classroom list and keep the default classroom valid,
// falling back to the first classroom so single-classroom users need no setup.
export async function applyClassrooms(classrooms: ClassroomLite[]): Promise<StoredState> {
  let state = await patchState({ classrooms });
  const defaultId =
    state.defaultClassroomId && classrooms.some((entry) => entry.id === state.defaultClassroomId)
      ? state.defaultClassroomId
      : (classrooms[0]?.id ?? null);
  if (defaultId !== state.defaultClassroomId) {
    state = await patchState({ defaultClassroomId: defaultId });
  }
  return state;
}

export async function syncClassrooms(): Promise<StoredState> {
  return applyClassrooms(await listClassrooms());
}
