(function () {
  try {
    const saved = localStorage.getItem("habit-theme");
    const themes = ["sage", "ocean", "sunset", "midnight"];
    document.documentElement.dataset.theme = themes.includes(saved) ? saved : "sage";
  } catch {
    document.documentElement.dataset.theme = "sage";
  }
}());
