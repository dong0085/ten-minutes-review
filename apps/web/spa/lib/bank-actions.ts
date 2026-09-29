import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { api } from "./api";
import { keys, type BankItem } from "./queries";

type KnowledgePointJson = Omit<BankItem, "answered" | "missed">;

function useReplaceInBank(classroomId: string) {
  const queryClient = useQueryClient();
  return (id: string, patch: Partial<BankItem>) => {
    queryClient.setQueryData<BankItem[]>(keys.bank(classroomId), (items) =>
      items?.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    // The hub's point count and category totals depend on omitted points.
    void queryClient.invalidateQueries({ queryKey: keys.overview(classroomId) });
  };
}

export function useToggleOmit(classroomId: string) {
  const t = useTranslations("Classroom.BankPage");
  const replace = useReplaceInBank(classroomId);
  return useMutation({
    mutationFn: ({ id, omit }: { id: string; omit: boolean }) =>
      api.post<{ knowledgePoint: { isRetired: boolean; retiredAt: string | null } }>(
        `/api/knowledge-points/${id}/omit`,
        { omit },
      ),
    onSuccess: ({ knowledgePoint }, { id, omit }) => {
      replace(id, { isRetired: knowledgePoint.isRetired, retiredAt: knowledgePoint.retiredAt });
      toast.success(omit ? t("omitSuccess") : t("restoreSuccess"));
    },
    onError: () => toast.error(t("toggleError")),
  });
}

export function useEditPoint(classroomId: string) {
  const t = useTranslations("Classroom.BankPage");
  const replace = useReplaceInBank(classroomId);
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      targetText: string;
      nativeText: string;
      note: string;
    }) => api.patch<{ knowledgePoint: KnowledgePointJson }>(`/api/knowledge-points/${id}`, body),
    onSuccess: ({ knowledgePoint }) => {
      replace(knowledgePoint.id, knowledgePoint);
      toast.success(t("saveSuccess"));
    },
  });
}
