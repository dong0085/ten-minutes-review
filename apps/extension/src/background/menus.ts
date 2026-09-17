import browser from "webextension-polyfill";
import type { ClassroomLite } from "../shared/types";

export const ROOT_MENU_ID = "tmr-save-note";
export const CLASSROOM_MENU_PREFIX = "tmr-classroom-";

export async function rebuildMenus(
  classrooms: ClassroomLite[],
  defaultClassroomId: string | null,
): Promise<void> {
  await browser.contextMenus.removeAll();
  await browser.contextMenus.create({
    id: ROOT_MENU_ID,
    title: "Save selection as note",
    contexts: ["selection"],
  });
  for (const classroom of classrooms) {
    await browser.contextMenus.create({
      id: `${CLASSROOM_MENU_PREFIX}${classroom.id}`,
      parentId: ROOT_MENU_ID,
      title: classroom.name,
      contexts: ["selection"],
      type: "checkbox",
      checked: classroom.id === defaultClassroomId,
    });
  }
}
