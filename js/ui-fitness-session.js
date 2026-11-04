// Logging a workout session. The in-progress session lives in module state (and localStorage), not in the DOM,
// so a background sync re-render or an app reload in the middle of a workout never loses what was typed.
import {
  activeExercises, defaultUnit, detectPRs, findExercise, findExerciseByName, formatMetric, formatSets, formatTarget,
  KINDS, lastSession, progressionHint, suggestSet
} from "./fitness.js";
import { makeId, timestamp, today } from "./state.js";
import { button, element, field, input } from "./ui.js";

const DRAFT_KEY = "habit-fitness-draft";
const FIELDS = ["weight", "reps", "seconds", "distance", "minutes"];

let draft = loadDraft();
let pendingFocus = null;

function loadDraft() {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    return value && Array.isArray(value.entries) && typeof value.date === "string" ? value : null;
  } catch {
    return null;
  }
}

function persist() {
  if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  else localStorage.removeItem(DRAFT_KEY);
}

export function sessionActive() {
  return draft !== null;
}

export function discardSession() {
  draft = null;
  persist();
}

// A fully prefilled draft entry: every set starts with the same suggested weight and reps, ready to edit.
function prefilledEntry(data, exerciseId, target, rowCount = null) {
  const exercise = findExercise(data, exerciseId);
  const last = exercise ? lastSession(data, exerciseId, { beforeDate: today() }) : null;
  const { set, source, e1rm } = exercise ? suggestSet(exercise.kind, exercise.unit, last?.sets, target || {}) : { set: {}, source: null, e1rm: null };
  const rows = rowCount ?? (last ? last.sets.length : 1);
  return {
    exerciseId, target: target || null, prefill: source ? { source, e1rm } : null,
    sets: Array.from({ length: Math.max(1, rows) }, () => ({ ...blankSet(), ...setToStrings(set) }))
  };
}

const blankSet = () => ({ weight: "", reps: "", seconds: "", distance: "", minutes: "" });

function setToStrings(set) {
  return Object.fromEntries(FIELDS.map((key) => [key, Number.isFinite(set[key]) ? String(set[key]) : ""]));
}

// Start a new session from a workout (or empty), or edit an existing log.
export function startSession(data, { workout = null, log = null } = {}) {
  if (log) {
    draft = {
      logId: log.id, date: log.date, workoutId: log.workoutId || null, name: log.name || "", notes: log.notes || "",
      entries: log.entries.map((entry) => ({ exerciseId: entry.exerciseId, target: null, sets: entry.sets.map(setToStrings) }))
    };
  } else {
    draft = {
      logId: null, date: today(), workoutId: workout?.id || null, name: workout?.name || "Workout", notes: "",
      entries: (workout?.items || []).map((item) => prefilledEntry(
        data, item.exerciseId,
        { setsMin: item.setsMin, setsMax: item.setsMax, targetMin: item.targetMin, targetMax: item.targetMax },
        item.setsMin || item.setsMax || 1
      ))
    };
    draft.pristine = JSON.stringify(draft.entries);
  }
  persist();
}

function inputFields(kind, unit) {
  if (kind === "time") return [{ key: "seconds", label: "Seconds", step: "1" }];
  if (kind === "cardio") return [{ key: "distance", label: `Distance${unit ? ` (${unit})` : ""}`, step: "any" }, { key: "minutes", label: "Minutes", step: "any" }];
  if (kind === "bodyweight") return [{ key: "reps", label: "Reps", step: "1" }, { key: "weight", label: `Added${unit ? ` (${unit})` : ""}`, step: "any" }];
  return [{ key: "weight", label: `Weight${unit ? ` (${unit})` : ""}`, step: "any" }, { key: "reps", label: "Reps", step: "1" }];
}

export function renderSession(container, ctx, redraw) {
  const data = ctx.getData();
  const editing = Boolean(draft.logId);
  const exercises = activeExercises(data);

  const dateInput = input("date", draft.date, { max: today(), required: true });
  dateInput.addEventListener("change", () => {
    if (dateInput.value) { draft.date = dateInput.value; persist(); }
  });
  const nameInput = input("text", draft.name, { maxlength: 60, autocomplete: "off" });
  nameInput.addEventListener("input", () => { draft.name = nameInput.value; persist(); });

  container.append(
    element("div", { className: "section-heading" }, [
      element("h2", {}, editing ? "Edit workout" : "Log workout"),
      button("Cancel", () => cancelSession(ctx, redraw), { className: "button small" })
    ]),
    element("div", { className: "card form-grid session-meta" }, [field("Workout", nameInput), field("Date", dateInput)])
  );

  const list = element("div", { className: "session-list" });
  draft.entries.forEach((entry, entryIndex) => list.append(entryCard(ctx, data, entry, entryIndex, redraw)));
  if (!draft.entries.length) {
    list.append(element("div", { className: "empty-state" }, [
      element("strong", {}, "No exercises yet"),
      element("span", {}, "Add the exercises you did below.")
    ]));
  }
  container.append(list, addExerciseCard(ctx, data, exercises, redraw));

  const notes = input("text", draft.notes, { maxlength: 200, placeholder: "How did it feel? (optional)", autocomplete: "off" });
  notes.addEventListener("input", () => { draft.notes = notes.value; persist(); });
  container.append(
    element("div", { className: "card", style: { "margin-top": "12px" } }, field("Notes", notes)),
    element("div", { className: "button-row session-actions" }, [
      button(editing ? "Save changes" : "Finish workout", () => saveSession(ctx), { className: "button primary" }),
      editing ? button("Delete workout", () => deleteLog(ctx), { className: "button danger" }) : null
    ])
  );
  if (pendingFocus) {
    container.querySelector(pendingFocus)?.focus();
    pendingFocus = null;
  }
}

function entryCard(ctx, data, entry, entryIndex, redraw) {
  const exercise = findExercise(data, entry.exerciseId);
  if (!exercise) return element("div", { className: "card muted" }, "This exercise is no longer available.");
  const last = lastSession(data, exercise.id, { beforeDate: draft.date, excludeLogId: draft.logId });
  const target = entry.target ? formatTarget(entry.target, exercise.kind) : "";
  const hint = progressionHint(last?.sets, entry.target, exercise.kind);
  const fields = inputFields(exercise.kind, exercise.unit);

  const controls = [];
  const rows = entry.sets.map((set, setIndex) => {
    const reference = last?.sets[setIndex] || last?.sets[last.sets.length - 1] || {};
    controls[setIndex] = {};
    const inputs = fields.map((spec) => {
      const control = input("number", set[spec.key], {
        inputmode: "decimal", min: "0", step: spec.step, placeholder: Number.isFinite(reference[spec.key]) ? String(reference[spec.key]) : spec.label,
        "aria-label": `${exercise.name} set ${setIndex + 1} ${spec.label}`
      });
      controls[setIndex][spec.key] = control;
      // Sets below that still match the value being replaced follow along, so changing one number fixes them all.
      control.addEventListener("input", () => {
        const previous = set[spec.key];
        set[spec.key] = control.value;
        for (let later = setIndex + 1; later < entry.sets.length; later += 1) {
          if (entry.sets[later][spec.key] !== previous) continue;
          entry.sets[later][spec.key] = control.value;
          controls[later][spec.key].value = control.value;
        }
        persist();
      });
      return element("label", { className: "set-field" }, [element("span", {}, spec.label), control]);
    });
    return element("div", { className: "set-row" }, [
      element("span", { className: "set-index" }, `Set ${setIndex + 1}`),
      ...inputs,
      button("×", () => { entry.sets.splice(setIndex, 1); persist(); redraw(); }, { className: "icon-button", ariaLabel: `Remove set ${setIndex + 1} of ${exercise.name}`, title: "Remove set" })
    ]);
  });

  return element("article", { className: "card entry-card", dataset: { entryIndex: String(entryIndex) } }, [
    element("div", { className: "entry-head" }, [
      element("div", {}, [
        element("strong", {}, exercise.name),
        target ? element("span", { className: "goal-meta" }, `Target ${target}`) : null,
        last ? element("span", { className: "goal-meta" }, `Last (${last.date}): ${formatSets(last.sets, exercise.kind, exercise.unit)}`) : null
      ]),
      button("×", () => { draft.entries.splice(entryIndex, 1); persist(); redraw(); }, { className: "icon-button", ariaLabel: `Remove ${exercise.name} from this workout`, title: "Remove exercise" })
    ]),
    hint ? element("p", { className: "progress-hint", role: "note" }, `💡 ${hint}`) : null,
    entry.prefill ? element("p", { className: "field-hint prefill-note" }, prefillNote(entry.prefill, exercise)) : null,
    element("div", { className: "set-list" }, rows),
    element("div", { className: "button-row" }, [
      button("+ Add set", () => {
        const previous = entry.sets[entry.sets.length - 1];
        entry.sets.push(previous ? { ...previous } : blankSet());
        pendingFocus = `[data-entry-index="${entryIndex}"] .set-row:last-of-type input`;
        persist();
        redraw();
      }, { className: "button small" }),
      last ? button("Fill from last time", () => {
        entry.sets = last.sets.map(setToStrings);
        persist();
        redraw();
      }, { className: "button small" }) : null
    ])
  ]);
}

function prefillNote(prefill, exercise) {
  if (prefill.source === "e1rm") {
    return `Prefilled at 80% of your estimated 1RM (${formatMetric(prefill.e1rm, { unit: "weight" }, exercise)}). Change any number if it's different today.`;
  }
  return "Prefilled from your last session. Change any number if it's different today.";
}

function addExerciseCard(ctx, data, exercises, redraw) {
  const listId = "fitness-exercise-names";
  const nameInput = input("text", "", { maxlength: 60, placeholder: "Exercise name", autocomplete: "off", "aria-label": "Exercise name" });
  nameInput.setAttribute("list", listId); // `list` is a read-only DOM property, so set it as an attribute
  const kindSelect = element("select", { "aria-label": "Exercise type" }, KINDS.map((kind) => element("option", { value: kind.id }, `${kind.label} · ${kind.hint}`)));
  const datalist = element("datalist", { id: listId }, exercises.map((exercise) => element("option", { value: exercise.name })));
  nameInput.addEventListener("input", () => {
    const match = findExerciseByName(ctx.getData(), nameInput.value);
    kindSelect.disabled = Boolean(match);
    if (match) kindSelect.value = match.kind;
  });
  const add = () => {
    const name = nameInput.value.trim();
    if (!name) { ctx.notify("Enter an exercise name."); return; }
    const exerciseId = ensureExercise(ctx, name, kindSelect.value);
    if (draft.entries.some((entry) => entry.exerciseId === exerciseId)) { ctx.notify("That exercise is already in this workout."); return; }
    draft.entries.push(prefilledEntry(ctx.getData(), exerciseId, null));
    persist();
    pendingFocus = `[data-entry-index="${draft.entries.length - 1}"] .set-row input`;
    redraw();
  };
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); add(); }
  });
  return element("div", { className: "card add-exercise" }, [
    element("strong", {}, "Add an exercise"),
    element("div", { className: "add-exercise-row" }, [nameInput, kindSelect, button("Add", add, { className: "button primary" })]),
    datalist
  ]);
}

// Finds an exercise by name or creates it (and saves it) so it can be reused and tracked.
export function ensureExercise(ctx, name, kind) {
  const data = ctx.getData();
  const existing = findExerciseByName(data, name);
  if (existing) return existing.id;
  const now = timestamp();
  const exercise = {
    id: makeId(), name: name.trim(), kind, unit: defaultUnit(kind, ctx.system),
    archived: false, deleted: false, createdAt: now, updatedAt: now
  };
  ctx.onChange({ ...data, exercises: [...data.exercises, exercise] });
  return exercise.id;
}

// Prefilled numbers don't count as "work done": only a change from the starting values does.
function hasChanges() {
  return JSON.stringify(draft.entries) !== draft.pristine;
}

function cancelSession(ctx, redraw) {
  const leave = () => { discardSession(); redraw(); };
  if (draft.logId || !hasChanges()) { leave(); return; }
  ctx.confirmDialog("Discard this workout?", "The sets you entered have not been saved.", leave);
}

function parseSet(set) {
  const parsed = {};
  for (const key of FIELDS) {
    const value = Number(set[key]);
    if (set[key] !== "" && Number.isFinite(value) && value >= 0) parsed[key] = value;
  }
  return Object.values(parsed).some((value) => value > 0) ? parsed : null;
}

function saveSession(ctx) {
  const data = ctx.getData();
  const entries = draft.entries
    .map((entry) => ({ exerciseId: entry.exerciseId, sets: entry.sets.map(parseSet).filter(Boolean) }))
    .filter((entry) => entry.sets.length);
  if (!entries.length) {
    ctx.notify("Enter at least one set with a weight, reps, or time before saving.");
    return;
  }
  const now = timestamp();
  const existing = draft.logId ? data.workoutLogs.find((item) => item.id === draft.logId) : null;
  const log = {
    ...(existing || {}),
    id: existing?.id || makeId(), date: draft.date, workoutId: draft.workoutId, name: draft.name.trim() || "Workout",
    entries, deleted: false, createdAt: existing?.createdAt || now, updatedAt: now
  };
  if (draft.notes.trim()) log.notes = draft.notes.trim();
  else delete log.notes;
  const workoutLogs = existing ? data.workoutLogs.map((item) => item.id === existing.id ? log : item) : [...data.workoutLogs, log];
  const records = detectPRs({ ...data, workoutLogs }, log);
  discardSession();
  ctx.onChange({ ...data, workoutLogs });
  ctx.notify(records.length
    ? `🏆 New PR: ${records.slice(0, 2).map(({ exercise, metric, value }) => `${exercise.name} ${metric.label.toLowerCase()} ${formatMetric(value, metric, exercise)}`).join(" · ")}${records.length > 2 ? ` (+${records.length - 2} more)` : ""}`
    : "Workout saved.");
}

function deleteLog(ctx) {
  const id = draft.logId;
  ctx.confirmDialog("Delete this workout?", "It will be removed from your history and progress charts.", () => {
    const data = ctx.getData();
    discardSession();
    ctx.onChange({ ...data, workoutLogs: data.workoutLogs.map((item) => item.id === id ? { ...item, deleted: true, updatedAt: timestamp() } : item) });
  });
}
