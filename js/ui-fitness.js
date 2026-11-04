// The optional Fitness tab: one tab with two sections, "Workouts" (programs, logging, history) and "Progress".
import {
  activeExercises, activeLogs, activeWorkouts, defaultUnit, findExercise, findExerciseByName, formatSets, formatTarget, KINDS
} from "./fitness.js";
import { formatDate } from "./dates.js";
import { makeId, timestamp } from "./state.js";
import { button, clear, element, emptyState, field, input, pageHeading, sectionHeading } from "./ui.js";
import { renderSession, sessionActive, startSession } from "./ui-fitness-session.js";
import { renderFitnessProgress } from "./ui-fitness-progress.js";

const HISTORY_LIMIT = 8;
let section = "workouts";
let showAllHistory = false;
let host = null;
let context = null;

// `ctx`: { getData, system, onChange(nextData), showDialog, closeDialog, confirmDialog, notify }
export function renderFitness(container, ctx) {
  host = container;
  context = ctx;
  // A background sync re-render must not steal focus from a set being typed. User actions redraw directly.
  const focused = document.activeElement;
  if (sessionActive() && container.contains(focused) && ["INPUT", "TEXTAREA", "SELECT"].includes(focused.tagName)) return;
  draw();
}

function draw() {
  const ctx = context;
  const container = host;
  clear(container);
  container.append(pageHeading("fitness-heading", "Fitness", "Log your lifts and watch your numbers climb."));
  const ctxWithOpen = { ...ctx, onOpenLog: (log) => { if (log) { startSession(ctx.getData(), { log }); section = "workouts"; draw(); } } };
  if (sessionActive()) {
    renderSession(container, ctxWithOpen, draw);
    return;
  }
  container.append(element("div", { className: "segmented", role: "group", "aria-label": "Fitness sections" }, [
    ["workouts", "Workouts"], ["progress", "Progress"]
  ].map(([id, label]) => button(label, () => { section = id; draw(); }, { className: `segment${section === id ? " active" : ""}`, pressed: section === id }))));
  if (section === "progress") renderFitnessProgress(container, ctxWithOpen, draw);
  else renderWorkouts(container, ctxWithOpen);
}

function renderWorkouts(container, ctx) {
  const data = ctx.getData();
  const workouts = activeWorkouts(data);
  container.append(sectionHeading("Your workouts", button("+ New workout", () => editWorkout(ctx), { className: "button small primary" })));
  const list = element("div", { className: "goal-list" });
  if (!workouts.length) {
    list.append(emptyState("No workouts yet", "Tap + New workout to build a program (like Workout 1 and Workout 2) with target sets and reps, or just log a one-off session below."));
  }
  workouts.forEach((workout) => {
    const lines = workout.items.map((item) => {
      const exercise = findExercise(data, item.exerciseId);
      if (!exercise) return null;
      const target = formatTarget(item, exercise.kind);
      return element("li", {}, [exercise.name, target ? element("span", { className: "muted" }, ` · ${target}`) : null]);
    });
    list.append(element("article", { className: "card workout-card" }, [
      element("div", { className: "entry-head" }, [
        element("strong", {}, workout.name),
        element("div", { className: "row-actions" }, [
          button("✎", () => editWorkout(ctx, workout), { className: "icon-button", ariaLabel: `Edit ${workout.name}`, title: "Edit" })
        ])
      ]),
      element("ul", { className: "workout-items" }, lines),
      element("div", { className: "button-row" }, button("Start workout", () => { startSession(data, { workout }); draw(); }, { className: "button primary" }))
    ]));
  });
  container.append(list, element("div", { className: "button-row", style: { "margin-top": "12px" } },
    button("Log a one-off workout", () => { startSession(data, {}); draw(); }, { className: "button" })));

  container.append(sectionHeading("History"));
  const logs = activeLogs(data).sort((a, b) => b.date.localeCompare(a.date) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  if (!logs.length) {
    container.append(emptyState("No workouts logged", "Start a workout above and it will appear here."));
    return;
  }
  const shown = showAllHistory ? logs : logs.slice(0, HISTORY_LIMIT);
  container.append(element("div", { className: "history-list" }, shown.map((log) => {
    const summary = log.entries.map((entry) => {
      const exercise = findExercise(data, entry.exerciseId);
      return exercise ? `${exercise.name} ${formatSets(entry.sets, exercise.kind, exercise.unit)}` : null;
    }).filter(Boolean).join(" · ");
    return element("button", { type: "button", className: "history-row history-button", onClick: () => { startSession(data, { log }); draw(); }, "aria-label": `Edit ${log.name || "workout"} from ${log.date}` }, [
      element("div", {}, [
        element("strong", {}, log.name || "Workout"),
        element("span", { className: "goal-meta" }, formatDate(log.date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })),
        element("span", { className: "goal-meta history-summary" }, summary)
      ]),
      element("span", { "aria-hidden": "true" }, "›")
    ]);
  })));
  if (logs.length > HISTORY_LIMIT) {
    container.append(element("div", { className: "button-row", style: { "margin-top": "10px" } },
      button(showAllHistory ? "Show fewer" : `Show all ${logs.length}`, () => { showAllHistory = !showAllHistory; draw(); }, { className: "button small" })));
  }
}

// Workout (program) editor: a name plus rows of exercise + target sets and reps. Exercises are matched by
// name, so typing a new name creates it (with the chosen type) and an existing name reuses its history.
function editWorkout(ctx, workout = null) {
  const data = ctx.getData();
  const rows = (workout?.items || []).map((item) => {
    const exercise = findExercise(data, item.exerciseId);
    return exercise ? { name: exercise.name, kind: exercise.kind, setsMin: item.setsMin, setsMax: item.setsMax, targetMin: item.targetMin, targetMax: item.targetMax } : null;
  }).filter(Boolean);
  if (!rows.length) rows.push(blankRow());
  const nameInput = input("text", workout?.name || "", { maxlength: 60, required: true, autocomplete: "off", placeholder: "e.g. Workout 1" });
  const rowList = element("div", { className: "workout-editor-rows" });
  const listId = "workout-exercise-names";
  const datalist = element("datalist", { id: listId }, activeExercises(data).map((exercise) => element("option", { value: exercise.name })));

  const drawRows = (focusIndex = null) => {
    rowList.replaceChildren(...rows.map((row, index) => editorRow(row, index, rows.length, listId, ctx, drawRows, rows)));
    const control = focusIndex === null ? null : rowList.querySelectorAll(".editor-row-top input")[focusIndex];
    control?.focus();
    control?.setSelectionRange(control.value.length, control.value.length);
  };
  drawRows();
  const body = element("div", {}, [
    field("Workout name", nameInput),
    element("div", { className: "field-hint", style: { margin: "10px 0 6px" } }, "Add each exercise with its target sets and reps (leave blank for none). Ranges like 2–3 sets or 6–10 reps are fine. Pick Timed for things like plank."),
    rowList,
    element("div", { className: "button-row" }, button("+ Add exercise", () => { rows.push(blankRow()); drawRows(); rowList.querySelector(".editor-row:last-child input")?.focus(); }, { className: "button small" })),
    datalist
  ]);
  const actions = [
    button("Cancel", () => ctx.closeDialog(), { className: "button" }),
    workout ? button("Delete", () => {
      ctx.confirmDialog("Delete workout?", `${workout.name} will be removed. Logged sessions and progress are kept.`, () => {
        const latest = ctx.getData();
        ctx.onChange({ ...latest, workouts: latest.workouts.map((item) => item.id === workout.id ? { ...item, deleted: true, updatedAt: timestamp() } : item) });
      });
    }, { className: "button danger" }) : null,
    button("Save workout", () => {
      const name = nameInput.value.trim();
      const filled = rows.filter((row) => row.name.trim());
      if (!name || !filled.length) { ctx.notify("Give the workout a name and at least one exercise."); return; }
      const now = timestamp();
      let latest = ctx.getData();
      const created = [];
      const items = filled.map((row) => {
        let exercise = findExerciseByName({ ...latest, exercises: [...latest.exercises, ...created] }, row.name);
        if (!exercise) {
          exercise = { id: makeId(), name: row.name.trim(), kind: row.kind, unit: defaultUnit(row.kind, ctx.system), archived: false, deleted: false, createdAt: now, updatedAt: now };
          created.push(exercise);
        }
        return cleanItem({ exerciseId: exercise.id, setsMin: row.setsMin, setsMax: row.setsMax, targetMin: row.targetMin, targetMax: row.targetMax });
      });
      latest = { ...latest, exercises: [...latest.exercises, ...created] };
      const updated = {
        ...(workout || {}), id: workout?.id || makeId(), name, items, archived: workout?.archived || false, deleted: false,
        createdAt: workout?.createdAt || now, updatedAt: now,
        order: workout?.order ?? Math.max(-1, ...activeWorkouts(latest).map((item) => item.order ?? 0)) + 1
      };
      const workouts = workout ? latest.workouts.map((item) => item.id === workout.id ? updated : item) : [...latest.workouts, updated];
      ctx.closeDialog();
      ctx.onChange({ ...latest, workouts });
    }, { className: "button primary" })
  ].filter(Boolean);
  ctx.showDialog(workout ? "Edit workout" : "New workout", body, actions);
}

function blankRow() {
  return { name: "", kind: "weight", setsMin: undefined, setsMax: undefined, targetMin: undefined, targetMax: undefined };
}

function cleanItem(item) {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined));
}

function numberOrUndefined(text) {
  const value = Number(text);
  return text !== "" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function editorRow(row, index, total, listId, ctx, redraw, rows) {
  const nameInput = input("text", row.name, { maxlength: 60, placeholder: "Exercise, e.g. Squat", autocomplete: "off", "aria-label": `Exercise ${index + 1} name` });
  nameInput.setAttribute("list", listId); // `list` is a read-only DOM property, so set it as an attribute
  const kindSelect = element("select", { "aria-label": `Exercise ${index + 1} type` }, KINDS.map((kind) => element("option", { value: kind.id, selected: kind.id === row.kind }, kind.label)));
  const targetLabel = row.kind === "time" ? "Seconds" : "Reps";
  const numberInput = (key, label, placeholder) => {
    const control = input("number", row[key] ?? "", { min: "0", step: "1", inputmode: "numeric", placeholder, "aria-label": `Exercise ${index + 1} ${label}` });
    control.addEventListener("input", () => { row[key] = numberOrUndefined(control.value); });
    return control;
  };
  nameInput.addEventListener("input", () => {
    row.name = nameInput.value;
    const match = findExerciseByName(ctx.getData(), nameInput.value);
    kindSelect.disabled = Boolean(match);
    if (match && match.kind !== row.kind) { row.kind = match.kind; redraw(index); }
  });
  kindSelect.addEventListener("change", () => { row.kind = kindSelect.value; redraw(); });
  const matched = findExerciseByName(ctx.getData(), row.name);
  kindSelect.disabled = Boolean(matched);
  if (matched) kindSelect.title = "This exercise already exists, so its type is fixed.";

  const move = (direction) => { const target = index + direction; [rows[index], rows[target]] = [rows[target], rows[index]]; redraw(); };
  return element("div", { className: "editor-row" }, [
    element("div", { className: "editor-row-top" }, [nameInput, kindSelect]),
    element("div", { className: "editor-row-targets" }, [
      row.kind === "cardio" ? null : element("span", { className: "target-group" }, [element("span", {}, "Sets"), numberInput("setsMin", "sets minimum", "3"), element("span", { "aria-hidden": "true" }, "–"), numberInput("setsMax", "sets maximum", "")]),
      row.kind === "cardio" ? null : element("span", { className: "target-group" }, [element("span", {}, targetLabel), numberInput("targetMin", `${targetLabel.toLowerCase()} minimum`, row.kind === "time" ? "30" : "6"), element("span", { "aria-hidden": "true" }, "–"), numberInput("targetMax", `${targetLabel.toLowerCase()} maximum`, row.kind === "time" ? "60" : "10")]),
      element("span", { className: "row-actions" }, [
        button("↑", () => move(-1), { className: "icon-button", ariaLabel: `Move exercise ${index + 1} up`, disabled: index === 0 }),
        button("↓", () => move(1), { className: "icon-button", ariaLabel: `Move exercise ${index + 1} down`, disabled: index === total - 1 }),
        button("×", () => { rows.splice(index, 1); if (!rows.length) rows.push(blankRow()); redraw(); }, { className: "icon-button", ariaLabel: `Remove exercise ${index + 1}`, title: "Remove" })
      ])
    ])
  ]);
}
