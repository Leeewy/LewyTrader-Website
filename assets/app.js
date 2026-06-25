(function () {
  "use strict";

  window.LewyTrader = window.LewyTrader || {};

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function currentTheme() {
    var theme = document.documentElement.getAttribute("data-theme");
    return theme === "dark" || theme === "light" ? theme : systemTheme();
  }

  function updateToggleButton() {
    var button = document.querySelector(".theme-toggle");
    if (!button) {
      return;
    }
    var theme = currentTheme();
    var nextTheme = theme === "dark" ? "light" : "dark";
    button.setAttribute("aria-label", "Switch to " + nextTheme + " theme");
    button.setAttribute("title", nextTheme === "dark" ? "Dark mode" : "Light mode");
  }

  window.LewyTrader.getTheme = currentTheme;
  window.LewyTrader.updateThemeToggle = updateToggleButton;

  function parseCalendarDate(isoDate) {
    var parts = isoDate.split("-");
    if (parts.length !== 3) {
      return null;
    }
    var year = Number(parts[0]);
    var month = Number(parts[1]) - 1;
    var day = Number(parts[2]);
    if (!year || month < 0 || !day) {
      return null;
    }
    return new Date(year, month, day);
  }

  function formatLocalDateTimes() {
    var formatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
    document.querySelectorAll("time.local-datetime[datetime]").forEach(function (node) {
      var iso = node.getAttribute("datetime");
      if (!iso) {
        return;
      }
      var date = new Date(iso);
      if (Number.isNaN(date.getTime())) {
        return;
      }
      node.textContent = formatter.format(date);
    });
  }

  function formatLocalDates() {
    var formatter = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
    });
    document.querySelectorAll("time.local-date[datetime]").forEach(function (node) {
      var iso = node.getAttribute("datetime");
      if (!iso) {
        return;
      }
      var date = parseCalendarDate(iso);
      if (!date || Number.isNaN(date.getTime())) {
        return;
      }
      node.textContent = formatter.format(date);
    });
  }

  function initPage() {
    updateToggleButton();
    formatLocalDateTimes();
    formatLocalDates();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage);
  } else {
    initPage();
  }
  document.addEventListener("lewytrader-theme-change", updateToggleButton);
})();
