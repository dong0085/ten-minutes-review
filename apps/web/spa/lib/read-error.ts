// Reads the `error` string and optional `code` from a JSON API error response.
export async function readApiError(
  response: Response,
): Promise<{ message: string | null; code: string | null }> {
  const data: unknown = await response.json().catch(() => null);
  if (!data || typeof data !== "object") {
    return { message: null, code: null };
  }
  const { error, code } = data as { error?: unknown; code?: unknown };
  return {
    message: typeof error === "string" ? error : null,
    code: typeof code === "string" ? code : null,
  };
}

// Reads the `error` string from a JSON API error response, if there is one.
export async function readError(response: Response): Promise<string | null> {
  return (await readApiError(response)).message;
}
