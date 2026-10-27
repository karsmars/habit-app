import { THEMES, GOAL_COLORS } from "./themes.js";
import { button, clear, element, field, input, pageHeading, sectionHeading } from "./ui.js";

export function renderSettings(container, { config, theme, lastSynced, onTheme, onSave, onTest, onExport, onImport, onClearToken }) {
  clear(container);
  container.append(pageHeading("settings-heading", "Settings", "Your preferences and optional cross-device sync."));

  const themeSection = element("section", { className: "settings-section card" }, [
    sectionHeading("Theme"),
    element("p", { className: "muted" }, "This choice is saved on this device."),
    element("div", { className: "theme-grid" }, THEMES.map((item) => {
      const scale = element("span", { className: "theme-preview-scale", "aria-hidden": "true" },
        item.scale.map((color) => element("i", { style: { "--swatch": color } })));
      const preview = element("span", { className: "theme-preview", style: { "--preview-main": item.main } }, [
        element("span", { className: "theme-preview-main" }), scale
      ]);
      return element("button", {
        type: "button", className: "theme-choice", "aria-pressed": item.id === theme,
        onClick: () => onTheme(item.id)
      }, [
        preview,
        element("span", { className: "theme-choice-copy" }, [
          element("strong", {}, item.name),
          element("small", {}, item.style)
        ]),
        item.id === theme ? element("span", { className: "theme-check", "aria-label": "Selected" }, "✓") : null
      ]);
    }))
  ]);

  const ownerInput = input("text", config.owner, { autocomplete: "off", required: true });
  const repoInput = input("text", config.repo, { autocomplete: "off", required: true });
  const pathInput = input("text", config.path, { autocomplete: "off", required: true });
  const tokenInput = input("password", "", { autocomplete: "new-password", placeholder: config.token ? "Saved — enter a new token to replace" : "Paste your fine-grained token", spellcheck: false });
  tokenInput.id = "github-token";
  tokenInput.classList.toggle("hidden", Boolean(config.token));
  const replaceTokenButton = config.token ? button("Replace token", () => {
    tokenInput.classList.remove("hidden");
    tokenInput.focus();
  }, { className: "button small" }) : null;
  const syncError = element("p", { className: "error-text hidden", role: "alert", "data-sync-error": "" });
  const configForm = element("form", { className: "form-grid", autocomplete: "off" }, [
    field("Repository owner", ownerInput),
    field("Repository name", repoInput),
    field("Data file path", pathInput),
    element("div", { className: "field full" }, [
      element("label", { htmlFor: tokenInput.id }, "GitHub access token"),
      config.token ? element("div", { className: "field-hint", style: { "margin-bottom": "6px" } }, "Saved token: ••••••••••••••••") : null,
      tokenInput,
      replaceTokenButton,
      element("span", { className: "field-hint" }, "Fine-grained token limited to this private repo with Contents: Read and write.")
    ]),
    element("div", { className: "field full button-row" }, [
      button("Save settings", () => onSave({
        owner: ownerInput.value.trim(),
        repo: repoInput.value.trim(),
        path: pathInput.value.trim(),
        token: tokenInput.value || config.token
      }, syncError), { className: "button primary" }),
      button("Test connection", () => onTest({
        owner: ownerInput.value.trim(),
        repo: repoInput.value.trim(),
        path: pathInput.value.trim(),
        token: tokenInput.value || config.token
      }, syncError), { className: "button" }),
      config.token ? button("Clear token", onClearToken, { className: "button danger" }) : null
    ])
  ]);
  configForm.addEventListener("submit", (event) => event.preventDefault());
  const connectionSection = element("section", { className: "settings-section card" }, [
    sectionHeading("GitHub sync"),
    element("p", { className: "muted" }, "Optional: the app works without GitHub and saves data in this browser. Connect a private repository here only if you want to sync across devices. A fine-grained token is stored only in this browser."),
    configForm,
    syncError,
    element("p", { className: "field-hint" }, config.token ? "A token is saved on this device. It is never shown or included in sync errors." : "No token is saved. Local use does not require one.")
  ]);

  const fileInput = input("file", "", { accept: "application/json,.json", className: "hidden", "data-import-file": "" });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) onImport(file);
    fileInput.value = "";
  });
  const dataSection = element("section", { className: "settings-section card" }, [
    sectionHeading("Backup and restore"),
    element("p", { className: "muted" }, "Export a complete JSON backup or import one to replace or merge with this device's data."),
    element("div", { className: "button-row" }, [
      button("Export JSON", onExport, { className: "button" }),
      button("Import JSON", () => fileInput.click(), { className: "button" }),
      fileInput
    ])
  ]);
  const aboutSection = element("section", { className: "settings-section card" }, [
    sectionHeading("About"),
    element("p", {}, "Habit App is a personal, offline-friendly habit tracker. Without GitHub sync, your data stays in this browser."),
    element("p", { className: "muted" }, `Last synced: ${lastSynced || "Not connected (local-only use)"}`),
    element("p", { className: "field-hint" }, [
      "Habit App is open source. ",
      element("a", {
        href: "https://github.com/karsmars/habit-app",
        target: "_blank",
        rel: "noopener noreferrer"
      }, "View the public source code on GitHub.")
    ])
  ]);
  container.append(themeSection, connectionSection, dataSection, aboutSection);
}

export function displaySettingsError(target, message) {
  target.textContent = message;
  target.classList.remove("hidden");
}

export function clearSettingsError(target) {
  target.textContent = "";
  target.classList.add("hidden");
}

export { GOAL_COLORS };
