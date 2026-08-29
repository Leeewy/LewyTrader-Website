(function () {
  "use strict";

  var reportPromise = null;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeTicker(raw) {
    if (raw === null || raw === undefined) {
      return null;
    }
    var ticker = String(raw).trim().toUpperCase();
    return ticker || null;
  }

  function readTicker() {
    var params = new URLSearchParams(window.location.search);
    return normalizeTicker(params.get("ticker"));
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

  function indexHref(runId, latestRunId) {
    if (runId && runId !== latestRunId) {
      return "index.html?run=" + encodeURIComponent(runId);
    }
    return "index.html";
  }

  function latestRunId(report) {
    var runs = report.recommendation_runs || [];
    if (runs.length && runs[0].run_id) {
      return runs[0].run_id;
    }
    if (report.recommendations && report.recommendations.run_id) {
      return report.recommendations.run_id;
    }
    return "";
  }

  function recommendationFromMainList(mainList, ticker) {
    if (!mainList) {
      return null;
    }
    var entries = mainList.entries || [];
    for (var i = 0; i < entries.length; i += 1) {
      if (entries[i].ticker === ticker) {
        return {
          run_id: mainList.run_id,
          evaluated_at: mainList.evaluated_at,
          evaluation_state: entries[i].evaluation_state || "not_evaluated",
          view: entries[i].view || null,
        };
      }
    }
    return {
      run_id: mainList.run_id,
      evaluated_at: mainList.evaluated_at,
      evaluation_state: "not_evaluated",
      view: null,
    };
  }

  function resolveRecommendation(report, ticker, runId) {
    var byRun = report.recommendations_by_run || {};
    var latest = latestRunId(report);
    var wanted = runId || latest;
    if (wanted && byRun[wanted]) {
      return {
        recommendation: recommendationFromMainList(byRun[wanted], ticker),
        runId: wanted,
        latestRunId: latest,
      };
    }
    var embedded =
      report.companies &&
      report.companies[ticker] &&
      report.companies[ticker].recommendation;
    return {
      recommendation: embedded || null,
      runId: embedded && embedded.run_id ? embedded.run_id : latest,
      latestRunId: latest,
    };
  }

  function renderRunSelector(report, selectedRunId, latest) {
    var runs = report.recommendation_runs || [];
    if (!runs.length) {
      return "";
    }
    var options = runs
      .map(function (run) {
        var label = (run.evaluated_at || "") + " · " + (run.run_id || "");
        if (run.run_id === latest || run.is_latest) {
          label += " (latest)";
        }
        var selected = run.run_id === selectedRunId ? " selected" : "";
        return (
          '<option value="' +
          escapeHtml(run.run_id) +
          '"' +
          selected +
          ">" +
          escapeHtml(label) +
          "</option>"
        );
      })
      .join("");
    return (
      '<label class="filter-field filter-field-run rec-run-selector">' +
      '<span class="filter-label">Evaluation run</span>' +
      '<select id="company-filter-run" name="run" aria-label="Select evaluation run">' +
      options +
      "</select></label>"
    );
  }

  function loadReport() {
    if (!reportPromise) {
      reportPromise = fetch("data/report.json")
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Failed to load report data.");
          }
          return response.json();
        });
    }
    return reportPromise;
  }

  function loadShortChart(ticker) {
    return fetch("data/charts/" + encodeURIComponent(ticker) + "-short.json").then(
      function (response) {
        if (!response.ok) {
          throw new Error("Failed to load chart data.");
        }
        return response.json();
      }
    );
  }

  function badge(text, variant) {
    return (
      '<span class="badge badge-' +
      escapeHtml(variant) +
      '">' +
      escapeHtml(text) +
      "</span>"
    );
  }

  function tagList(tags) {
    if (!tags.length) {
      return '<span class="muted">—</span>';
    }
    return tags
      .map(function (tag) {
        return '<span class="tag">' + escapeHtml(tag) + "</span>";
      })
      .join("");
  }

  function section(title, content) {
    return (
      '<section class="section"><h2>' +
      escapeHtml(title) +
      "</h2>" +
      content +
      "</section>"
    );
  }

  function metricGrid(items) {
    if (!items.length) {
      return '<p class="muted">No data available.</p>';
    }
    return (
      '<div class="metric-grid">' +
      items
        .map(function (item) {
          return (
            '<div class="metric-card"><span class="metric-label">' +
            escapeHtml(item.label) +
            '</span><span class="metric-value">' +
            escapeHtml(item.value) +
            "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function factorList(labels, kind) {
    if (!labels.length) {
      return '<span class="muted">No ' + kind + " identified</span>";
    }
    return (
      '<ul class="factor-list factor-list-' +
      kind +
      '">' +
      labels
        .map(function (label) {
          return "<li>" + escapeHtml(label) + "</li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function renderOpportunity(opportunity, isActive) {
    if (!isActive) {
      return (
        '<p class="muted">Archived companies are excluded from the ' +
        "watchlist opportunity ranking.</p>"
      );
    }
    if (!opportunity) {
      return '<p class="muted">Insufficient data to score this company.</p>';
    }

    var factorRows = opportunity.factors
      .map(function (factor) {
        return (
          "<tr><td>" +
          escapeHtml(factor.label) +
          "</td><td>" +
          escapeHtml(factor.value) +
          "</td><td>" +
          escapeHtml(factor.score) +
          "</td><td>" +
          escapeHtml(factor.explanation) +
          "</td></tr>"
        );
      })
      .join("");

    return (
      '<div class="score-panel"><div class="score-panel-main">' +
      '<span class="score-pill large ' +
      escapeHtml(opportunity.score_class) +
      '">' +
      escapeHtml(opportunity.score) +
      '</span><span class="score-caption">Watchlist opportunity score · rank #' +
      escapeHtml(opportunity.rank) +
      "</span></div></div>" +
      '<div class="strength-risk-grid"><div class="strength-risk-panel"><h3>Strengths</h3>' +
      factorList(opportunity.strengths, "strength") +
      '</div><div class="strength-risk-panel"><h3>Risks</h3>' +
      factorList(opportunity.risks, "risk") +
      "</div></div>" +
      '<table class="data-table factor-table"><thead><tr><th>Factor</th><th>Value</th>' +
      "<th>Score</th><th>Explanation</th></tr></thead><tbody>" +
      factorRows +
      "</tbody></table>"
    );
  }

  function proseBlock(text, emptyMessage) {
    if (text) {
      return '<p class="prose">' + escapeHtml(text) + "</p>";
    }
    return '<p class="muted">' + escapeHtml(emptyMessage) + "</p>";
  }

  var TYPE_BADGE = {
    BUY: "type-buy",
    SELL: "type-sell",
    NO_ACTION: "type-no-action",
  };

  // Keep in sync with src/report/recommendation_outcome.py (SoT: docs/web/_MAIN.md).
  var STATE_LABELS = {
    accepted: "Accepted",
    downgraded: "Downgraded",
    short_circuited: "Short-circuited",
    failed: "Failed",
    not_evaluated: "Not evaluated",
  };

  var STATE_SUMMARIES = {
    accepted:
      "Analyst proposal survived validation; recommendation type and levels " +
      "are unchanged.",
    downgraded:
      "Validation forced NO_ACTION and cleared actionable levels; the AI " +
      "narrative and scores are kept for review.",
    short_circuited:
      "Investment Snapshot could not be produced for this ticker, so the " +
      "analyst was never invoked. Result is deterministic NO_ACTION with " +
      "null attractiveness.",
    failed:
      "The AI Investment Analyst failed after retries (provider or parse). " +
      "Result is deterministic NO_ACTION with null attractiveness.",
    not_evaluated: "This company was not evaluated in the selected run.",
  };

  var ANALYSIS_NOT_RUN_STATES = {
    short_circuited: true,
    failed: true,
  };

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

  function formatScore(score) {
    if (typeof score !== "number") {
      return "—";
    }
    return String(score);
  }

  function formatHorizon(horizon) {
    if (!horizon || horizon.value === null || horizon.value === undefined || !horizon.unit) {
      return "—";
    }
    return String(horizon.value) + " " + String(horizon.unit);
  }

  function formatEvidenceRef(item) {
    if (!item || typeof item !== "object") {
      return null;
    }
    if (item.type === "mir_finding" && item.id) {
      return "mir_finding:" + item.id;
    }
    if (item.type === "snapshot" && item.path) {
      return "snapshot:" + item.path;
    }
    return null;
  }

  function runMeta(recommendation) {
    return (
      '<dl class="rec-run-meta">' +
      "<div><dt>Run</dt><dd>" +
      escapeHtml(recommendation.run_id || "—") +
      "</dd></div>" +
      "<div><dt>Evaluated</dt><dd>" +
      '<time datetime="' +
      escapeHtml(recommendation.evaluated_at || "") +
      '">' +
      escapeHtml(recommendation.evaluated_at || "—") +
      "</time></dd></div>" +
      "</dl>"
    );
  }

  function renderLevels(levels, currency) {
    if (!levels) {
      return "";
    }
    var entry = levels.entry_range || {};
    var items = [];
    if (entry.low !== undefined && entry.low !== null && entry.high !== undefined && entry.high !== null) {
      items.push({
        label: "Entry range",
        value:
          String(entry.low) +
          " – " +
          String(entry.high) +
          (currency ? " " + currency : ""),
      });
    }
    if (levels.stop_loss !== undefined && levels.stop_loss !== null) {
      items.push({
        label: "Stop loss",
        value: String(levels.stop_loss) + (currency ? " " + currency : ""),
      });
    }
    if (levels.take_profit !== undefined && levels.take_profit !== null) {
      items.push({
        label: "Take profit",
        value: String(levels.take_profit) + (currency ? " " + currency : ""),
      });
    }
    if (!items.length) {
      return "";
    }
    return '<h3 class="rec-subsection-title">Actionable levels</h3>' + metricGrid(items);
  }

  function renderEvidence(evidence) {
    var refs = (evidence || [])
      .map(formatEvidenceRef)
      .filter(function (ref) {
        return ref;
      });
    if (!refs.length) {
      return (
        '<h3 class="rec-subsection-title">Evidence</h3>' +
        '<p class="muted">No deterministic evidence references.</p>'
      );
    }
    return (
      '<h3 class="rec-subsection-title">Evidence</h3>' +
      '<ul class="evidence-list">' +
      refs
        .map(function (ref) {
          return "<li><code>" + escapeHtml(ref) + "</code></li>";
        })
        .join("") +
      "</ul>"
    );
  }

  function renderOutcomeCallout(state) {
    var summary = STATE_SUMMARIES[state];
    if (!summary) {
      return "";
    }
    return (
      '<aside class="rec-outcome-callout outcome-' +
      escapeHtml(state) +
      '" data-outcome="' +
      escapeHtml(state) +
      '" role="status">' +
      '<p class="rec-outcome-title">' +
      escapeHtml(STATE_LABELS[state] || state) +
      "</p>" +
      '<p class="rec-outcome-summary">' +
      escapeHtml(summary) +
      "</p></aside>"
    );
  }

  function renderEvaluationNotes(evaluation) {
    if (!evaluation) {
      return "";
    }
    // Allowlisted TickerOutcome fields only — never expand beyond outcome/reasons/warnings.
    var reasons = evaluation.reasons || [];
    var warnings = evaluation.warnings || [];
    if (!reasons.length && !warnings.length) {
      return "";
    }
    var parts = ['<h3 class="rec-subsection-title">Evaluation notes</h3>'];
    if (reasons.length) {
      parts.push(
        '<p class="rec-eval-label">Reasons</p><ul class="plain-list rec-eval-reasons">' +
          reasons
            .map(function (item) {
              return "<li><code>" + escapeHtml(item) + "</code></li>";
            })
            .join("") +
          "</ul>"
      );
    }
    if (warnings.length) {
      parts.push(
        '<p class="rec-eval-label">Warnings</p><ul class="plain-list rec-eval-warnings">' +
          warnings
            .map(function (item) {
              return "<li><code>" + escapeHtml(item) + "</code></li>";
            })
            .join("") +
          "</ul>"
      );
    }
    return parts.join("");
  }

  function renderScorePanel(attractiveness, conviction) {
    return (
      '<div class="score-panel rec-score-panel">' +
      '<div class="score-panel-main">' +
      '<span class="score-pill large ' +
      escapeHtml(scoreClass(attractiveness)) +
      '">' +
      escapeHtml(formatScore(attractiveness)) +
      '</span><span class="score-caption">Attractiveness</span></div>' +
      '<div class="score-panel-main">' +
      '<span class="score-pill large ' +
      escapeHtml(scoreClass(conviction.score)) +
      '">' +
      escapeHtml(formatScore(conviction.score)) +
      '</span><span class="score-caption">Conviction</span></div></div>'
    );
  }

  function renderAnalyzedBody(view, currency) {
    var conviction = view.conviction || {};
    var horizon = view.horizon || {};
    return (
      renderScorePanel(view.attractiveness_score, conviction) +
      proseBlock(conviction.explanation, "No conviction explanation.") +
      '<p class="rec-horizon"><span class="metric-label">Horizon</span> ' +
      escapeHtml(formatHorizon(horizon)) +
      "</p>" +
      '<h3 class="rec-subsection-title">Rationale</h3>' +
      proseBlock(view.rationale, "No rationale recorded.") +
      '<h3 class="rec-subsection-title">Investment thesis</h3>' +
      proseBlock(view.investment_thesis, "No investment thesis recorded.") +
      '<div class="strength-risk-grid"><div class="strength-risk-panel"><h3>Strengths</h3>' +
      factorList(view.strengths || [], "strength") +
      '</div><div class="strength-risk-panel"><h3>Risks</h3>' +
      factorList(view.risks || [], "risk") +
      "</div></div>" +
      renderLevels(view.levels, currency) +
      renderEvidence(view.evidence)
    );
  }

  function renderAnalysisNotRunBody(view) {
    var conviction = view.conviction || {};
    return (
      renderScorePanel(view.attractiveness_score, conviction) +
      '<p class="muted rec-null-attractiveness">Attractiveness is null because ' +
      "analysis did not run for this ticker.</p>" +
      '<h3 class="rec-subsection-title">Rationale</h3>' +
      proseBlock(view.rationale, "No rationale recorded.") +
      '<h3 class="rec-subsection-title">Investment thesis</h3>' +
      proseBlock(view.investment_thesis, "No investment thesis recorded.")
    );
  }

  function renderRecommendation(recommendation, runSelectorHtml) {
    var selector = runSelectorHtml || "";
    if (!recommendation) {
      return (
        selector +
        '<p class="muted">No completed evaluation run is available yet. ' +
        "Generate recommendations, then refresh this website.</p>"
      );
    }

    var state = recommendation.evaluation_state || "not_evaluated";
    var stateLabel = STATE_LABELS[state] || state.replace(/_/g, " ");
    var view = recommendation.view;

    if (!view) {
      return (
        selector +
        runMeta(recommendation) +
        '<div class="badge-row rec-status-row">' +
        '<span class="state-pill state-' +
        escapeHtml(state) +
        '">' +
        escapeHtml(stateLabel) +
        "</span></div>" +
        renderOutcomeCallout(state)
      );
    }

    var recType = view.type || "—";
    var typeVariant = TYPE_BADGE[recType] || "type-none";
    var evaluation = view.evaluation || {};
    var currency = view.instrument_currency || "";
    var body = ANALYSIS_NOT_RUN_STATES[state]
      ? renderAnalysisNotRunBody(view)
      : renderAnalyzedBody(view, currency);

    return (
      selector +
      runMeta(recommendation) +
      '<div class="badge-row rec-status-row">' +
      badge(recType, typeVariant) +
      '<span class="state-pill state-' +
      escapeHtml(state) +
      '">' +
      escapeHtml(stateLabel) +
      "</span></div>" +
      renderOutcomeCallout(state) +
      body +
      renderEvaluationNotes(evaluation)
    );
  }

  function renderCompany(view, report, selectedRunId) {
    var resolved = resolveRecommendation(report, view.ticker, selectedRunId);
    var recommendation = resolved.recommendation;
    var runId = resolved.runId;
    var latest = resolved.latestRunId;
    var selectorHtml = renderRunSelector(report, runId, latest);
    writeRunParam(runId, latest);

    var badges = view.status_badges
      .map(function (entry) {
        return badge(entry.text, entry.variant);
      })
      .join("");

    var chartSection = view.has_chart
      ? '<div class="chart-panel" id="price-chart-panel" aria-label="Historical price chart for ' +
        escapeHtml(view.ticker) +
        '"></div>'
      : '<p class="muted">No historical price data available for charting.</p>';

    return (
      '<div class="page-header company-header"><div>' +
      '<p class="eyebrow"><a id="company-back-link" href="' +
      escapeHtml(indexHref(runId, latest)) +
      '">Latest Recommendations</a></p>' +
      "<h1>" +
      escapeHtml(view.ticker) +
      "</h1>" +
      '<p class="company-title">' +
      escapeHtml(view.name) +
      "</p>" +
      '<div class="badge-row">' +
      badges +
      " " +
      tagList(view.tags) +
      "</div>" +
      '<p class="lede">' +
      escapeHtml(view.summary_line) +
      "</p></div></div>" +
      section(
        "Recommendation",
        '<div id="company-recommendation-root">' +
          renderRecommendation(recommendation, selectorHtml) +
          "</div>"
      ) +
      section("Watchlist opportunity score", renderOpportunity(view.opportunity, view.is_active)) +
      section("Watchlist thesis", proseBlock(view.thesis, "No watchlist thesis recorded.")) +
      section("Notes", proseBlock(view.notes, "No notes recorded.")) +
      section("Key fundamentals", metricGrid(view.fundamentals)) +
      section("Technical indicators", metricGrid(view.indicators)) +
      section("Price history", chartSection)
    );
  }

  function showError(message) {
    var loading = document.getElementById("company-loading");
    var content = document.getElementById("company-content");
    var error = document.getElementById("company-error");
    if (loading) {
      loading.classList.add("hidden");
    }
    if (content) {
      content.classList.add("hidden");
    }
    if (error) {
      error.classList.remove("hidden");
      error.innerHTML =
        section(
          "Company not found",
          '<p class="muted">' +
            escapeHtml(message) +
            '</p><p><a href="index.html">Return to Latest Recommendations</a></p>'
        );
    }
    document.title = "Company not found · LewyTrader";
  }

  function bindCompanyRunSelector(report, view) {
    var select = document.getElementById("company-filter-run");
    if (!select) {
      return;
    }
    select.addEventListener("change", function () {
      var root = document.getElementById("company-recommendation-root");
      var back = document.getElementById("company-back-link");
      var resolved = resolveRecommendation(report, view.ticker, select.value);
      var selectorHtml = renderRunSelector(
        report,
        resolved.runId,
        resolved.latestRunId
      );
      writeRunParam(resolved.runId, resolved.latestRunId);
      if (root) {
        root.innerHTML = renderRecommendation(
          resolved.recommendation,
          selectorHtml
        );
        bindCompanyRunSelector(report, view);
      }
      if (back) {
        back.setAttribute(
          "href",
          indexHref(resolved.runId, resolved.latestRunId)
        );
      }
    });
  }

  function initCompanyPage() {
    var root = document.getElementById("company-app");
    if (!root) {
      return;
    }

    var ticker = readTicker();
    if (!ticker) {
      showError("No ticker was provided. Open a company from Latest Recommendations.");
      return;
    }

    loadReport()
      .then(function (report) {
        var view = report.companies && report.companies[ticker];
        if (!view) {
          showError("'" + ticker + "' was not found in the current watchlist report.");
          return;
        }

        var requestedRun = readRunParam();
        var available = report.recommendations_by_run || {};
        if (requestedRun && !available[requestedRun]) {
          requestedRun = "";
        }

        document.title = view.ticker + " · " + view.name + " · LewyTrader";
        var loading = document.getElementById("company-loading");
        var content = document.getElementById("company-content");
        if (loading) {
          loading.classList.add("hidden");
        }
        if (content) {
          content.classList.remove("hidden");
          content.innerHTML = renderCompany(view, report, requestedRun);
          bindCompanyRunSelector(report, view);
        }

        if (view.has_chart && window.LewyTrader.initPriceChart) {
          var chartPanel = document.getElementById("price-chart-panel");
          if (chartPanel) {
            loadShortChart(ticker)
              .then(function (chartData) {
                window.LewyTrader.initPriceChart(chartPanel, chartData, ticker);
              })
              .catch(function () {
                chartPanel.innerHTML =
                  '<p class="muted">Unable to load historical price data for charting.</p>';
              });
          }
        }
      })
      .catch(function () {
        showError("Unable to load report data for this company.");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCompanyPage);
  } else {
    initCompanyPage();
  }
})();
