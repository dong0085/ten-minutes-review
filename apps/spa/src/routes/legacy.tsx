import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { api } from "@/lib/api";
import { FullPageSpinner } from "@/app/shell";

/** Sends an old address to its new place, filling `:params` from the current match. */
export function LegacyRedirect({ to }: { to: string }) {
  const params = useParams();
  const target = to.replace(/:(\w+)/g, (_, name: string) => params[name] ?? "");
  return <Navigate to={`/classrooms/${params.id}/${target}`} replace />;
}

/** Results now live under their quiz, so look the quiz up first. */
export function LegacyAttemptRedirect() {
  const { id, attemptId } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    api
      .get<{ attempt: { quizId: string } }>(`/api/attempts/${attemptId}`)
      .then(({ attempt }) =>
        navigate(`/classrooms/${id}/quizzes/${attempt.quizId}/attempts/${attemptId}`, {
          replace: true,
        }),
      )
      .catch(() => navigate(`/classrooms/${id}/quizzes`, { replace: true }));
  }, [attemptId, id, navigate]);
  return <FullPageSpinner />;
}
