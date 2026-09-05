(function () {
  "use strict";

  // Buy and sell render as cards in equal-width panels; everything else stays
  // a single-line table. Mirrors recommendation_pages.py.
  var GROUPS = [
    {
      key: "BUY",
      slug: "buy",
      listId: "rec-list-buy",
      emptyNote: "No buy recommendations in this review.",
      filterNote: "No buy recommendations match the current filters.",
    },
    {
      key: "SELL",
      slug: "sell",
      listId: "rec-list-sell",
      emptyNote: "No sell recommendations in this review.",
      filterNote: "No sell recommendations match the current filters.",
    },
    {
      key: "NO_ACTION",
      slug: "no-action",
      listId: "recommendation-table-body",
      // A lone header row reads as broken, so the table hides when empty.
      hideWhenEmptyId: "recommendation-table",
      emptyNote: "Every company in this review has a buy or sell recommendation.",
      filterNote: "No companies match the current filters.",
    },
  ];

  var reportPromise = null;

  function escapeHtml(value) {
    return window.LewyTrader.escapeHtml(value);
  }

  function glossaryMarkup(term) {
    return window.LewyTrader.glossaryMarkup(term);
  }

  function tagList(tags, options) {
    return window.LewyTrader.tagList(tags, options);
  }

  function metricHtml(label, valueHtml, valueClass) {
    return window.LewyTrader.metricHtml(label, valueHtml, valueClass);
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

  // Shared with company.js via assets/app.js (mirrors formatting.py).
  function scoreCircle(score, recType, small) {
    return window.LewyTrader.renderScoreCircle(score, recType, small);
  }

  function aiCell(attractiveness, conviction) {
    return escapeHtml(window.LewyTrader.formatAiCell(attractiveness, conviction));
  }

  function formatOpportunity(value) {
    return window.LewyTrader.formatScore1dp(value);
  }

  function priceDisplayFor(report, ticker) {
    var company = report && report.companies && report.companies[ticker];
    return company && company.price_display ? String(company.price_display) : "";
  }

  function priceHtml(priceDisplay) {
    if (!priceDisplay) {
      return "";
    }
    return '<span class="company-price">' + escapeHtml(priceDisplay) + "</span>";
  }

  // Shared fragments so cards and table rows cannot drift apart.
  function entryCells(entry, runId, latestRunId) {
    var state = entry.evaluation_state || "not_evaluated";
    var view = entry.view;
    var tags = entry.tags || [];
    var cells = {
      state: state,
      tagsAttr: escapeHtml(tags.join(" ")),
      // Cards omit empty placeholders; the table matches layout.tag_list (—).
      tagsHtml: tagList(tags, { placeholder: false }),
      tableTagsHtml: tagList(tags),
      companyHref: escapeHtml(companyHref(entry.ticker, runId, latestRunId)),
      opportunityHtml: escapeHtml(formatOpportunity(entry.opportunity_score)),
    };

    if (!view) {
      cells.typeValue = "not_evaluated";
      cells.aiHtml = "—";
      cells.scoreHtml = scoreCircle(entry.score, "", true);
      cells.rowClass =
        "recommendation-row not-evaluated outcome-" + escapeHtml(state);
      return cells;
    }

    var recType = view.type || "";
    var conviction = view.conviction || {};
    cells.typeValue = escapeHtml(recType);
    // No-action table uses the compact ring; buy/sell cards use full size.
    cells.scoreHtml = scoreCircle(entry.score, recType, recType === "NO_ACTION");
    cells.aiHtml = aiCell(view.attractiveness_score, conviction.score);
    cells.rowClass =
      "recommendation-row type-" +
      escapeHtml((recType || "none").toLowerCase()) +
      " outcome-" +
      escapeHtml(state);
    if (window.LewyTrader.isDegradedState(state)) {
      cells.rowClass += " outcome-degraded";
    }
    return cells;
  }

  function dataAttributes(entry, cells) {
    return (
      ' data-ticker="' +
      escapeHtml(entry.ticker) +
      '" data-type="' +
      cells.typeValue +
      '" data-tags="' +
      cells.tagsAttr +
      '" data-state="' +
      escapeHtml(cells.state) +
      '"'
    );
  }

  function companyLink(entry, cells, priceDisplay) {
    return (
      '<a class="rec-card-company company-link" href="' +
      cells.companyHref +
      '" data-ticker="' +
      escapeHtml(entry.ticker) +
      '"><span class="company-ticker">' +
      escapeHtml(entry.ticker) +
      '</span><span class="company-name">' +
      escapeHtml(entry.name || "") +
      "</span>" +
      priceHtml(priceDisplay) +
      "</a>"
    );
  }

  function renderCard(entry, runId, latestRunId, evaluatedAt, priceDisplay) {
    var cells = entryCells(entry, runId, latestRunId);
    var tags = cells.tagsHtml
      ? '<div class="rec-card-tags">' + cells.tagsHtml + "</div>"
      : "";
    return (
      '<li class="' +
      cells.rowClass +
      ' rec-card"' +
      dataAttributes(entry, cells) +
      '><div class="rec-card-row">' +
      '<div class="rec-card-identity">' +
      companyLink(entry, cells, priceDisplay) +
      tags +
      "</div>" +
      '<div class="rec-card-aside">' +
      '<div class="rec-card-metrics">' +
      metricHtml("AI", cells.aiHtml) +
      metricHtml("Research", cells.opportunityHtml) +
      "</div>" +
      cells.scoreHtml +
      "</div>" +
      "</div>" +
      "</li>"
    );
  }

  function renderRow(entry, runId, latestRunId, evaluatedAt, priceDisplay) {
    var cells = entryCells(entry, runId, latestRunId);
    return (
      '<tr class="' +
      cells.rowClass +
      '"' +
      dataAttributes(entry, cells) +
      "><td>" +
      companyLink(entry, cells, priceDisplay) +
      '</td><td><span class="tag-row">' +
      cells.tableTagsHtml +
      '</span></td><td><span class="rec-card-metric-value">' +
      cells.aiHtml +
      '</span></td><td><span class="rec-card-metric-value">' +
      cells.opportunityHtml +
      "</span></td><td>" +
      cells.scoreHtml +
      "</td></tr>"
    );
  }

  function entryGroupKey(entry) {
    var type = entry.view && entry.view.type;
    return type === "BUY" || type === "SELL" ? type : "NO_ACTION";
  }

  function applyLocalTimestamps(scope) {
    if (window.LewyTrader && window.LewyTrader.formatUtcDateTimes) {
      window.LewyTrader.formatUtcDateTimes(scope);
    }
    if (window.LewyTrader && window.LewyTrader.formatUtcDates) {
      window.LewyTrader.formatUtcDates(scope);
    }
  }

  function updateRunMeta(mainList) {
    var evaluatedNode = document.getElementById("recommendation-evaluated-at");
    if (!evaluatedNode) {
      return;
    }
    var iso = mainList.evaluated_at || "";
    var stamp =
      window.LewyTrader && window.LewyTrader.formatUtcTimestamp
        ? window.LewyTrader.formatUtcTimestamp(iso)
        : iso || "—";
    evaluatedNode.textContent = stamp;
    evaluatedNode.setAttribute("datetime", iso);
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

  function rowMatches(row, filters) {
    if (filters.type && (row.getAttribute("data-type") || "") !== filters.type) {
      return false;
    }
    if (filters.state && (row.getAttribute("data-state") || "") !== filters.state) {
      return false;
    }
    if (filters.tag) {
      var tags = (row.getAttribute("data-tags") || "").toLowerCase().split(/\s+/);
      if (tags.indexOf(filters.tag) === -1) {
        return false;
      }
    }
    if (filters.ticker) {
      var ticker = (row.getAttribute("data-ticker") || "").toLowerCase();
      if (ticker.indexOf(filters.ticker) === -1) {
        return false;
      }
    }
    return true;
  }

  function updateGroup(group, filters) {
    var list = document.getElementById(group.listId);
    if (!list) {
      return { total: 0, visible: 0 };
    }
    var rows = list.querySelectorAll(".recommendation-row");
    var visible = 0;
    rows.forEach(function (row) {
      var match = rowMatches(row, filters);
      row.classList.toggle("hidden", !match);
      if (match) {
        visible += 1;
      }
    });

    var count = document.getElementById("rec-count-" + group.slug);
    if (count) {
      count.textContent = String(visible);
    }
    var collapsible = group.hideWhenEmptyId
      ? document.getElementById(group.hideWhenEmptyId)
      : null;
    if (collapsible) {
      collapsible.classList.toggle("hidden", visible === 0);
    }
    return { total: rows.length, visible: visible };
  }

  function updateGroupNote(group, result, boardEmpty) {
    var note = document.getElementById("rec-note-" + group.slug);
    if (!note) {
      return;
    }
    // When nothing on the board matches, one board-level note says it once.
    note.textContent = result.total === 0 ? group.emptyNote : group.filterNote;
    note.classList.toggle("hidden", result.visible > 0 || boardEmpty);
  }

  // Type and state have no controls on this page: the regions already state the
  // call and analysis state is not displayed. Row-level filtering on both is
  // kept so either control can be reintroduced without touching this logic.
  function applyFilters() {
    var typeSelect = document.getElementById("filter-type");
    var stateSelect = document.getElementById("filter-state");
    var tagSelect = document.getElementById("filter-tag");
    var tickerInput = document.getElementById("filter-ticker");
    var empty = document.getElementById("recommendation-empty");
    if (!document.getElementById("recommendation-board")) {
      return;
    }

    var filters = {
      type: typeSelect ? typeSelect.value : "",
      state: stateSelect ? stateSelect.value : "",
      tag: tagSelect ? normalize(tagSelect.value) : "",
      ticker: tickerInput ? normalize(tickerInput.value) : "",
    };

    var total = 0;
    var visible = 0;
    var results = GROUPS.map(function (group) {
      var result = updateGroup(group, filters);
      total += result.total;
      visible += result.visible;
      return result;
    });

    var boardEmpty = total > 0 && visible === 0;
    GROUPS.forEach(function (group, index) {
      updateGroupNote(group, results[index], boardEmpty);
    });

    if (empty) {
      empty.classList.toggle("hidden", !boardEmpty);
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
    var filterBar = document.getElementById("recommendation-filters");
    var runSelect = document.getElementById("filter-run");
    var buckets = { BUY: [], SELL: [], NO_ACTION: [] };

    // Entry order inside each bucket stays the settled main-list order.
    (mainList.entries || []).forEach(function (entry) {
      var group = entryGroupKey(entry);
      var render = group === "NO_ACTION" ? renderRow : renderCard;
      buckets[group].push(
        render(
          entry,
          selected.runId,
          selected.latestRunId,
          mainList.evaluated_at,
          priceDisplayFor(report, entry.ticker)
        )
      );
    });

    GROUPS.forEach(function (group) {
      var list = document.getElementById(group.listId);
      if (list) {
        list.innerHTML = buckets[group.key].join("");
        applyLocalTimestamps(list);
      }
    });

    updateRunMeta(mainList);
    updateCompanyLinks(selected.runId, selected.latestRunId);
    if (filterBar) {
      filterBar.setAttribute("data-selected-run", selected.runId);
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
    if (!document.getElementById("recommendation-board")) {
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
