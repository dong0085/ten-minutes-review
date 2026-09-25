import { Outlet, useParams } from "react-router";
import { FullPageSpinner } from "@/app/shell";
import { isNotFound } from "@/lib/api";
import { useClassroom } from "@/lib/queries";
import { ErrorPanel } from "./errors";
import { NotFoundPage } from "./not-found";

/** Every screen inside a classroom waits for the classroom itself. */
export function ClassroomLayout() {
  const { id } = useParams();
  const { data, error, isPending, refetch } = useClassroom(id!);
  if (isPending) {
    return <FullPageSpinner />;
  }
  if (isNotFound(error)) {
    return <NotFoundPage />;
  }
  if (error || !data) {
    return <ErrorPanel onRetry={() => void refetch()} />;
  }
  return <Outlet />;
}
