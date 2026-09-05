(function () {
  "use strict";

  window.LewyTrader = window.LewyTrader || {};

  // Native title delay is browser-fixed (~1s). Custom tips show at half that.
  var TIP_SHOW_DELAY_MS = 500;
  var tipNode = null;
  var tipTimer = null;
  var tipAnchor = null;

  function systemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function currentTheme() {
    var theme = document.documentElement.getAttribute("data-theme");
    return theme === "dark" || theme === "light" ? theme : systemTheme();
  }

  function ensureTipNode() {
    if (tipNode) {
      return tipNode;
    }
    tipNode = document.createElement("div");
    tipNode.className = "lt-tooltip";
    tipNode.setAttribute("role", "tooltip");
    tipNode.hidden = true;
    document.body.appendChild(tipNode);
    return tipNode;
  }

  function hideTip() {
    if (tipTimer) {
      window.clearTimeout(tipTimer);
      tipTimer = null;
    }
    tipAnchor = null;
    if (tipNode) {
      tipNode.hidden = true;
      tipNode.textContent = "";
    }
  }

  function positionTip(anchor) {
    var node = ensureTipNode();
    var rect = anchor.getBoundingClientRect();
    var tipRect = node.getBoundingClientRect();
    var gap = 8;
    var left = rect.left + rect.width / 2 - tipRect.width / 2;
    var top = rect.top - tipRect.height - gap;
    if (top < 8) {
      top = rect.bottom + gap;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - tipRect.width - 8));
    node.style.left = Math.round(left + window.scrollX) + "px";
    node.style.top = Math.round(top + window.scrollY) + "px";
  }

  function showTip(anchor) {
    var text = anchor.getAttribute("data-tip");
    if (!text) {
      return;
    }
    var node = ensureTipNode();
    node.textContent = text;
    node.hidden = false;
    tipAnchor = anchor;
    positionTip(anchor);
  }

  function scheduleTip(anchor) {
    if (tipAnchor === anchor && tipNode && !tipNode.hidden) {
      return;
    }
    hideTip();
    tipTimer = window.setTimeout(function () {
      tipTimer = null;
      showTip(anchor);
    }, TIP_SHOW_DELAY_MS);
  }

  function tipTarget(eventTarget) {
    if (!eventTarget || !eventTarget.closest) {
      return null;
    }
    return eventTarget.closest("[data-tip]");
  }

  function bindTooltips() {
    document.addEventListener("pointerover", function (event) {
      var anchor = tipTarget(event.target);
      if (!anchor) {
        return;
      }
      scheduleTip(anchor);
    });
    document.addEventListener("pointerout", function (event) {
      var anchor = tipTarget(event.target);
      if (!anchor) {
        return;
      }
      var related = event.relatedTarget;
      if (related && anchor.contains(related)) {
        return;
      }
      hideTip();
    });
    document.addEventListener("scroll", hideTip, true);
    window.addEventListener("resize", hideTip);
  }

  function updateToggleButton() {
    var button = document.querySelector(".theme-toggle");
    if (!button) {
      return;
    }
    var theme = currentTheme();
    var nextTheme = theme === "dark" ? "light" : "dark";
    button.setAttribute("aria-label", "Switch to " + nextTheme + " theme");
    button.setAttribute("data-tip", nextTheme === "dark" ? "Dark mode" : "Light mode");
    button.classList.add("term-hint");
  }

  window.LewyTrader.getTheme = currentTheme;
  window.LewyTrader.updateThemeToggle = updateToggleButton;

  // Single JS helper for clock timestamps — mirrors Python
  // ``format_report_timestamp`` (YYYY-MM-DD HH:MM UTC).
  function formatUtcTimestamp(iso) {
    if (!iso) {
      return "—";
    }
    var date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return String(iso);
    }
    return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }

  // Calendar days — mirrors Python ``format_report_date`` (YYYY-MM-DD).
  function formatUtcDate(iso) {
    if (!iso) {
      return "—";
    }
    return String(iso).slice(0, 10);
  }

  function formatUtcDateTimes(root) {
    var scope = root || document;
    scope.querySelectorAll("time.utc-datetime[datetime]").forEach(function (node) {
      var iso = node.getAttribute("datetime");
      if (!iso) {
        return;
      }
      node.textContent = formatUtcTimestamp(iso);
      node.removeAttribute("title");
      node.removeAttribute("data-tip");
      node.classList.remove("term-hint");
    });
  }

  // Select options cannot hold a <time> element; data-datetime carries the ISO
  // instant and the visible label uses formatUtcTimestamp.
  function formatUtcOptionDates(root) {
    var scope = root || document;
    scope.querySelectorAll("option[data-datetime]").forEach(function (node) {
      var iso = node.getAttribute("data-datetime");
      if (!iso) {
        return;
      }
      node.textContent = formatUtcTimestamp(iso) + (node.getAttribute("data-suffix") || "");
      node.removeAttribute("title");
      node.removeAttribute("data-tip");
    });
    scope.querySelectorAll("select").forEach(clearSelectDateTip);
  }

  function clearSelectDateTip(select) {
    var option = select.options[select.selectedIndex];
    if (!option || !option.hasAttribute("data-datetime")) {
      return;
    }
    select.removeAttribute("title");
    select.removeAttribute("data-tip");
    select.classList.remove("term-hint");
  }

  function formatUtcDates(root) {
    var scope = root || document;
    scope.querySelectorAll("time.utc-date[datetime]").forEach(function (node) {
      var iso = node.getAttribute("datetime");
      if (!iso) {
        return;
      }
      node.textContent = formatUtcDate(iso);
      node.removeAttribute("title");
      node.removeAttribute("data-tip");
      node.classList.remove("term-hint");
    });
  }

  window.LewyTrader.formatUtcTimestamp = formatUtcTimestamp;
  window.LewyTrader.formatUtcDate = formatUtcDate;
  window.LewyTrader.formatUtcDateTimes = formatUtcDateTimes;
  window.LewyTrader.formatUtcOptionDates = formatUtcOptionDates;
  window.LewyTrader.formatUtcDates = formatUtcDates;

  // Shared presentation helpers (mirrors formatting.py / layout.py).
  var EMPTY = "—";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function glossaryHint(term) {
    var map = window.LewyTrader.termGlossary || {};
    return map[term] || "";
  }

  function glossaryMarkup(term) {
    var hint = glossaryHint(term);
    if (!hint) {
      return { className: "", tip: "" };
    }
    return {
      className: " term-hint",
      tip: ' data-tip="' + escapeHtml(hint) + '"',
    };
  }

  function badge(text, variant) {
    return (
      '<span class="badge badge-' +
      escapeHtml(variant || "neutral") +
      '">' +
      escapeHtml(text) +
      "</span>"
    );
  }

  function tagList(tags, options) {
    options = options || {};
    if (!tags || !tags.length) {
      // Cards omit an empty placeholder; tables match layout.tag_list (—).
      if (options.placeholder === false) {
        return "";
      }
      return '<span class="muted">' + escapeHtml(EMPTY) + "</span>";
    }
    return tags
      .map(function (tag) {
        return '<span class="tag">' + escapeHtml(tag) + "</span>";
      })
      .join("");
  }

  function metricHtml(label, valueHtml, valueClass) {
    var g = glossaryMarkup(label);
    return (
      '<span class="rec-card-metric"><span class="metric-label' +
      g.className +
      '"' +
      g.tip +
      ">" +
      escapeHtml(label) +
      '</span><span class="rec-card-metric-value' +
      (valueClass ? " " + valueClass : "") +
      '">' +
      valueHtml +
      "</span></span>"
    );
  }

  function formatHorizon(horizon) {
    if (!horizon || horizon.value === null || horizon.value === undefined || !horizon.unit) {
      return EMPTY;
    }
    return String(horizon.value) + " " + String(horizon.unit);
  }

  function formatMoneyAmount(value, currency) {
    if (value === null || value === undefined) {
      return EMPTY;
    }
    var number = Number(value);
    if (Number.isNaN(number)) {
      return String(value);
    }
    var text = number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency ? text + " " + currency : text;
  }

  function formatScore1dp(value) {
    if (value === null || value === undefined) {
      return EMPTY;
    }
    var number = Number(value);
    if (Number.isNaN(number)) {
      return EMPTY;
    }
    return number.toFixed(1);
  }

  function formatAiCell(attractiveness, conviction) {
    if (!Number.isInteger(attractiveness)) {
      return EMPTY;
    }
    var convictionText = Number.isInteger(conviction) ? String(conviction) : EMPTY;
    return String(attractiveness) + " (" + convictionText + ")";
  }

  var SCORE_CIRCLE_VARIANTS = { BUY: "buy", SELL: "sell" };

  function scoreCircleVariant(recType) {
    return SCORE_CIRCLE_VARIANTS[recType] || "none";
  }

  function renderScoreCircle(score, recType, small) {
    // Colour tracks recommendation type; size only from ``small``.
    var variant = scoreCircleVariant(recType || "");
    var size = small ? " score-circle-sm" : "";
    var text = typeof score === "number" && !Number.isNaN(score) ? formatScore1dp(score) : EMPTY;
    return (
      '<span class="score-circle score-circle-' +
      variant +
      size +
      '">' +
      text +
      "</span>"
    );
  }

  function isDegradedState(state) {
    var list = window.LewyTrader.degradedStates || [];
    return list.indexOf(state) !== -1;
  }

  function isAnalysisNotRunState(state) {
    var list = window.LewyTrader.analysisNotRunStates || [];
    return list.indexOf(state) !== -1;
  }

  window.LewyTrader.EMPTY = EMPTY;
  window.LewyTrader.escapeHtml = escapeHtml;
  window.LewyTrader.glossaryHint = glossaryHint;
  window.LewyTrader.glossaryMarkup = glossaryMarkup;
  window.LewyTrader.badge = badge;
  window.LewyTrader.tagList = tagList;
  window.LewyTrader.metricHtml = metricHtml;
  window.LewyTrader.formatHorizon = formatHorizon;
  window.LewyTrader.formatMoneyAmount = formatMoneyAmount;
  window.LewyTrader.formatScore1dp = formatScore1dp;
  window.LewyTrader.formatAiCell = formatAiCell;
  window.LewyTrader.scoreCircleVariant = scoreCircleVariant;
  window.LewyTrader.renderScoreCircle = renderScoreCircle;
  window.LewyTrader.isDegradedState = isDegradedState;
  window.LewyTrader.isAnalysisNotRunState = isAnalysisNotRunState;

  function initPage() {
    bindTooltips();
    updateToggleButton();
    formatUtcDateTimes();
    formatUtcDates();
    formatUtcOptionDates();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPage);
  } else {
    initPage();
  }
  document.addEventListener("lewytrader-theme-change", updateToggleButton);
})();
