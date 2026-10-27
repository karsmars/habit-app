import { formatDate, localDateString, monthStart } from "./dates.js";
import { balance, dayPoints } from "./points.js";
import { mergeData } from "./merge.js";
import { GitHubStorage } from "./storage-github.js";
import {
  emptyData, loadLocalData, makeId, normalizeData,
  readConfig, saveConfig, saveLocalData, timestamp
} from "./state.js";
import { currentTheme, GOAL_COLORS, setTheme } from "./themes.js";
import { clearSettingsError, displaySettingsError, renderSettings } from "./ui-settings.js";
import { renderToday } from "./ui-today.js";
import { renderShop } from "./ui-shop.js";
import { renderProgress } from "./ui-progress.js";
import { renderCalendar } from "./ui-calendar.js";
import { button, element, field, input } from "./ui.js";

const PENDING_KEY = "habit-pending-count";
const LAST_SYNC_KEY = "habit-last-synced";
const dialog = document.querySelector("#app-dialog");
const dialogTitle = document.querySelector("#dialog-title");
const dialogContent = document.querySelector("#dialog-content");
const dialogActions = document.querySelector("#dialog-actions");
const toastNode = document.querySelector("#toast");
const syncStatus = document.querySelector("#sync-status");
const syncLabel = document.querySelector("#sync-label");
const views = Object.fromEntries(["today", "progress", "calendar", "shop", "settings"]
  .map((name) => [name, document.querySelector(`#view-${name}`)]));

let data = bootData();
let config = readConfig();
let storage = new GitHubStorage(config);
let activeTab = "today";
let selectedDate = localDateString();
let calendarMonth = monthStart(selectedDate);
let calendarFilter = null;
let chartRange = 7;
let lastSynced = localStorage.getItem(LAST_SYNC_KEY) || "";
let pendingCount = Number(localStorage.getItem(PENDING_KEY)) || 0;
let lastObservedToday = localDateString();
let syncTimer = null;
let syncInProgress = false;
let syncAgain = false;
let toastTimer = null;

document.querySelectorAll(".tab-button").forEach((tabButton) => {
  tabButton.addEventListener("click", () => showView(tabButton.dataset.tab));
});
document.querySelector("#settings-button").addEventListener("click", () => {
  if (views.settings.classList.contains("active")) showView(activeTab);
  else showView("settings");
});
document.querySelector("#refresh-button").addEventListener("click", () => refreshRemote(true));
window.addEventListener("online", () => refreshRemote(true));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    updateSelectedDayAfterMidnight();
    refreshRemote(true);
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === "habit-theme") {
    setTheme(event.newValue || "sage");
    renderAll();
  }
});
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

renderAll();
setStatus(config.token ? "syncing" : "local");
installServiceWorker();
if (config.token) refreshRemote(true);
else if (pendingCount) setStatus("local");

function bootData() {
  try {
    return loadLocalData();
  } catch (error) {
    window.setTimeout(() => notify(error.message), 0);
    return emptyData();
  }
}

function showView(name) {
  if (!views[name]) return;
  if (name !== "settings") activeTab = name;
  for (const [viewName, view] of Object.entries(views)) {
    const active = name === viewName;
    view.classList.toggle("active", active);
    view.hidden = !active;
  }
  document.querySelectorAll(".tab-button").forEach((tabButton) => {
    const active = name !== "settings" && tabButton.dataset.tab === name;
    tabButton.classList.toggle("active", active);
    if (active) tabButton.setAttribute("aria-current", "page");
    else tabButton.removeAttribute("aria-current");
  });
  if (name === "settings") document.querySelector("#settings-button").setAttribute("aria-pressed", "true");
  else document.querySelector("#settings-button").removeAttribute("aria-pressed");
  renderAll();
  document.querySelector("#main-content").focus({ preventScroll: true });
}

function renderAll() {
  renderToday(views.today, {
    data, date: selectedDate, configured: storage.configured,
    onDate: (date) => { selectedDate = date; renderAll(); },
    onToggle: toggleCompletion,
    onAdd: () => editGoal(),
    onEdit: (goal) => editGoal(goal),
    onArchive: archiveGoal,
    onDelete: deleteGoal,
    onMove: moveGoal,
    onSettings: () => showView("settings")
  });
  renderShop(views.shop, {
    data,
    onAdd: () => editReward(),
    onEdit: (reward) => editReward(reward),
    onArchive: archiveReward,
    onDelete: deleteReward,
    onBuy: buyReward,
    onRefund: refundPurchase
  });
  renderProgress(views.progress, { data, range: chartRange, onRange: (range) => { chartRange = range; renderAll(); } });
  renderCalendar(views.calendar, {
    data, month: calendarMonth, filterId: calendarFilter,
    onMonth: (month) => { calendarMonth = month; renderAll(); },
    onFilter: (id) => { calendarFilter = id; renderAll(); },
    onDay: (date) => showDayDetails(date)
  });
  renderSettings(views.settings, {
    config, theme: currentTheme(), lastSynced,
    onTheme: (theme) => { setTheme(theme); renderAll(); },
    onSave: saveSettings,
    onTest: testConnection,
    onExport: exportData,
    onImport: importData,
    onClearToken: clearToken
  });
}

function updateSelectedDayAfterMidnight() {
  const todayNow = localDateString();
  if (selectedDate === lastObservedToday) selectedDate = todayNow;
  lastObservedToday = todayNow;
}

function setStatus(state, message = "") {
  syncStatus.dataset.state = state;
  if (state === "syncing") syncLabel.textContent = "Syncing…";
  else if (state === "synced") syncLabel.textContent = "Synced";
  else if (state === "offline") syncLabel.textContent = `Offline · ${pendingCount} pending`;
  else if (state === "error") syncLabel.textContent = "Sync error";
  else syncLabel.textContent = storage.configured ? "Not synced" : "Local only";
  syncStatus.title = message || syncLabel.textContent;
}

function updatePendingCount(value) {
  pendingCount = Math.max(0, value);
  localStorage.setItem(PENDING_KEY, String(pendingCount));
}

function commitLocalChange(nextData = data) {
  data = normalizeData(nextData);
  saveLocalData(data);
  updatePendingCount(pendingCount + 1);
  setStatus(navigator.onLine && storage.configured ? "syncing" : storage.configured ? "offline" : "setup");
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => pushPending(), 1500);
  renderAll();
}

async function pushPending() {
  if (!storage.configured) {
    setStatus("local");
    return;
  }
  if (!navigator.onLine) {
    setStatus("offline");
    return;
  }
  if (syncInProgress) {
    syncAgain = true;
    return;
  }
  syncInProgress = true;
  setStatus("syncing");
  try {
    const result = await storage.sync(data, (merged) => {
      data = normalizeData(merged);
      saveLocalData(data);
      renderAll();
    });
    data = normalizeData(result.data);
    saveLocalData(data);
    updatePendingCount(0);
    lastSynced = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, lastSynced);
    setStatus("synced");
    renderAll();
  } catch (error) {
    setStatus(navigator.onLine ? "error" : "offline", error.message);
    notify(error.message);
  } finally {
    syncInProgress = false;
    if (syncAgain) {
      syncAgain = false;
      if (pendingCount) pushPending();
      else refreshRemote(false);
    }
  }
}

async function refreshRemote(showErrors) {
  if (!storage.configured) {
    setStatus("local");
    return;
  }
  if (!navigator.onLine) {
    setStatus("offline");
    return;
  }
  if (syncInProgress) {
    syncAgain = true;
    return;
  }
  syncInProgress = true;
  setStatus("syncing");
  try {
    const remote = await storage.fetchRemote();
    const remoteData = normalizeData(remote.data);
    data = mergeData(data, remoteData);
    data = normalizeData(data);
    saveLocalData(data);
    const needsUpload = !sameData(data, remoteData) || pendingCount > 0;
    if (needsUpload) {
      updatePendingCount(Math.max(1, pendingCount));
      renderAll();
      syncInProgress = false;
      await pushPending();
      return;
    }
    updatePendingCount(0);
    lastSynced = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, lastSynced);
    setStatus("synced");
    renderAll();
  } catch (error) {
    setStatus(navigator.onLine ? "error" : "offline", error.message);
    if (showErrors) notify(error.message);
  } finally {
    syncInProgress = false;
    if (syncAgain) {
      syncAgain = false;
      if (pendingCount) pushPending();
    }
  }
}

function sameData(left, right) {
  const canonical = (value) => JSON.stringify({
    version: value.version,
    goals: value.goals.slice().sort(byId),
    completions: value.completions.slice().sort(byId),
    rewards: value.rewards.slice().sort(byId),
    purchases: value.purchases.slice().sort(byId)
  });
  return canonical(left) === canonical(right);
}

function byId(a, b) {
  return a.id.localeCompare(b.id);
}

function toggleCompletion(goal, date) {
  const existing = data.completions.find((item) => item.goalId === goal.id && item.date === date && !item.deleted);
  const now = timestamp();
  const completions = existing
    ? data.completions.map((item) => item.id === existing.id ? { ...item, deleted: true, updatedAt: now } : item)
    : [...data.completions, { id: makeId(), date, goalId: goal.id, points: goal.points, deleted: false, updatedAt: now }];
  commitLocalChange({ ...data, completions });
}

function showDayDetails(date) {
  const refreshDetails = () => {
    const completed = data.completions.filter((item) => item.date === date && !item.deleted);
    const list = element("div", { className: "goal-list" });
    const goals = data.goals.filter((goal) => !goal.deleted);
    if (!goals.length) list.append(element("p", { className: "muted" }, "No habits to show."));
    for (const goal of goals) {
      const completion = completed.find((item) => item.goalId === goal.id);
      const row = element("div", { className: `goal-row${completion ? " completed" : ""}` }, [
        element("span", { className: "goal-check", "aria-hidden": "true" }, completion ? "✓" : ""),
        element("span", { className: "goal-emoji", "aria-hidden": "true" }, goal.emoji || "•"),
        element("span", { className: "goal-name", style: { flex: "1" } }, goal.name),
        completion ? element("span", { className: "points-badge" }, `${completion.points} pts`) : null,
        button(completion ? "Undo" : "Complete", () => {
          toggleCompletion(goal, date);
          refreshDetails();
        }, { className: "button small" })
      ]);
      list.append(row);
    }
    dialogContent.replaceChildren(
      element("p", { className: "muted" }, `${formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${dayPoints(data, date)} points`),
      list
    );
    dialogActions.replaceChildren(button("Done", () => dialog.close(), { className: "button primary" }));
    if (!dialog.open) dialog.showModal();
  };
  dialogTitle.textContent = "Day details";
  refreshDetails();
}

function editGoal(goal = null) {
  let selectedColor = goal?.color || GOAL_COLORS[5];
  const nameInput = input("text", goal?.name || "", { maxlength: 80, required: true, autocomplete: "off" });
  const emojiInput = input("text", goal?.emoji || "", { maxlength: 8, placeholder: "e.g. 🏃", autocomplete: "off" });
  const pointsInput = input("number", goal?.points ?? 5, { min: "0", max: "100000", step: "1", required: true });
  const colors = element("div", { className: "color-options", role: "group", "aria-label": "Habit color" });
  const drawColors = () => {
    colors.replaceChildren(...GOAL_COLORS.map((color) => element("button", {
      type: "button", className: "color-option", "aria-label": `Choose color ${color}`,
      "aria-pressed": selectedColor === color,
      style: { "background-color": color },
      onClick: () => { selectedColor = color; drawColors(); }
    })));
  };
  drawColors();
  showDialog(goal ? "Edit habit" : "Add a habit", element("div", { className: "form-grid" }, [
    field("Name", nameInput), field("Emoji", emojiInput, "Optional"),
    field("Points", pointsInput), element("div", { className: "field" }, [element("label", {}, "Color"), colors])
  ]), [
    button("Cancel", () => dialog.close(), { className: "button" }),
    button("Save habit", () => {
      const name = nameInput.value.trim();
      const points = Number(pointsInput.value);
      if (!name || !Number.isInteger(points) || points < 0 || points > 100000) {
        notify("Enter a habit name and a whole-number point value from 0 to 100,000.");
        return;
      }
      const now = timestamp();
      const updated = {
        ...(goal || {}),
        id: goal?.id || makeId(),
        name, emoji: emojiInput.value.trim(), points, color: selectedColor,
        archived: goal?.archived || false, deleted: false,
        createdAt: goal?.createdAt || now, updatedAt: now,
        order: goal?.order ?? Math.max(-1, ...data.goals
          .filter((item) => !item.deleted && !item.archived)
          .map((item) => item.order)) + 1
      };
      const goals = goal ? data.goals.map((item) => item.id === goal.id ? updated : item) : [...data.goals, updated];
      dialog.close();
      commitLocalChange({ ...data, goals });
    }, { className: "button primary" })
  ]);
}

function archiveGoal(goal) {
  confirmDialog("Archive habit?", `${goal.name} will no longer appear in your checklist, but its history will be kept.`, () => {
    const goals = data.goals.map((item) => item.id === goal.id ? { ...item, archived: true, updatedAt: timestamp() } : item);
    commitLocalChange({ ...data, goals });
  });
}

function deleteGoal(goal) {
  confirmDialog("Delete habit?", `${goal.name} will be hidden from your lists. Existing history is retained.`, () => {
    const goals = data.goals.map((item) => item.id === goal.id ? { ...item, deleted: true, updatedAt: timestamp() } : item);
    commitLocalChange({ ...data, goals });
  });
}

function moveGoal(goal, direction) {
  const ordered = data.goals.filter((item) => !item.deleted && !item.archived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const index = ordered.findIndex((item) => item.id === goal.id);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
  [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
  const now = timestamp();
  const orders = new Map(ordered.map((item, order) => [item.id, order]));
  const goals = data.goals.map((item) => orders.has(item.id)
    ? { ...item, order: orders.get(item.id), updatedAt: now }
    : item);
  commitLocalChange({ ...data, goals });
}

function editReward(reward = null) {
  const nameInput = input("text", reward?.name || "", { maxlength: 80, required: true, autocomplete: "off" });
  const emojiInput = input("text", reward?.emoji || "", { maxlength: 8, placeholder: "e.g. ☕", autocomplete: "off" });
  const costInput = input("number", reward?.cost ?? 25, { min: "0", max: "1000000", step: "1", required: true });
  const repeatableInput = element("input", { type: "checkbox", checked: reward?.repeatable ?? true });
  showDialog(reward ? "Edit reward" : "Add a reward", element("div", { className: "form-grid" }, [
    field("Name", nameInput), field("Emoji", emojiInput, "Optional"), field("Cost in points", costInput),
    element("label", { className: "field", style: { "grid-template-columns": "auto 1fr", "align-items": "center", "align-self": "end" } }, [
      repeatableInput, "Can be purchased more than once"
    ])
  ]), [
    button("Cancel", () => dialog.close(), { className: "button" }),
    button("Save reward", () => {
      const name = nameInput.value.trim();
      const cost = Number(costInput.value);
      if (!name || !Number.isInteger(cost) || cost < 0 || cost > 1000000) {
        notify("Enter a reward name and a whole-number cost from 0 to 1,000,000.");
        return;
      }
      const now = timestamp();
      const updated = {
        ...(reward || {}),
        id: reward?.id || makeId(), name, emoji: emojiInput.value.trim(), cost,
        repeatable: repeatableInput.checked, archived: reward?.archived || false, deleted: false,
        createdAt: reward?.createdAt || now, updatedAt: now
      };
      const rewards = reward ? data.rewards.map((item) => item.id === reward.id ? updated : item) : [...data.rewards, updated];
      dialog.close();
      commitLocalChange({ ...data, rewards });
    }, { className: "button primary" })
  ]);
}

function archiveReward(reward) {
  confirmDialog("Archive reward?", `${reward.name} will be hidden from the shop, but purchase history will remain.`, () => {
    const rewards = data.rewards.map((item) => item.id === reward.id ? { ...item, archived: true, updatedAt: timestamp() } : item);
    commitLocalChange({ ...data, rewards });
  });
}

function deleteReward(reward) {
  confirmDialog("Delete reward?", `${reward.name} will be hidden from the shop. Existing purchases are retained.`, () => {
    const rewards = data.rewards.map((item) => item.id === reward.id ? { ...item, deleted: true, updatedAt: timestamp() } : item);
    commitLocalChange({ ...data, rewards });
  });
}

function buyReward(reward) {
  if (balance(data) < reward.cost) return;
  confirmDialog("Buy this reward?", `Spend ${reward.cost} points on ${reward.name}?`, () => {
    if (balance(data) < reward.cost) {
      notify("Your balance changed before the purchase could be made.");
      return;
    }
    const now = timestamp();
    const purchases = [...data.purchases, {
      id: makeId(), rewardId: reward.id, rewardName: reward.name, cost: reward.cost,
      date: localDateString(), refunded: false, updatedAt: now
    }];
    commitLocalChange({ ...data, purchases });
  });
}

function refundPurchase(purchase) {
  confirmDialog("Refund purchase?", `Return ${purchase.cost} points for ${purchase.rewardName}?`, () => {
    const purchases = data.purchases.map((item) => item.id === purchase.id
      ? { ...item, refunded: true, updatedAt: timestamp() }
      : item);
    commitLocalChange({ ...data, purchases });
  });
}

async function saveSettings(candidate, errorTarget) {
  clearSettingsError(errorTarget);
  if (!candidate.owner || !candidate.repo || !candidate.path || !candidate.token) {
    displaySettingsError(errorTarget, "Owner, repository, file path, and access token are required.");
    return;
  }
  config = candidate;
  saveConfig(config);
  storage = new GitHubStorage(config);
  setStatus("syncing");
  try {
    await refreshRemote(false);
    if (syncStatus.dataset.state === "error") throw new Error(syncStatus.title);
    notify("Sync settings saved.");
    renderAll();
  } catch (error) {
    displaySettingsError(errorTarget, error.message);
  }
}

async function testConnection(candidate, errorTarget) {
  clearSettingsError(errorTarget);
  if (!candidate.owner || !candidate.repo || !candidate.path || !candidate.token) {
    displaySettingsError(errorTarget, "Enter the repository owner, name, file path, and token first.");
    return;
  }
  try {
    const testStorage = new GitHubStorage(candidate);
    await testStorage.testConnection();
    notify("Connection successful. The configured data file is accessible.");
  } catch (error) {
    displaySettingsError(errorTarget, error.message);
  }
}

function clearToken() {
  confirmDialog("Clear saved token?", "Remote syncing will stop on this device until another token is saved. Local data will remain.", () => {
    config = { ...config, token: "" };
    saveConfig(config);
    storage = new GitHubStorage(config);
    setStatus("setup");
    renderAll();
  });
}

function exportData() {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = element("a", { href: url, download: `habit-data-${localDateString()}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  notify("Backup exported.");
}

async function importData(file) {
  try {
    const imported = normalizeData(JSON.parse(await file.text()));
    showDialog("Import data", element("div", {}, [
      element("p", {}, "Choose whether to replace this device's data or merge the import with the existing data."),
      element("p", { className: "muted" }, `${imported.goals.length} habits, ${imported.completions.length} completions, ${imported.rewards.length} rewards, and ${imported.purchases.length} purchases.`)
    ]), [
      button("Cancel", () => dialog.close(), { className: "button" }),
      button("Merge", () => {
        dialog.close();
        commitLocalChange(mergeData(data, imported));
        notify("Imported data merged.");
      }, { className: "button" }),
      button("Replace", () => {
        dialog.close();
        commitLocalChange(imported);
        notify("Data replaced from backup.");
      }, { className: "button primary" })
    ]);
  } catch (error) {
    notify(`Import failed: ${error.message}`);
  }
}

function showDialog(title, content, actions) {
  dialogTitle.textContent = title;
  dialogContent.replaceChildren(content);
  dialogActions.replaceChildren(...actions);
  if (!dialog.open) dialog.showModal();
}

function confirmDialog(title, message, onConfirm) {
  showDialog(title, element("p", {}, message), [
    button("Cancel", () => dialog.close(), { className: "button" }),
    button("Confirm", () => { dialog.close(); onConfirm(); }, { className: "button primary" })
  ]);
}

function notify(message) {
  toastNode.textContent = message;
  toastNode.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastNode.classList.remove("visible"), 4500);
}

function installServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).then((registration) => {
    const showUpdate = () => {
      const waiting = registration.waiting;
      if (!waiting) return;
      document.querySelector(".update-banner")?.remove();
      const banner = element("aside", { className: "update-banner", role: "status" }, [
        element("span", {}, "A new version is ready."),
        button("Update", () => waiting.postMessage("SKIP_WAITING"), { className: "button small primary" })
      ]);
      document.body.append(banner);
    };
    showUpdate();
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      installing?.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) showUpdate();
      });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    registration.update().catch(() => notify("The app could not check for updates. It will keep working offline."));
  }).catch((error) => {
    notify(`Offline support could not be enabled: ${error.message}`);
  });
}
