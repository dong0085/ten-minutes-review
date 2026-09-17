export function buildNoteText(selection: string, pageTitle: string, url: string): string {
  let source: string;
  if (pageTitle && url) {
    source = `${pageTitle} (${url})`;
  } else {
    source = pageTitle || url;
  }
  return source ? `${selection}\n\n— ${source}` : selection;
}

export function preview(text: string, length = 80): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length - 1)}…` : clean;
}
