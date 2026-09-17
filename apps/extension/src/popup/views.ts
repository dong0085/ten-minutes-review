import type { StoredState } from "../shared/types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type PopupHandlers = {
  signIn: (email: string, password: string) => Promise<void>;
  useToken: (token: string) => Promise<void>;
  saveBaseUrl: (baseUrl: string) => Promise<void>;
  signOut: () => Promise<void>;
  setDefaultClassroom: (classroomId: string) => Promise<void>;
};

function settingsHtml(baseUrl: string): string {
  return `
    <div class="divider"><span>Server</span></div>
    <form id="settings" class="stack">
      <label for="base-url">Base URL</label>
      <input id="base-url" name="base-url" type="url" required value="${escapeHtml(baseUrl)}" />
      <button type="submit">Save server</button>
    </form>
  `;
}

function wireSettings(root: HTMLElement, handlers: PopupHandlers): void {
  root.querySelector<HTMLFormElement>("#settings")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = (event.currentTarget as HTMLFormElement).querySelector<HTMLInputElement>(
      "#base-url",
    );
    if (input) {
      void handlers.saveBaseUrl(input.value);
    }
  });
}

export function showError(root: HTMLElement, message: string | null): void {
  const element = root.querySelector<HTMLElement>("#error");
  if (!element) return;
  element.textContent = message ?? "";
  element.hidden = !message;
}

export function setBusy(root: HTMLElement, busy: boolean): void {
  root.querySelectorAll("button").forEach((button) => {
    button.disabled = busy;
  });
}

export function renderSignedOut(
  root: HTMLElement,
  state: StoredState,
  handlers: PopupHandlers,
): void {
  root.innerHTML = `
    <header class="header"><h1>Ten Minute Review</h1></header>
    <p class="muted">Save selected text from any page as a study note.</p>
    <form id="sign-in" class="stack">
      <label for="email">Email</label>
      <input id="email" type="email" required autocomplete="username" />
      <label for="password">Password</label>
      <input id="password" type="password" required autocomplete="current-password" />
      <button type="submit" class="primary">Sign in</button>
    </form>
    <div class="divider"><span>or paste a token</span></div>
    <form id="use-token" class="stack">
      <label for="token">API token</label>
      <input id="token" type="password" required placeholder="tmr_…" />
      <button type="submit">Use token</button>
    </form>
    <p class="muted small">Create one in Account → API tokens, then paste it here.</p>
    ${settingsHtml(state.baseUrl)}
    <p id="error" class="error" hidden></p>
  `;

  wireSettings(root, handlers);
  root.querySelector<HTMLFormElement>("#sign-in")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const email = form.querySelector<HTMLInputElement>("#email")?.value ?? "";
    const password = form.querySelector<HTMLInputElement>("#password")?.value ?? "";
    void handlers.signIn(email, password);
  });
  root.querySelector<HTMLFormElement>("#use-token")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const token = form.querySelector<HTMLInputElement>("#token")?.value ?? "";
    void handlers.useToken(token);
  });
}

export function renderSignedIn(
  root: HTMLElement,
  state: StoredState,
  handlers: PopupHandlers,
): void {
  const options =
    state.classrooms
      .map(
        (classroom) =>
          `<option value="${escapeHtml(classroom.id)}"${
            classroom.id === state.defaultClassroomId ? " selected" : ""
          }>${escapeHtml(classroom.name)}</option>`,
      )
      .join("") || `<option value="">No classrooms yet</option>`;

  const saves = state.recentSaves
    .map(
      (save) => `
        <li>
          <p class="save-preview">${escapeHtml(save.preview)}</p>
          <p class="muted small">
            ${escapeHtml(save.classroomName)} · ${escapeHtml(save.title || save.url)} ·
            ${new Date(save.savedAt).toLocaleString()}
          </p>
        </li>
      `,
    )
    .join("");

  root.innerHTML = `
    <header class="header">
      <h1>Ten Minute Review</h1>
      <button id="sign-out" class="link">Sign out</button>
    </header>
    <p class="muted">${escapeHtml(state.user?.email ?? "")}</p>
    <div class="stack">
      <label for="default-classroom">Default classroom</label>
      <select id="default-classroom">${options}</select>
    </div>
    ${
      state.classrooms.length === 0
        ? `<p class="muted small">No classrooms yet — <a href="${escapeHtml(state.baseUrl)}/classrooms" target="_blank" rel="noreferrer">create one on the website</a>.</p>`
        : ""
    }
    ${state.recentSaves.length > 0 ? `<h2>Recent saves</h2><ul class="saves">${saves}</ul>` : ""}
    ${settingsHtml(state.baseUrl)}
    <p id="error" class="error" hidden></p>
  `;

  wireSettings(root, handlers);
  root.querySelector("#sign-out")?.addEventListener("click", () => void handlers.signOut());
  root
    .querySelector<HTMLSelectElement>("#default-classroom")
    ?.addEventListener("change", (event) => {
      void handlers.setDefaultClassroom((event.target as HTMLSelectElement).value);
    });
}
