import { addDays, addMonths, dayOfWeek, daysInMonth, formatDate, localDateString, monthStart, parseDate } from "./dates.js";
import { activeCompletions, dayPoints, pointsForGoal } from "./points.js";
import { button, clear, element, pageHeading, sectionHeading } from "./ui.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function renderCalendar(container, { data, month, filterId, onMonth, onFilter, onDay }) {
  clear(container);
  container.append(pageHeading("calendar-heading", "Calendar", "Your habits, one day at a time."));
  const firstDay = monthStart(month);
  const titleDate = parseDate(firstDay);
  const monthTitle = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(titleDate);
  const toolbar = element("div", { className: "calendar-toolbar" }, [
    button("‹", () => onMonth(addMonths(firstDay, -1)), { className: "icon-button", ariaLabel: "Previous month" }),
    element("h2", {}, monthTitle),
    button("Today", () => onMonth(monthStart(localDateString())), { className: "button small" }),
    button("›", () => onMonth(addMonths(firstDay, 1)), { className: "icon-button", ariaLabel: "Next month" })
  ]);
  container.append(element("div", { className: "card" }, [
    toolbar,
    element("div", { className: "filter-chips", role: "group", "aria-label": "Filter calendar by habit" }, [
      element("button", { type: "button", className: "filter-chip", "aria-pressed": !filterId, onClick: () => onFilter(null) }, "All"),
      ...data.goals.filter((goal) => !goal.deleted).map((goal) => element("button", {
        type: "button",
        className: "filter-chip",
        "aria-pressed": filterId === goal.id,
        style: { "--chip-color": goal.color || "#3E63DD", "--chip-text": goal.color === "#E5A100" ? "#2A1D00" : "#FFFFFF" },
        onClick: () => onFilter(filterId === goal.id ? null : goal.id)
      }, `${goal.emoji || "•"} ${goal.name}`))
    ]),
    element("div", { className: "weekday-grid", "aria-hidden": "true" }, WEEKDAYS.map((day) => element("span", {}, day))),
    makeGrid(firstDay, month, data, filterId, onDay),
    legend()
  ]));
  container.append(sectionHeading("How it works"), element("p", { className: "muted" }, "Cell shades represent points earned. Select a habit to highlight only its completion days."));
}

function makeGrid(firstDay, month, data, filterId, onDay) {
  const grid = element("div", { className: "calendar-grid", role: "grid", "aria-label": "Calendar month" });
  const offset = dayOfWeek(firstDay);
  const count = daysInMonth(firstDay);
  const today = localDateString();
  const selectedGoal = data.goals.find(({ id }) => id === filterId);
  for (let cell = 0; cell < 42; cell += 1) {
    const dayNumber = cell - offset + 1;
    if (dayNumber < 1 || dayNumber > count) {
      grid.append(element("div", { className: "calendar-day other-month", "aria-hidden": "true" }, " "));
      continue;
    }
    const date = addDays(firstDay, dayNumber - 1);
    const total = dayPoints(data, date);
    const filteredPoints = filterId ? pointsForGoal(data, filterId, date) : total;
    const isFilteredDay = !filterId || filteredPoints > 0;
    const level = heatLevel(filterId ? filteredPoints : total);
    const completions = activeCompletions(data, date);
    const dayButton = element("button", {
      type: "button",
      className: `calendar-day${total ? " has-points" : ""}${date === today ? " today" : ""}${filterId && isFilteredDay ? " selected-filter" : ""}${filterId && !isFilteredDay ? " dimmed" : ""}`,
      role: "gridcell",
      "aria-label": `${formatDate(date, { month: "long", day: "numeric", year: "numeric" })}, ${filterId ? filteredPoints : total} points${selectedGoal ? ` for ${selectedGoal.name}` : ""}`,
      style: {
        "background-color": filterId && filteredPoints ? (selectedGoal?.color || "#3E63DD") : total && isFilteredDay ? `var(--scale-${level})` : "transparent",
        color: filterId && filteredPoints ? ((selectedGoal?.color || "#3E63DD") === "#E5A100" ? "#2A1D00" : "#FFFFFF") : total && isFilteredDay ? `var(--scale-text-${level})` : "var(--text)",
        "--filter-color": selectedGoal?.color || "var(--primary)"
      },
      onClick: () => onDay(date, completions)
    }, [
      element("span", {}, dayNumber),
      total ? element("span", { className: "calendar-points" }, filterId ? filteredPoints || "" : total) : null
    ]);
    grid.append(dayButton);
  }
  return grid;
}

function heatLevel(points) {
  if (points <= 0) return 0;
  if (points <= 5) return 1;
  if (points <= 15) return 2;
  if (points <= 30) return 3;
  return 4;
}

function legend() {
  return element("div", { className: "calendar-legend", "aria-label": "Points scale" }, [
    element("span", {}, "Less"),
    ...[0, 1, 2, 3, 4].map((level) => element("span", {
      className: "legend-swatch",
      style: { "background-color": `var(--scale-${level})` },
      "aria-label": `Level ${level}`
    })),
    element("span", {}, "More"),
    element("span", { className: "muted" }, " · Zero points outlined")
  ]);
}
