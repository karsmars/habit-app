import { balance } from "./points.js";
import { button, clear, element, emptyState, pageHeading, sectionHeading } from "./ui.js";

export function renderShop(container, { data, onAdd, onEdit, onArchive, onDelete, onBuy, onRefund }) {
  clear(container);
  container.append(pageHeading("shop-heading", "Shop", "Spend your points on rewards you care about."));
  const currentBalance = balance(data);
  container.append(element("div", { className: "card metric-card primary" }, [
    element("div", { className: "metric-label" }, "Available balance"),
    element("div", { className: "metric-value" }, `${currentBalance} pts`)
  ]));
  const rewards = data.rewards.filter((reward) => !reward.deleted && !reward.archived);
  const owned = new Set(data.purchases.filter((purchase) => !purchase.refunded)
    .filter((purchase) => data.rewards.some((reward) => reward.id === purchase.rewardId && !reward.repeatable))
    .map((purchase) => purchase.rewardId));
  const rewardList = element("div", { className: "reward-list" });
  if (rewards.length === 0) {
    rewardList.append(emptyState("No rewards yet", "Add a reward to give your points a purpose.", button("+ Add reward", onAdd, { className: "button primary" })));
  } else {
    for (const reward of rewards) {
      const isOwned = owned.has(reward.id);
      const affordable = currentBalance >= reward.cost;
      const progress = reward.cost > 0 ? Math.min(100, Math.max(0, currentBalance / reward.cost * 100)) : 100;
      const details = element("div", { className: "reward-details" }, [
        element("h3", { className: "reward-title" }, `${reward.emoji || "🎁"} ${reward.name}`),
        element("div", { className: "reward-cost" }, `${reward.cost} pts · ${reward.repeatable ? "Repeatable" : "One time"}`),
        !affordable && !isOwned ? element("div", { className: "reward-progress", role: "progressbar", "aria-label": `Progress toward ${reward.name}`, "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": Math.round(progress) }, element("span", { style: { width: `${progress}%` } })) : null
      ]);
      rewardList.append(element("article", { className: "reward-card" }, [
        details,
        isOwned ? element("span", { className: "owned-label" }, "Owned") : button("Buy", () => onBuy(reward), { className: affordable ? "button primary" : "button", disabled: !affordable }),
        element("div", { className: "row-actions" }, [
          button("✎", () => onEdit(reward), { className: "icon-button", ariaLabel: `Edit ${reward.name}` }),
          button("↧", () => onArchive(reward), { className: "icon-button", ariaLabel: `Archive ${reward.name}` }),
          button("×", () => onDelete(reward), { className: "icon-button", ariaLabel: `Delete ${reward.name}` })
        ])
      ]));
    }
  }
  container.append(sectionHeading("Available rewards", button("+ Add reward", onAdd, { className: "button small primary" })), rewardList);

  const history = data.purchases.slice().filter((purchase) => !purchase.refunded)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt));
  const historyList = element("div", { className: "history-list" });
  if (history.length === 0) {
    historyList.append(emptyState("Nothing spent yet", "Your reward purchases will appear here."));
  } else {
    history.forEach((purchase) => historyList.append(element("article", { className: "history-row" }, [
      element("div", {}, [
        element("strong", {}, `${purchase.rewardName} · ${purchase.cost} pts`),
        element("div", { className: "field-hint" }, purchase.date)
      ]),
      button("Undo / Refund", () => onRefund(purchase), { className: "button small" })
    ])));
  }
  container.append(sectionHeading("Purchase history"), historyList);
}
