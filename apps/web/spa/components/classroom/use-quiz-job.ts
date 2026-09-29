import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { keys } from "@/spa/lib/queries";

type JobStatus = "pending" | "running";
export type QuizJobPhase = "idle" | "posting" | "writing" | "stopped" | "failed";

type JobResponse = {
  status: JobStatus | "done" | "failed" | "cancelled";
  quizId: string | null;
};

const POLL_MS = 3000;
const SLOW_MS = 90_000;

export type QuizJob = ReturnType<typeof useQuizJob>;

/**
 * One on-demand quiz being written in the background. The hub starts it and
 * moves on; the job polls until it settles, then refetches the overview so
 * the new quiz shows up as its own card. A job that turns up in newer
 * overview data (started in another tab, or before a cached overview) is
 * picked up too.
 */
export function useQuizJob(
  classroomId: string,
  latestJob: { id: string; status: JobStatus; requestedAt: string } | null,
) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<QuizJobPhase>(latestJob ? "writing" : "idle");
  const [jobId, setJobId] = useState<string | null>(latestJob?.id ?? null);
  const [status, setStatus] = useState<JobStatus>(latestJob?.status ?? "pending");
  const [startedAt, setStartedAt] = useState(() =>
    latestJob ? Date.parse(latestJob.requestedAt) : Date.now(),
  );
  const [slow, setSlow] = useState(false);
  // The quiz this job just wrote, so its card can make an entrance.
  const [freshQuizId, setFreshQuizId] = useState<string | null>(null);

  // Follow the job the overview reports whenever it changes, unless this hub
  // is already busy with one.
  const [seenJobId, setSeenJobId] = useState<string | null>(latestJob?.id ?? null);
  if ((latestJob?.id ?? null) !== seenJobId) {
    setSeenJobId(latestJob?.id ?? null);
    if (latestJob && latestJob.id !== jobId && phase !== "posting" && phase !== "writing") {
      setJobId(latestJob.id);
      setStatus(latestJob.status);
      setStartedAt(Date.parse(latestJob.requestedAt));
      setSlow(false);
      setPhase("writing");
    }
  }

  useEffect(() => {
    if (phase !== "writing" || !jobId) {
      return;
    }
    let settled = false;
    const interval = setInterval(() => {
      setSlow(Date.now() - startedAt >= SLOW_MS);
      void fetch(`/api/classrooms/${classroomId}/quizzes/jobs/${jobId}`).then(async (response) => {
        if (settled) {
          return;
        }
        const data: JobResponse | null =
          response.status === 404
            ? { status: "failed", quizId: null }
            : response.ok
              ? ((await response.json()) as JobResponse)
              : null;
        if (!data || settled) {
          return;
        }
        if (data.status === "done" && data.quizId) {
          settled = true;
          // Keep the writing card up until the overview carries the new quiz.
          await queryClient.invalidateQueries();
          setFreshQuizId(data.quizId);
          setPhase("idle");
        } else if (data.status === "cancelled") {
          settled = true;
          setPhase("stopped");
        } else if (data.status === "done" || data.status === "failed") {
          // A finished job with no quiz wrote nothing; a failed one ran out of retries.
          settled = true;
          setPhase("failed");
        } else {
          setStatus(data.status);
        }
      });
    }, POLL_MS);
    return () => {
      settled = true;
      clearInterval(interval);
    };
  }, [classroomId, jobId, phase, queryClient, startedAt]);

  const start = useCallback(async () => {
    setPhase("posting");
    setStatus("pending");
    setStartedAt(Date.now());
    setSlow(false);
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/quizzes`, { method: "POST" });
      const data = response.ok ? ((await response.json()) as { jobId?: string | null }) : null;
      if (!data?.jobId) {
        setPhase("failed");
        return;
      }
      setJobId(data.jobId);
      setPhase("writing");
      // Mark the cached overview stale, so coming back to the hub refetches
      // it and finds this job still running.
      void queryClient.invalidateQueries({ queryKey: keys.overview(classroomId) });
    } catch {
      setPhase("failed");
    }
  }, [classroomId, queryClient]);

  const cancel = useCallback(async () => {
    try {
      const response = await fetch(`/api/classrooms/${classroomId}/quizzes/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { outcome?: string };
      // "too_late" means the quiz is already being saved; polling will pick it up.
      if (data.outcome !== "too_late") {
        setPhase("stopped");
      }
    } catch {
      // Keep showing progress; polling will settle the state.
    }
  }, [classroomId]);

  const dismiss = useCallback(() => setPhase("idle"), []);

  return {
    phase,
    freshQuizId,
    busy: phase === "posting" || phase === "writing",
    queued: phase === "posting" || status === "pending",
    slow,
    start,
    cancel,
    dismiss,
  };
}
