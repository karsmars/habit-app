// Fitness progress: personal records, a trend chart, and a session table for one exercise at a time.
import { addDays, formatDate, localDateString } from "./dates.js";
import {
  activeExercises, findExerciseByName, formatMetric, formatNumber, formatPace, formatSets, metricsFor, niceScale, personalRecords,
  recordSessionIds, sessionsFor, unitOptions
} from "./fitness.js";
import { timestamp } from "./state.js";
import { button, element, emptyState, field, input, sectionHeading } from "./ui.js";

const RANGES = [
  { id: "90", label: "3 months", days: 90 },
  { id: "365", label: "1 year", days: 365 },
  { id: "all", label: "All", days: null }
];
const TABLE_LIMIT = 10;
const SVG = "http://www.w3.org/2000/svg";

const view = { exerciseId: null, metricId: null, range: "all", showAll: false };

export function renderFitnessProgress(container, ctx, redraw) {
  const data = ctx.getData();
  const logged = activeExercises(data)
    .map((exercise) => ({ exercise, sessions: sessionsFor(data, exercise.id) }))
    .filter(({ sessions }) => sessions.length)
    .sort((a, b) => b.sessions[b.sessions.length - 1].date.localeCompare(a.sessions[a.sessions.length - 1].date));
  if (!logged.length) {
    container.append(emptyState("No progress yet", "Finish a workout and your records, charts and history will show up here."));
    return;
  }
  const current = logged.find(({ exercise }) => exercise.id === view.exerciseId) || logged[0];
  view.exerciseId = current.exercise.id;
  const { exercise, sessions } = current;
  const allMetrics = metricsFor(exercise.kind);
  const metrics = allMetrics.filter((item) => item.chart !== false); // Est. 1RM is shown as a record, not charted
  const metric = metrics.find((item) => item.id === view.metricId) || metrics[0];
  view.metricId = metric.id;

  const select = element("select", { id: "fitness-exercise-select" }, logged.map((item) => element("option", { value: item.exercise.id, selected: item.exercise.id === exercise.id }, item.exercise.name)));
  select.addEventListener("change", () => {
    view.exerciseId = select.value;
    view.metricId = null;
    view.showAll = false;
    redraw();
  });
  container.append(element("div", { className: "exercise-picker" }, [
    element("label", { htmlFor: "fitness-exercise-select" }, "Exercise"),
    select,
    button("Edit", () => editExercise(ctx, exercise, redraw), { className: "button small", ariaLabel: `Edit ${exercise.name}` })
  ]));

  const records = personalRecords(data, exercise).filter(({ metric: item, value }) => item.pr && value !== null);
  container.append(sectionHeading("Personal records"));
  if (records.some(({ metric: item }) => item.id === "oneRepMax")) {
    container.append(element("p", { className: "field-hint one-rep-note" },
      "Est. 1RM is a guess at the most you could lift for one rep, worked out from your best set: weight × (1 + reps ÷ 30). It's most reliable for sets of about 10 reps or fewer."));
  }
  container.append(element("div", { className: "card-grid" }, records.map(({ metric: item, value, date }) =>
    element("div", { className: "card metric-card" }, [
      element("div", { className: "metric-label" }, `🏆 ${item.label}`),
      element("div", { className: "metric-value" }, formatMetric(value, item, exercise)),
      element("div", { className: "field-hint" }, formatDate(date, { month: "short", day: "numeric", year: "numeric" }))
    ]))));

  const metricButtons = metrics.length > 1 ? element("div", { className: "button-row", role: "group", "aria-label": "Chart metric" }, metrics.map((item) =>
    button(item.label, () => { view.metricId = item.id; redraw(); }, { className: `button small${item.id === metric.id ? " primary" : ""}`, pressed: item.id === metric.id }))) : null;
  const rangeButtons = element("div", { className: "button-row", role: "group", "aria-label": "Chart range" }, RANGES.map((item) =>
    button(item.label, () => { view.range = item.id; redraw(); }, { className: `button small${item.id === view.range ? " primary" : ""}`, pressed: item.id === view.range })));
  container.append(sectionHeading("Trend", rangeButtons));
  if (metricButtons) container.append(element("div", { style: { "margin-bottom": "12px" } }, metricButtons));

  const range = RANGES.find((item) => item.id === view.range) || RANGES[2];
  const start = range.days ? addDays(localDateString(), -range.days) : "";
  const points = sessions.filter((session) => session.date >= start)
    .map((session) => ({ session, value: metric.value(session.sets) })).filter((point) => point.value !== null);
  const recordIds = recordSessionIds(sessions, metric);
  container.append(element("div", { className: "card chart-card fitness-chart" }, points.length
    ? lineChart(points, metric, exercise, recordIds)
    : element("p", { className: "muted" }, "No sessions in this range.")));
  if (points.length === 1) container.append(element("p", { className: "field-hint" }, "Log another session to see a trend line."));

  container.append(sectionHeading("History"));
  const rows = [...sessions].reverse();
  const shown = view.showAll ? rows : rows.slice(0, TABLE_LIMIT);
  const body = element("tbody", {}, shown.map((session) => {
    const value = metric.value(session.sets);
    const log = ctx.getData().workoutLogs.find((item) => item.id === session.logId);
    return element("tr", {}, [
      element("td", {}, button(formatDate(session.date, { month: "short", day: "numeric", year: "numeric" }), () => ctx.onOpenLog(log), { className: "link-button", ariaLabel: `Edit workout from ${session.date}` })),
      element("td", {}, formatSets(session.sets, exercise.kind, exercise.unit)),
      element("td", { className: "num" }, `${recordIds.has(session.logId) ? "🏆 " : ""}${formatMetric(value, metric, exercise)}`)
    ]);
  }));
  container.append(element("div", { className: "card table-card" }, element("table", { className: "history-table" }, [
    element("caption", { className: "sr-only" }, `${exercise.name} sessions`),
    element("thead", {}, element("tr", {}, [element("th", { scope: "col" }, "Date"), element("th", { scope: "col" }, "Sets"), element("th", { scope: "col", className: "num" }, metric.label)])),
    body
  ])));
  if (rows.length > TABLE_LIMIT) {
    container.append(element("div", { className: "button-row", style: { "margin-top": "10px" } },
      button(view.showAll ? "Show fewer" : `Show all ${rows.length}`, () => { view.showAll = !view.showAll; redraw(); }, { className: "button small" })));
  }
}

function svgNode(tag, attributes = {}, text = "") {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  if (text) node.textContent = text;
  return node;
}

function lineChart(points, metric, exercise, recordIds) {
  const width = 560;
  const height = 250;
  const left = 46;
  const right = 540;
  const top = 14;
  const bottom = 200;
  const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": `${exercise.name} ${metric.label.toLowerCase()} over time, ${points.length} sessions` });
  const values = points.map((point) => point.value);
  const { lo: yMin, hi: yMax, ticks } = niceScale(Math.min(...values), Math.max(...values));
  const x = (index) => left + (points.length === 1 ? (right - left) / 2 : ((right - left) * index) / (points.length - 1));
  const y = (value) => bottom - ((value - yMin) / (yMax - yMin)) * (bottom - top);

  ticks.forEach((value, index) => {
    svg.append(
      svgNode("line", { x1: left, x2: right, y1: y(value), y2: y(value), stroke: "var(--border)", "stroke-dasharray": index ? "3 4" : "0" }),
      svgNode("text", { x: left - 8, y: y(value) + 5, "text-anchor": "end" }, metric.unit === "pace" ? formatPace(value) : formatNumber(value))
    );
  });
  if (points.length > 1) {
    svg.append(svgNode("polyline", { points: points.map((point, index) => `${x(index)},${y(point.value)}`).join(" "), fill: "none", stroke: "var(--primary)", "stroke-width": 2.5, "stroke-linejoin": "round" }));
  }
  const spansYears = points[0].session.date.slice(0, 4) !== points[points.length - 1].session.date.slice(0, 4);
  const labelEvery = Math.max(1, Math.ceil(points.length / 4));
  points.forEach((point, index) => {
    const isRecord = recordIds.has(point.session.logId);
    const dot = svgNode("circle", { cx: x(index), cy: y(point.value), r: isRecord ? 7 : 5, class: isRecord ? "chart-dot record" : "chart-dot" });
    dot.append(svgNode("title", {}, `${formatDate(point.session.date, { month: "short", day: "numeric", year: "numeric" })}: ${formatMetric(point.value, metric, exercise)}${isRecord ? " (record)" : ""}`));
    svg.append(dot);
    const lastLabel = index === points.length - 1;
    const crowded = !lastLabel && points.length - 1 - index < labelEvery / 2 + 1 && points.length > 2;
    if ((index % labelEvery === 0 && !crowded) || lastLabel) {
      svg.append(svgNode("text", { x: Math.min(Math.max(x(index), left + 14), right - 14), y: 226, "text-anchor": "middle" },
        formatDate(point.session.date, spansYears ? { month: "numeric", day: "numeric", year: "2-digit" } : { month: "numeric", day: "numeric" })));
    }
  });
  return svg;
}

function editExercise(ctx, exercise, redraw) {
  const nameInput = input("text", exercise.name, { maxlength: 60, required: true, autocomplete: "off" });
  const units = unitOptions(exercise.kind);
  const unitSelect = units.length ? element("select", {}, units.map((unit) => element("option", { value: unit, selected: unit === exercise.unit }, unit))) : null;
  ctx.showDialog("Edit exercise", element("div", { className: "form-grid" }, [
    field("Name", nameInput),
    unitSelect ? field("Unit", unitSelect, "Changing the unit does not convert past entries.") : null
  ]), [
    button("Cancel", () => ctx.closeDialog(), { className: "button" }),
    button("Save", () => {
      const name = nameInput.value.trim();
      const clash = findExerciseByName(ctx.getData(), name);
      if (!name || (clash && clash.id !== exercise.id)) { ctx.notify("Enter a name that is not used by another exercise."); return; }
      const data = ctx.getData();
      ctx.closeDialog();
      ctx.onChange({ ...data, exercises: data.exercises.map((item) => item.id === exercise.id ? { ...item, name, unit: unitSelect ? unitSelect.value : item.unit, updatedAt: timestamp() } : item) });
      redraw();
    }, { className: "button primary" })
  ]);
}
