import { activeCompletions, balance, dayPoints } from "./points.js";
import { addDays, formatDate, localDateString } from "./dates.js";
import { button, clear, element, emptyState, metric, pageHeading, sectionHeading } from "./ui.js";

export function renderToday(container, { data, date, configured, onDate, onToggle, onAdd, onEdit, onArchive, onDelete, onMove, onSettings }) {
  clear(container);
  container.append(pageHeading("today-heading", "Today", "Small steps add up."));
  if (!configured) {
    container.append(element("div", { className: "setup-banner" }, [
      element("strong", {}, "Set up sync to get started"),
      element("span", {}, "Add your private GitHub data repository and access token in Settings. Your data is also saved on this device."),
      element("div", { className: "button-row", style: { "margin-top": "10px" } }, button("Open Settings", onSettings, { className: "button primary" }))
    ]));
  }

  const currentDate = localDateString();
  const activeGoals = data.goals.filter((goal) => !goal.deleted && !goal.archived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt));
  const completions = activeCompletions(data, date);
  const completedIds = new Set(completions.map(({ goalId }) => goalId));
  const doneCount = activeGoals.filter(({ id }) => completedIds.has(id)).length;
  const summary = element("div", { className: "summary-strip" }, [
    element("div", { className: "summary-pill" }, [element("span", {}, "Points today"), element("strong", {}, `${dayPoints(data, date)} pts`)]),
    element("div", { className: "summary-pill" }, [element("span", {}, "Current balance"), element("strong", {}, `${balance(data)} pts`)])
  ]);
  const dateNav = element("div", { className: "date-switcher" }, [
    button("‹", () => onDate(addDays(date, -1)), { className: "icon-button date-arrow", ariaLabel: "Previous day" }),
    element("h2", {}, date === currentDate ? "Today" : formatDate(date, { weekday: "short", month: "long", day: "numeric", year: "numeric" })),
    button("›", () => onDate(addDays(date, 1)), { className: "icon-button date-arrow", ariaLabel: "Next day", disabled: date >= currentDate })
  ]);
  const goalHeading = sectionHeading("Your habits", button("+ Add habit", onAdd, { className: "button small primary" }));
  const goalList = element("div", { className: "goal-list" });

  if (activeGoals.length === 0) {
    goalList.append(emptyState("No active habits", "Add a habit to start building your routine.", button("Add a habit", onAdd, { className: "button primary" })));
  } else {
    activeGoals.forEach((goal, index) => {
      const completed = completedIds.has(goal.id);
      const toggle = button("", () => onToggle(goal, date), { className: "goal-toggle", ariaLabel: `${completed ? "Mark incomplete" : "Complete"} ${goal.name}` });
      toggle.append(
        element("span", { className: "goal-check", "aria-hidden": "true" }, completed ? "✓" : ""),
        element("span", { className: "goal-emoji", "aria-hidden": "true" }, goal.emoji || "•"),
        element("span", {}, [
          element("span", { className: "goal-name" }, goal.name),
          element("span", { className: "goal-meta" }, `${goal.points} points`)
        ])
      );
      const edit = button("✎", () => onEdit(goal), { className: "icon-button", ariaLabel: `Edit ${goal.name}` });
      const archive = button("↧", () => onArchive(goal), { className: "icon-button", ariaLabel: `Archive ${goal.name}`, title: "Archive" });
      const remove = button("×", () => onDelete(goal), { className: "icon-button", ariaLabel: `Delete ${goal.name}`, title: "Delete" });
      const moveUp = button("↑", () => onMove(goal, -1), { className: "icon-button", ariaLabel: `Move ${goal.name} up`, disabled: index === 0 });
      const moveDown = button("↓", () => onMove(goal, 1), { className: "icon-button", ariaLabel: `Move ${goal.name} down`, disabled: index === activeGoals.length - 1 });
      goalList.append(element("article", {
        className: `goal-row${completed ? " completed" : ""}`,
        style: { "--goal-color": goal.color || "#3E63DD" }
      }, [
        toggle,
        element("span", { className: "points-badge" }, `+${goal.points}`),
        element("div", { className: "row-actions" }, [moveUp, moveDown, edit, archive, remove])
      ]));
    });
  }
  container.append(summary, dateNav, goalHeading, goalList);
  if (activeGoals.length > 0 && doneCount === activeGoals.length) {
    container.append(element("div", { className: "perfect-banner", role: "status" }, "🎉 Perfect day! Every active habit is complete."));
  }
  container.append(element("p", { className: "field-hint", style: { "margin-top": "14px" } }, "Archived habits keep their history. Deleting a habit removes it from lists without erasing old entries."));
}
