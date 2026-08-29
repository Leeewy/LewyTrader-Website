(function () {
  "use strict";

  var TYPE_BADGE = {
    BUY: "type-buy",
    SELL: "type-sell",
    NO_ACTION: "type-no-action",
  };

  var STATE_LABELS = {
    accepted: "Accepted",
    downgraded: "Downgraded",
    short_circuited: "Short-circuited",
    failed: "Failed",
    not_evaluated: "Not evaluated",
  };

  var DEGRADED_STATES = {
    downgraded: true,
    short_circuited: true,
    failed: true,
  };

  var reportPromise = null;
  var ownedTickers = null;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalize(value) {
    return (value || "").trim().toLowerCase();
  }

  function loadReport() {
    if (!reportPromise) {
      reportPromise = fetch("data/report.json").then(function (response) {
        if (!response.ok) {
          throw new Error("Failed to load report data.");
        }
        return response.json();
      });
    }
    return reportPromise;
  }

  function readRunParam() {
    var params = new URLSearchParams(window.location.search);
    var run = params.get("run");
    return run ? String(run).trim() : "";
  }

  function writeRunParam(runId, latestRunId) {
    var url = new URL(window.location.href);
    if (!runId || runId === latestRunId) {
      url.searchParams.delete("run");
    } else {
      url.searchParams.set("run", runId);
    }
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
  }

  function companyHref(ticker, runId, latestRunId) {
    var href = "company.html?ticker=" + encodeURIComponent(ticker);
    if (runId && runId !== latestRunId) {
      href += "&run=" + encodeURIComponent(runId);
    }
    return href;
  }

  function scoreClass(score) {
    if (typeof score !== "number") {
      return "";
    }
    if (score >= 70) {
      return "score-high";
    }
    if (score >= 50) {
      return "score-mid";
    }
    return "score-low";
  }

  function scorePill(score) {
    if (typeof score !== "number") {
      return "—";
    }
    return (
      '<span class="score-pill ' +
      scoreClass(score) +
      '">' +
      escapeHtml(String(score)) +
      "</span>"
    );
  }

  function formatOpportunity(value) {
    if (value === null || value === undefined) {
      return "—";
    }
    var number = Number(value);
    if (Number.isNaN(number)) {
      return "—";
    }
    return number.toFixed(1);
  }

  function tagList(tags) {
    if (!tags || !tags.length) {
      return "";
    }
    return tags
      .map(function (tag) {
        return '<span class="tag">' + escapeHtml(tag) + "</span>";
      })
      .join("");
  }

  function resolveOwnedTickers(report) {
    if (ownedTickers !== null) {
      return ownedTickers;
    }
    var table = document.getElementById("recommendation-table");
    var expose =
      table && table.getAttribute("data-expose-ownership") === "true";
    ownedTickers = {};
    if (expose && report.portfolio) {
      report.portfolio.forEach(function (position) {
        if (position && position.ticker) {
          ownedTickers[position.ticker] = true;
        }
      });
    }
    return ownedTickers;
  }

  function renderRow(entry, runId, latestRunId, owned) {
    var state = entry.evaluation_state || "not_evaluated";
    var stateLabel = STATE_LABELS[state] || state.replace(/_/g, " ");
    var view = entry.view;
    var typeValue;
    var typeHtml;
    var attrHtml;
    var convHtml;
    var rowClass;

    if (!view) {
      typeValue = "not_evaluated";
      typeHtml = '<span class="badge badge-type-none">—</span>';
      attrHtml = "—";
      convHtml = "—";
      rowClass = "recommendation-row not-evaluated outcome-" + escapeHtml(state);
    } else {
      var recType = view.type || "";
      typeValue = recType;
      var typeVariant = TYPE_BADGE[recType] || "neutral";
      typeHtml =
        '<span class="badge badge-' +
        escapeHtml(typeVariant) +
        '">' +
        escapeHtml(recType || "—") +
        "</span>";
      attrHtml = scorePill(view.attractiveness_score);
      var conviction = view.conviction || {};
      convHtml =
        typeof conviction.score === "number"
          ? String(conviction.score)
          : "—";
      rowClass =
        "recommendation-row type-" +
        escapeHtml((recType || "none").toLowerCase()) +
        " outcome-" +
        escapeHtml(state);
      if (DEGRADED_STATES[state]) {
        rowClass += " outcome-degraded";
      }
    }

    var ownedBadge =
      owned
        ? '<span class="badge badge-owned">Owned</span>'
        : "";

    return (
      '<tr class="' +
      rowClass +
      '" data-ticker="' +
      escapeHtml(entry.ticker) +
      '" data-type="' +
      escapeHtml(typeValue) +
      '" data-tags="' +
      escapeHtml((entry.tags || []).join(" ")) +
      '" data-state="' +
      escapeHtml(state) +
      '"><td><div class="company-cell-top">' +
      '<a class="company-link" href="' +
      escapeHtml(companyHref(entry.ticker, runId, latestRunId)) +
      '" data-ticker="' +
      escapeHtml(entry.ticker) +
      '">' +
      escapeHtml(entry.ticker) +
      "</a> " +
      ownedBadge +
      '</div><div class="company-name">' +
      escapeHtml(entry.name || "") +
      '</div><div class="tag-row">' +
      tagList(entry.tags || []) +
      "</div></td><td>" +
      typeHtml +
      "</td><td>" +
      attrHtml +
      "</td><td>" +
      convHtml +
      "</td><td>" +
      escapeHtml(formatOpportunity(entry.opportunity_score)) +
      '</td><td><span class="state-pill state-' +
      escapeHtml(state) +
      '">' +
      escapeHtml(stateLabel) +
      "</span></td></tr>"
    );
  }

  function updateRunMeta(mainList) {
    var runIdNode = document.getElementById("recommendation-run-id");
    var evaluatedNode = document.getElementById("recommendation-evaluated-at");
    if (runIdNode) {
      runIdNode.textContent = mainList.run_id || "—";
    }
    if (evaluatedNode) {
      evaluatedNode.textContent = mainList.evaluated_at || "—";
      evaluatedNode.setAttribute("datetime", mainList.evaluated_at || "");
    }
  }

  function updateCompanyLinks(runId, latestRunId) {
    document.querySelectorAll("a.company-link[data-ticker]").forEach(function (link) {
      var ticker = link.getAttribute("data-ticker");
      if (!ticker) {
        return;
      }
      link.setAttribute("href", companyHref(ticker, runId, latestRunId));
    });
  }

  function applyFilters() {
    var typeSelect = document.getElementById("filter-type");
    var stateSelect = document.getElementById("filter-state");
    var tagSelect = document.getElementById("filter-tag");
    var tickerInput = document.getElementById("filter-ticker");
    var status = document.getElementById("filter-status");
    var empty = document.getElementById("recommendation-empty");
    var table = document.getElementById("recommendation-table");
    if (!table) {
      return;
    }

    var typeFilter = typeSelect ? typeSelect.value : "";
    var stateFilter = stateSelect ? stateSelect.value : "";
    var tagFilter = tagSelect ? normalize(tagSelect.value) : "";
    var tickerFilter = tickerInput ? normalize(tickerInput.value) : "";
    var rows = table.querySelectorAll("tbody tr.recommendation-row");
    var visible = 0;

    rows.forEach(function (row) {
      var match = true;
      if (typeFilter) {
        match = (row.getAttribute("data-type") || "") === typeFilter;
      }
      if (match && stateFilter) {
        match = (row.getAttribute("data-state") || "") === stateFilter;
      }
      if (match && tagFilter) {
        var tags = (row.getAttribute("data-tags") || "").toLowerCase().split(/\s+/);
        match = tags.indexOf(tagFilter) !== -1;
      }
      if (match && tickerFilter) {
        var ticker = (row.getAttribute("data-ticker") || "").toLowerCase();
        match = ticker.indexOf(tickerFilter) !== -1;
      }
      row.classList.toggle("hidden", !match);
      if (match) {
        visible += 1;
      }
    });

    if (empty) {
      empty.classList.toggle("hidden", visible > 0 || rows.length === 0);
    }
    if (status) {
      var total = rows.length;
      var active =
        !typeFilter && !stateFilter && !tagFilter && !tickerFilter;
      if (active) {
        status.textContent = total + " companies";
      } else {
        status.textContent = "Showing " + visible + " of " + total;
      }
    }
  }

  function selectMainList(report, runId) {
    var byRun = report.recommendations_by_run || {};
    var runs = report.recommendation_runs || [];
    var latest =
      (runs[0] && runs[0].run_id) ||
      (report.recommendations && report.recommendations.run_id) ||
      "";
    var wanted = runId || latest;
    if (wanted && byRun[wanted]) {
      return { mainList: byRun[wanted], runId: wanted, latestRunId: latest };
    }
    if (report.recommendations) {
      return {
        mainList: report.recommendations,
        runId: report.recommendations.run_id,
        latestRunId: latest,
      };
    }
    return null;
  }

  function renderSelectedRun(report, runId) {
    var selected = selectMainList(report, runId);
    if (!selected) {
      return;
    }
    var mainList = selected.mainList;
    var body = document.getElementById("recommendation-table-body");
    var filterBar = document.getElementById("recommendation-filters");
    var runSelect = document.getElementById("filter-run");
    var owned = resolveOwnedTickers(report);

    if (body) {
      body.innerHTML = (mainList.entries || [])
        .map(function (entry) {
          return renderRow(
            entry,
            selected.runId,
            selected.latestRunId,
            !!owned[entry.ticker]
          );
        })
        .join("");
    }

    updateRunMeta(mainList);
    updateCompanyLinks(selected.runId, selected.latestRunId);
    if (filterBar) {
      filterBar.setAttribute("data-selected-run", selected.runId);
      filterBar.setAttribute("data-total", String((mainList.entries || []).length));
    }
    if (runSelect && runSelect.value !== selected.runId) {
      runSelect.value = selected.runId;
    }
    writeRunParam(selected.runId, selected.latestRunId);
    applyFilters();
  }

  function initDashboard() {
    var runSelect = document.getElementById("filter-run");
    var typeSelect = document.getElementById("filter-type");
    var stateSelect = document.getElementById("filter-state");
    var tagSelect = document.getElementById("filter-tag");
    var tickerInput = document.getElementById("filter-ticker");
    var table = document.getElementById("recommendation-table");
    if (!table) {
      return;
    }

    [typeSelect, stateSelect, tagSelect, tickerInput].forEach(function (control) {
      if (!control) {
        return;
      }
      control.addEventListener("change", applyFilters);
      control.addEventListener("input", applyFilters);
    });

    applyFilters();

    if (!runSelect) {
      return;
    }

    loadReport()
      .then(function (report) {
        var initial = readRunParam();
        var available = report.recommendations_by_run || {};
        if (initial && !available[initial]) {
          initial = "";
        }
        renderSelectedRun(report, initial);

        runSelect.addEventListener("change", function () {
          renderSelectedRun(report, runSelect.value);
        });
      })
      .catch(function () {
        // Keep SSR table when report.json is unavailable.
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboard);
  } else {
    initDashboard();
  }
})();
