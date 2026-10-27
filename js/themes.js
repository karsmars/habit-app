export const THEMES = [
  { id: "sage", name: "Sage and cream", style: "Light, calm, earthy", main: "#3F7D5C", accent: "#E9A23B", background: "#F6F3EC", scale: ["#E3EFE7", "#B7D8C4", "#7DB894", "#3F7D5C", "#24533B"] },
  { id: "ocean", name: "Ocean indigo", style: "Light, clean, focused", main: "#3B5BDB", accent: "#FFC53D", background: "#F3F6FB", scale: ["#E4EAFB", "#B9C8F5", "#869EEA", "#3B5BDB", "#26398F"] },
  { id: "sunset", name: "Sunset coral", style: "Light, warm, energetic", main: "#E8590C", accent: "#7048E8", background: "#FFF6F1", scale: ["#FDE6D8", "#FAC3A5", "#F4915F", "#E8590C", "#A33C06"] },
  { id: "midnight", name: "Midnight dark", style: "Dark, cozy", main: "#8B7CF6", accent: "#FFC857", background: "#14161C", scale: ["#2B2850", "#443C8F", "#6A5ED0", "#8B7CF6", "#C3BBFF"] }
];

export const GOAL_COLORS = ["#E5484D", "#F76B15", "#E5A100", "#30A46C", "#12A594", "#3E63DD", "#8E4EC6", "#D6409F"];
export const DEFAULT_THEME = "sage";

export function setTheme(themeId) {
  const theme = THEMES.some(({ id }) => id === themeId) ? themeId : DEFAULT_THEME;
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("habit-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEMES.find(({ id }) => id === theme).background;
  return theme;
}

export function currentTheme() {
  return document.documentElement.dataset.theme || DEFAULT_THEME;
}
