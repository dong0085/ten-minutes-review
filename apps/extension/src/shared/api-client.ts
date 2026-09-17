import type { ClassroomLite, PublicUserLite } from "./types";
import { DEFAULT_BASE_URL, getState } from "./storage";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function ensureOk(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  let message = `Request failed (${response.status})`;
  try {
    const data: unknown = await response.json();
    if (
      data !== null &&
      typeof data === "object" &&
      typeof (data as { error?: unknown }).error === "string"
    ) {
      message = (data as { error: string }).error;
    }
  } catch {
    // non-JSON body — keep the default message
  }
  throw new ApiError(response.status, message);
}

async function authedFetch(
  path: string,
  init: RequestInit = {},
  tokenOverride?: string,
): Promise<Response> {
  const { token } = await getState();
  const headers = new Headers(init.headers);
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  const tokenToUse = tokenOverride ?? token;
  if (tokenToUse) {
    headers.set("authorization", `Bearer ${tokenToUse}`);
  }
  const response = await fetch(`${DEFAULT_BASE_URL}${path}`, { ...init, headers });
  await ensureOk(response);
  return response;
}

function toLite(user: {
  id: string;
  email: string;
  username: string | null;
}): PublicUserLite {
  return { id: user.id, email: user.email, username: user.username };
}

export async function listClassrooms(token?: string): Promise<ClassroomLite[]> {
  const response = await authedFetch("/api/classrooms", {}, token);
  const data = (await response.json()) as { classrooms?: { id: string; name: string }[] };
  return (data.classrooms ?? []).map((classroom) => ({
    id: classroom.id,
    name: classroom.name,
  }));
}

export async function createTextUpload(classroomId: string, text: string): Promise<void> {
  await authedFetch(`/api/classrooms/${classroomId}/uploads`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<{ token: string; user: PublicUserLite }> {
  const response = await fetch(`${DEFAULT_BASE_URL}/api/auth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, deviceName: "Browser extension" }),
  });
  await ensureOk(response);
  const data = (await response.json()) as {
    token: string;
    user: { id: string; email: string; username: string | null };
  };
  return { token: data.token, user: toLite(data.user) };
}

export async function authenticateWithToken(
  token: string,
): Promise<{ user: PublicUserLite; classrooms: ClassroomLite[] }> {
  const [meResponse, classroomsResponse] = await Promise.all([
    authedFetch("/api/me", {}, token),
    authedFetch("/api/classrooms", {}, token),
  ]);
  const meData = (await meResponse.json()) as {
    user: { id: string; email: string; username: string | null };
  };
  const classroomsData = (await classroomsResponse.json()) as {
    classrooms: { id: string; name: string }[];
  };
  return {
    user: toLite(meData.user),
    classrooms: classroomsData.classrooms.map((classroom) => ({
      id: classroom.id,
      name: classroom.name,
    })),
  };
}

// Best effort — sign-out should succeed locally even when the call fails.
export async function revokeCurrentToken(): Promise<void> {
  await authedFetch("/api/auth/token/revoke", { method: "POST" }).catch(() => undefined);
}
