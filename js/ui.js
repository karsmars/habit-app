export function element(tag, attributes = {}, children = []) {
  const result = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (name === "className") result.className = value;
    else if (name === "text") result.textContent = value;
    else if (name === "dataset") Object.assign(result.dataset, value);
    else if (name === "style" && typeof value === "object") {
      for (const [property, styleValue] of Object.entries(value)) result.style.setProperty(property, styleValue);
    } else if (name.startsWith("on") && typeof value === "function") result.addEventListener(name.slice(2).toLowerCase(), value);
    else if (name.startsWith("aria-")) result.setAttribute(name, String(value));
    else if (name in result && name !== "role") result[name] = value;
    else result.setAttribute(name, value === true ? "" : value);
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined || child === false) continue;
    result.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return result;
}

export function clear(container) {
  container.replaceChildren();
}

export function button(label, onClick, options = {}) {
  return element("button", {
    type: "button",
    className: options.className || "button",
    "aria-label": options.ariaLabel,
    title: options.title,
    disabled: options.disabled,
    onClick
  }, label);
}

export function pageHeading(id, title, subtitle) {
  return element("header", {}, [
    element("h1", { id, className: "page-heading" }, title),
    subtitle ? element("p", { className: "page-subtitle" }, subtitle) : null
  ]);
}

export function sectionHeading(title, action = null) {
  return element("div", { className: "section-heading" }, [
    element("h2", {}, title),
    action
  ]);
}

export function metric(label, value, primary = false) {
  return element("div", { className: `card metric-card${primary ? " primary" : ""}` }, [
    element("div", { className: "metric-label" }, label),
    element("div", { className: "metric-value" }, value)
  ]);
}

export function emptyState(title, message, action = null) {
  return element("div", { className: "empty-state" }, [
    element("strong", {}, title),
    element("span", {}, message),
    action ? element("div", { className: "button-row", style: { "justify-content": "center", "margin-top": "14px" } }, action) : null
  ]);
}

export function field(label, control, hint = "") {
  const id = control.id || `field-${Math.random().toString(36).slice(2)}`;
  control.id = id;
  return element("div", { className: "field" }, [
    element("label", { htmlFor: id }, label),
    control,
    hint ? element("span", { className: "field-hint" }, hint) : null
  ]);
}

export function input(type, value = "", attributes = {}) {
  return element("input", { type, value, ...attributes });
}

export function labeledIcon(emoji, label) {
  return element("span", { "aria-label": label, role: "img" }, emoji || "•");
}
