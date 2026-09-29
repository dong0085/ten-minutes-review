import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";

/**
 * The slice of Next's router the ported components use. `refresh` refetches
 * every query, which is what a server re-render did for the old pages.
 */
export function useRouter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMemo(
    () => ({
      push: (to: string) => void navigate(to),
      replace: (to: string) => void navigate(to, { replace: true }),
      back: () => void navigate(-1),
      refresh: () => void queryClient.invalidateQueries(),
    }),
    [navigate, queryClient],
  );
}
