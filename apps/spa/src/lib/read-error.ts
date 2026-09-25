// Reads the `error` string from a JSON API error response, if there is one.
export async function readError(response: Response): Promise<string | null> {
  const data: unknown = await response.json().catch(() => null);
  if (data && typeof data === "object" && "error" in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === "string") {
      return message;
    }
  }
  return null;
}
