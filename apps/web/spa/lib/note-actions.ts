import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { keys } from "./queries";

// A note's reading changes its own screen, the notes list, the bank, and the hub.
function useRefreshNote(classroomId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: keys.uploads(classroomId) });
    void queryClient.invalidateQueries({ queryKey: keys.bank(classroomId) });
    void queryClient.invalidateQueries({ queryKey: keys.overview(classroomId) });
  };
}

/** Saves edited text; the changed lines are read again in the background. */
export function useEditNote(classroomId: string, uploadId: string) {
  const refresh = useRefreshNote(classroomId);
  return useMutation({
    mutationFn: (text: string) =>
      api.patch(`/api/classrooms/${classroomId}/uploads/${uploadId}`, { text }),
    onSettled: refresh,
  });
}

/** Reads the note again as it stands, or retries a failed reading. */
export function useRereadNote(classroomId: string, uploadId: string) {
  const refresh = useRefreshNote(classroomId);
  return useMutation({
    mutationFn: () => api.post(`/api/classrooms/${classroomId}/uploads/${uploadId}/reread`),
    onSettled: refresh,
  });
}

/** Drops a failed edit; the note keeps its current text and points. */
export function useDiscardReread(classroomId: string, uploadId: string) {
  const refresh = useRefreshNote(classroomId);
  return useMutation({
    mutationFn: () => api.delete(`/api/classrooms/${classroomId}/uploads/${uploadId}/reread`),
    onSettled: refresh,
  });
}
