import { addDays, formatDate, localDateString } from "./dates.js";
import { completionRate, earnedPoints, goalStreak, pointsByDate, spentPoints, streaks } from "./points.js";
import { button, clear, element, emptyState, metric, pageHeading, sectionHeading } from "./ui.js";

export function renderProgress(container, { data, range, onRange }) {
  clear(container);
  container.append(pageHeading("progress-heading", "Progress", "A look at the effort you're putting in."));
  const { current, best } = streaks(data);
  container.append(element("div", { className: "card-grid" }, [
    metric("Current balance", `${earnedPoints(data) - spentPoints(data)} pts`, true),
    metric("Lifetime earned", `${earnedPoints(data)} pts`),
    metric("Lifetime spent", `${spentPoints(data)} pts`)
  ]));
  container.append(element("div", { className: "card-grid", style: { "margin-top": "12px" } }, [
    metric("Current streak", `${current} ${current === 1 ? "day" : "days"}`),
    metric("Best streak", `${best} ${best === 1 ? "day" : "days"}`)
  ]));

  const chartRange = range === 7 ? 7 : 30;
  const today = localDateString();
  const chartData = pointsByDate(data, Array.from({ length: chartRange }, (_, index) => addDays(today, index - chartRange + 1)));
  const chart = buildChart(chartData, chartRange);
  const toggle = element("div", { className: "button-row" }, [
    button("7 days", () => onRange(7), { className: `button small${chartRange === 7 ? " primary" : ""}`, "aria-pressed": chartRange === 7 }),
    button("30 days", () => onRange(30), { className: `button small${chartRange === 30 ? " primary" : ""}`, "aria-pressed": chartRange === 30 })
  ]);
  container.append(sectionHeading("Points per day", toggle), element("div", { className: "card chart-card" }, chart));

  const goals = data.goals.filter((goal) => !goal.deleted);
  container.append(sectionHeading("Habit consistency"));
  if (!goals.length) {
    container.append(emptyState("No habits yet", "Add habits from the Today tab to start tracking consistency."));
    return;
  }
  const list = element("div", { className: "goal-list" });
  goals.forEach((goal) => {
    const rate = completionRate(data, goal.id);
    list.append(element("article", { className: "card" }, [
      element("div", { style: { display: "flex", "justify-content": "space-between", gap: "10px" } }, [
        element("strong", {}, `${goal.emoji || "•"} ${goal.name}`),
        element("span", { className: "muted" }, `${goalStreak(data, goal.id)}-day streak`)
      ]),
      element("div", { className: "field-hint", style: { "margin-top": "5px" } }, `${rate}% completed in the last 30 days`),
      element("div", { className: "reward-progress", role: "progressbar", "aria-label": `${goal.name} completion rate`, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": rate }, element("span", { style: { width: `${rate}%` } }))
    ]));
  });
  container.append(list);
}

function buildChart(values, range) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 760 235");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Points earned per day over the last ${range} days`);
  const max = Math.max(1, ...values.map(({ points }) => points));
  const left = 32;
  const right = 744;
  const top = 16;
  const bottom = 190;
  const slot = (right - left) / values.length;
  const visibleLabelEvery = range === 7 ? 1 : 5;
  values.forEach(({ date, points }, index) => {
    const width = Math.max(3, slot * (range === 7 ? .54 : .65));
    const height = points === 0 ? 2 : Math.max(3, (points / max) * (bottom - top));
    const rect = document.createElementNS(namespace, "rect");
    rect.setAttribute("x", String(left + index * slot + (slot - width) / 2));
    rect.setAttribute("y", String(bottom - height));
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("rx", "4");
    rect.setAttribute("class", "chart-bar");
    rect.setAttribute("aria-label", `${formatDate(date, { month: "short", day: "numeric" })}: ${points} points`);
    svg.append(rect);
    if (index % visibleLabelEvery === 0 || index === values.length - 1) {
      const label = document.createElementNS(namespace, "text");
      label.setAttribute("x", String(left + index * slot + slot / 2));
      label.setAttribute("y", "216");
      label.setAttribute("text-anchor", "middle");
      label.textContent = formatDate(date, { month: "numeric", day: "numeric" });
      svg.append(label);
    }
  });
  const baseline = document.createElementNS(namespace, "line");
  baseline.setAttribute("x1", String(left));
  baseline.setAttribute("x2", String(right));
  baseline.setAttribute("y1", String(bottom + 1));
  baseline.setAttribute("y2", String(bottom + 1));
  baseline.setAttribute("stroke", "var(--border)");
  svg.append(baseline);
  return svg;
}
