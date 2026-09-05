(function () {
  "use strict";

  var reportPromise = null;
  var EMPTY = window.LewyTrader.EMPTY || "—";

  function escapeHtml(value) {
    return window.LewyTrader.escapeHtml(value);
  }

  function glossaryMarkup(term) {
    return window.LewyTrader.glossaryMarkup(term);
  }

  function badge(text, variant) {
    return window.LewyTrader.badge(text, variant);
  }

  function tagList(tags) {
    return window.LewyTrader.tagList(tags);
  }

  function metricHtml(label, valueHtml, valueClass) {
    return window.LewyTrader.metricHtml(label, valueHtml, valueClass);
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
          opportunity_score: entries[i].opportunity_score,
          score: entries[i].score,
          view: entries[i].view || null,
        };
      }
    }
    return {
      run_id: mainList.run_id,
      evaluated_at: mainList.evaluated_at,
      evaluation_state: "not_evaluated",
      opportunity_score: null,
      score: null,
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

  // Shared UTC stamp from assets/app.js (format_report_timestamp equivalent).
  function formatUtcTimestamp(iso) {
    if (window.LewyTrader && window.LewyTrader.formatUtcTimestamp) {
      return window.LewyTrader.formatUtcTimestamp(iso);
    }
    if (!iso) {
      return EMPTY;
    }
    return String(iso);
  }

  function renderRunSelector(report, selectedRunId, latest) {
    var runs = report.recommendation_runs || [];
    if (!runs.length) {
      return "";
    }
    var options = runs
      .map(function (run) {
        var utcLabel = formatUtcTimestamp(run.evaluated_at);
        var suffix =
          run.run_id === latest || run.is_latest ? " (latest)" : "";
        var selected = run.run_id === selectedRunId ? " selected" : "";
        return (
          '<option value="' +
          escapeHtml(run.run_id) +
          '"' +
          selected +
          ' data-datetime="' +
          escapeHtml(run.evaluated_at || "") +
          '" data-suffix="' +
          escapeHtml(suffix) +
          '">' +
          escapeHtml(utcLabel + suffix) +
          "</option>"
        );
      })
      .join("");
    return (
      '<label class="filter-field filter-field-run rec-run-selector">' +
      '<span class="filter-label">AI Review Date</span>' +
      '<select id="company-filter-run" name="run" aria-label="Choose a review date">' +
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

  function section(title, content, headingExtra) {
    var g = glossaryMarkup(title);
    var heading =
      '<div class="section-heading"><h2' +
      (g.className ? ' class="' + g.className.trim() + '"' : "") +
      g.tip +
      ">" +
      escapeHtml(title) +
      "</h2>" +
      (headingExtra || "") +
      "</div>";
    return '<section class="section">' + heading + content + "</section>";
  }

  // Shared with recommendations.js via assets/app.js (mirrors formatting.py).
  function scoreCircle(score, recType, small) {
    return window.LewyTrader.renderScoreCircle(score, recType, small);
  }

  function formatOpportunity(value) {
    return window.LewyTrader.formatScore1dp(value);
  }

  function aiCell(attractiveness, conviction) {
    return escapeHtml(window.LewyTrader.formatAiCell(attractiveness, conviction));
  }

  function recommendationType(recommendation) {
    var view = recommendation && recommendation.view;
    return (view && view.type) || "";
  }

  function metricsBundle(recommendation) {
    var view = recommendation && recommendation.view;
    var conviction = (view && view.conviction) || {};
    var attractiveness = view ? view.attractiveness_score : null;
    var aiHtml = view ? aiCell(attractiveness, conviction.score) : EMPTY;
    var researchHtml = escapeHtml(
      formatOpportunity(recommendation && recommendation.opportunity_score)
    );
    return {
      aiHtml: aiHtml,
      researchHtml: researchHtml,
      scoreHtml: scoreCircle(
        recommendation && recommendation.score,
        recommendationType(recommendation),
        false
      ),
      type: recommendationType(recommendation),
    };
  }

  function metricsRow(recommendation) {
    var metrics = metricsBundle(recommendation);
    return (
      '<div class="rec-card-metrics company-metrics">' +
      metricHtml("AI", metrics.aiHtml) +
      metricHtml("Research", metrics.researchHtml) +
      "</div>" +
      metrics.scoreHtml
    );
  }

  function proseBlock(text, emptyMessage) {
    if (text) {
      return '<p class="prose">' + escapeHtml(text) + "</p>";
    }
    return '<p class="muted">' + escapeHtml(emptyMessage) + "</p>";
  }

  function metricGrid(items) {
    if (!items.length) {
      return '<p class="muted">No data available.</p>';
    }
    return (
      '<div class="metric-grid">' +
      items
        .map(function (item) {
          var g = glossaryMarkup(item.label);
          return (
            '<div class="metric-card"><span class="metric-label' +
            g.className +
            '"' +
            g.tip +
            ">" +
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
      return {
        body:
          '<p class="muted">Archived companies are not included in the research ' +
          "ranking.</p>",
        headingExtra: "",
      };
    }
    if (!opportunity) {
      return {
        body: '<p class="muted">Insufficient data to score this company.</p>',
        headingExtra: "",
      };
    }

    var factorRows = opportunity.factors
      .map(function (factor) {
        var g = glossaryMarkup(factor.label);
        return (
          "<tr><td" +
          (g.className ? ' class="' + g.className.trim() + '"' : "") +
          g.tip +
          ">" +
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

    var headingExtra =
      '<div class="company-section-score">' +
      metricHtml("latest data", escapeHtml(opportunity.score)) +
      "</div>";

    return {
      body:
        '<div class="strength-risk-grid"><div class="strength-risk-panel"><h3>Strengths</h3>' +
        factorList(opportunity.strengths, "strength") +
        '</div><div class="strength-risk-panel"><h3>Risks</h3>' +
        factorList(opportunity.risks, "risk") +
        "</div></div>" +
        '<table class="data-table factor-table"><thead><tr><th>Factor</th><th>Value</th>' +
        "<th>Score</th><th>Explanation</th></tr></thead><tbody>" +
        factorRows +
        "</tbody></table>",
      headingExtra: headingExtra,
    };
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

  // Labels/summaries are inlined from src/report/recommendation_outcome.py as
  // window.LewyTrader.evaluationStateLabels / evaluationStateSummaries.
  function evaluationStateLabels() {
    return (window.LewyTrader && window.LewyTrader.evaluationStateLabels) || {};
  }

  function evaluationStateSummaries() {
    return (window.LewyTrader && window.LewyTrader.evaluationStateSummaries) || {};
  }

  function evaluationStateLabel(state) {
    var labels = evaluationStateLabels();
    if (labels[state]) {
      return labels[state];
    }
    return String(state || "").replace(/_/g, " ");
  }

  function formatHorizon(horizon) {
    return window.LewyTrader.formatHorizon(horizon);
  }

  // Labels are inlined from src/report/evidence_labels.py as
  // window.LewyTrader.snapshotEvidenceLabels / mirFindingLabel.
  function snapshotEvidenceLabels() {
    return (window.LewyTrader && window.LewyTrader.snapshotEvidenceLabels) || {};
  }

  function mirFindingLabel() {
    return (
      (window.LewyTrader && window.LewyTrader.mirFindingLabel) ||
      "Market intelligence finding"
    );
  }

  function machineEvidenceRef(item) {
    if (!item || typeof item !== "object") {
      return "";
    }
    if (item.type === "mir_finding" && item.id) {
      return "mir_finding:" + item.id;
    }
    if (item.type === "snapshot" && item.path) {
      return "snapshot:" + item.path;
    }
    return "";
  }

  function formatEvidenceRef(item) {
    if (!item || typeof item !== "object") {
      return null;
    }
    if (item.type === "mir_finding" && item.id) {
      return mirFindingLabel();
    }
    if (item.type === "snapshot" && item.path) {
      return snapshotEvidenceLabels()[item.path] || item.path;
    }
    return null;
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
          window.LewyTrader.formatMoneyAmount(entry.low, currency) +
          " – " +
          window.LewyTrader.formatMoneyAmount(entry.high, currency),
      });
    }
    if (levels.stop_loss !== undefined && levels.stop_loss !== null) {
      items.push({
        label: "Stop loss",
        value: window.LewyTrader.formatMoneyAmount(levels.stop_loss, currency),
      });
    }
    if (levels.take_profit !== undefined && levels.take_profit !== null) {
      items.push({
        label: "Take profit",
        value: window.LewyTrader.formatMoneyAmount(levels.take_profit, currency),
      });
    }
    if (!items.length) {
      return "";
    }
    return '<h3 class="rec-subsection-title">Actionable levels</h3>' + metricGrid(items);
  }

  function renderEvidence(evidence) {
    var items = (evidence || []).filter(function (item) {
      return formatEvidenceRef(item);
    });
    if (!items.length) {
      return (
        '<h3 class="rec-subsection-title">Evidence</h3>' +
        '<p class="muted">No supporting evidence recorded.</p>'
      );
    }
    return (
      '<h3 class="rec-subsection-title">Evidence</h3>' +
      '<div class="tag-row">' +
      items
        .map(function (item) {
          var label = formatEvidenceRef(item);
          var machine = machineEvidenceRef(item);
          var g = glossaryMarkup(label);
          var tip = g.tip || (machine ? ' data-tip="' + escapeHtml(machine) + '"' : "");
          return (
            '<span class="tag term-hint"' +
            tip +
            ' data-evidence-ref="' +
            escapeHtml(machine) +
            '">' +
            escapeHtml(label) +
            "</span>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderOutcomeCallout(state) {
    var summary = evaluationStateSummaries()[state];
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
      escapeHtml(evaluationStateLabel(state)) +
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

  function scoreField(valueHtml) {
    var g = glossaryMarkup("Score (Convince)");
    return (
      '<div class="filter-field filter-field-score">' +
      '<span class="filter-label' +
      g.className +
      '"' +
      g.tip +
      ">Score (Convince)</span>" +
      '<span class="score-value">' +
      valueHtml +
      "</span></div>"
    );
  }

  function horizonField(horizon) {
    var g = glossaryMarkup("Horizon");
    return (
      '<div class="filter-field filter-field-horizon">' +
      '<span class="filter-label' +
      g.className +
      '"' +
      g.tip +
      ">Horizon</span>" +
      '<span class="horizon-value">' +
      escapeHtml(formatHorizon(horizon)) +
      "</span></div>"
    );
  }

  function renderAnalysisToolbar(recommendation, runSelectorHtml, horizonHtml) {
    var metrics = metricsBundle(recommendation);
    return (
      '<div class="company-analysis-toolbar">' +
      "<h2>" +
      "AI Analysis" +
      "</h2>" +
      scoreField(metrics.aiHtml) +
      (horizonHtml || "") +
      (runSelectorHtml || "") +
      "</div>"
    );
  }

  function renderAnalyzedBody(view, currency) {
    var conviction = view.conviction || {};
    var snapshotHint = glossaryMarkup("Snapshot");
    return (
      '<h3 class="rec-subsection-title' +
      snapshotHint.className +
      '"' +
      snapshotHint.tip +
      ">Snapshot</h3>" +
      proseBlock(conviction.explanation, "No snapshot recorded.") +
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
    return (
      '<p class="muted rec-null-attractiveness">Attractiveness is null because ' +
      "analysis did not run for this ticker.</p>" +
      '<h3 class="rec-subsection-title">Rationale</h3>' +
      proseBlock(view.rationale, "No rationale recorded.") +
      '<h3 class="rec-subsection-title">Investment thesis</h3>' +
      proseBlock(view.investment_thesis, "No investment thesis recorded.")
    );
  }

  function renderRecommendation(recommendation, runSelectorHtml) {
    if (!recommendation) {
      return (
        renderAnalysisToolbar(null, runSelectorHtml, "") +
        '<p class="muted">No completed evaluation run is available yet. ' +
        "Generate recommendations, then refresh this website.</p>"
      );
    }

    var state = recommendation.evaluation_state || "not_evaluated";
    var stateLabel = evaluationStateLabel(state);
    var view = recommendation.view;
    var horizonHtml = "";
    if (view && view.horizon && !window.LewyTrader.isAnalysisNotRunState(state)) {
      horizonHtml = horizonField(view.horizon);
    }
    var toolbar = renderAnalysisToolbar(
      recommendation,
      runSelectorHtml,
      horizonHtml
    );

    if (!view) {
      return (
        toolbar +
        '<div class="badge-row rec-status-row">' +
        '<span class="state-pill state-' +
        escapeHtml(state) +
        '">' +
        escapeHtml(stateLabel) +
        "</span></div>" +
        renderOutcomeCallout(state)
      );
    }

    var recType = view.type || EMPTY;
    var typeVariant = TYPE_BADGE[recType] || "type-none";
    var evaluation = view.evaluation || {};
    var currency = view.instrument_currency || "";
    var body = window.LewyTrader.isAnalysisNotRunState(state)
      ? renderAnalysisNotRunBody(view)
      : renderAnalyzedBody(view, currency);

    // Accepted calls are already conveyed by the score ring colour; keep
    // badges and callouts for degraded / incomplete states only.
    var statusRow = "";
    if (state !== "accepted") {
      statusRow =
        '<div class="badge-row rec-status-row">' +
        badge(recType, typeVariant) +
        '<span class="state-pill state-' +
        escapeHtml(state) +
        '">' +
        escapeHtml(stateLabel) +
        "</span></div>" +
        renderOutcomeCallout(state);
    }

    return (
      toolbar +
      statusRow +
      body +
      renderEvaluationNotes(evaluation)
    );
  }

  function heroVariant(recommendation) {
    var type = recommendationType(recommendation);
    if (type === "BUY") {
      return "buy";
    }
    if (type === "SELL") {
      return "sell";
    }
    return "neutral";
  }

  function renderCompanyHero(view, recommendation) {
    var badges = view.status_badges
      .map(function (entry) {
        return badge(entry.text, entry.variant);
      })
      .join("");
    var tags = view.tags && view.tags.length ? tagList(view.tags) : "";
    // Review date lives in the AI Analysis filter; keep the hero to identity + metrics.
    var titleMeta = view.price_display
      ? '<span class="company-price">' + escapeHtml(view.price_display) + "</span>"
      : "";

    var chartDisclosure = view.has_chart
      ? '<details class="company-chart-disclosure">' +
        '<summary class="company-chart-toggle">' +
        '<span class="company-chart-chevron" aria-hidden="true"></span>' +
        "<span>Price Chart</span></summary>" +
        '<div class="company-chart-body">' +
        '<div class="chart-panel" id="price-chart-panel" aria-label="Historical price chart for ' +
        escapeHtml(view.ticker) +
        '"></div></div></details>'
      : "";

    return (
      '<div id="company-hero-root" class="company-hero company-hero-' +
      heroVariant(recommendation) +
      '"><div class="company-hero-body">' +
      '<div class="company-hero-identity">' +
      '<p class="company-title-line">' +
      '<span class="company-ticker">' +
      escapeHtml(view.ticker) +
      "</span> " +
      '<span class="company-name">' +
      escapeHtml(view.name) +
      "</span>" +
      (titleMeta ? '<span class="company-title-meta">' + titleMeta + "</span>" : "") +
      "</p>" +
      (badges || tags
        ? '<div class="badge-row company-hero-tags">' +
          badges +
          (badges && tags ? " " : "") +
          tags +
          "</div>"
        : "") +
      '</div><div class="company-hero-metrics">' +
      metricsRow(recommendation) +
      "</div></div>" +
      chartDisclosure +
      "</div>"
    );
  }

  function renderCompany(view, report, selectedRunId) {
    var resolved = resolveRecommendation(report, view.ticker, selectedRunId);
    var recommendation = resolved.recommendation;
    var runId = resolved.runId;
    var latest = resolved.latestRunId;
    var selectorHtml = renderRunSelector(report, runId, latest);
    writeRunParam(runId, latest);

    var opportunity = renderOpportunity(view.opportunity, view.is_active);

    return (
      '<div class="page-header company-header">' +
      '<p class="eyebrow"><a id="company-back-link" href="' +
      escapeHtml(indexHref(runId, latest)) +
      '">&lt; AI Recommendations</a></p></div>' +
      renderCompanyHero(view, recommendation) +
      '<section class="section company-ai-section">' +
      '<div id="company-recommendation-root">' +
      renderRecommendation(recommendation, selectorHtml) +
      "</div></section>" +
      section("Static Research", opportunity.body, opportunity.headingExtra) +
      section("Fundamentals", metricGrid(view.fundamentals)) +
      section("Technical Indicators", metricGrid(view.indicators))
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
            '</p><p><a href="index.html">Return to AI Recommendations</a></p>'
        );
    }
    document.title = "Company not found · LewyTrader";
  }

  // Timestamps are injected after app.js ran, so re-apply local formatting.
  function applyLocalTimestamps(scope) {
    if (!scope) {
      return;
    }
    if (window.LewyTrader.formatUtcDateTimes) {
      window.LewyTrader.formatUtcDateTimes(scope);
    }
    if (window.LewyTrader.formatUtcOptionDates) {
      window.LewyTrader.formatUtcOptionDates(scope);
    }
  }

  function initPriceChartPanel(ticker, chartPanel) {
    if (!chartPanel || chartPanel.getAttribute("data-chart-ready") === "true") {
      return;
    }
    if (!window.LewyTrader || !window.LewyTrader.initPriceChart) {
      chartPanel.innerHTML =
        '<p class="muted">Chart controls are unavailable in this build.</p>';
      return;
    }
    chartPanel.setAttribute("data-chart-ready", "pending");
    chartPanel.innerHTML = '<p class="muted">Loading chart…</p>';
    loadShortChart(ticker)
      .then(function (chartData) {
        chartPanel.innerHTML = "";
        window.LewyTrader.initPriceChart(chartPanel, chartData, ticker);
        chartPanel.setAttribute("data-chart-ready", "true");
      })
      .catch(function () {
        chartPanel.setAttribute("data-chart-ready", "error");
        chartPanel.innerHTML =
          '<p class="muted">Unable to load historical price data for charting.</p>';
      });
  }

  function bindPriceChartDisclosure(ticker) {
    var disclosure = document.querySelector(
      "#company-hero-root .company-chart-disclosure"
    );
    if (!disclosure || disclosure.getAttribute("data-bound") === "true") {
      return;
    }
    disclosure.setAttribute("data-bound", "true");
    disclosure.addEventListener("toggle", function () {
      if (!disclosure.open) {
        return;
      }
      initPriceChartPanel(ticker, document.getElementById("price-chart-panel"));
    });
  }

  function bindCompanyRunSelector(report, view) {
    var select = document.getElementById("company-filter-run");
    if (!select) {
      return;
    }
    select.addEventListener("change", function () {
      var root = document.getElementById("company-recommendation-root");
      var hero = document.getElementById("company-hero-root");
      var back = document.getElementById("company-back-link");
      var resolved = resolveRecommendation(report, view.ticker, select.value);
      var selectorHtml = renderRunSelector(
        report,
        resolved.runId,
        resolved.latestRunId
      );
      writeRunParam(resolved.runId, resolved.latestRunId);
      if (hero) {
        hero.outerHTML = renderCompanyHero(view, resolved.recommendation);
        applyLocalTimestamps(document.getElementById("company-hero-root"));
        bindPriceChartDisclosure(view.ticker);
      }
      if (root) {
        root.innerHTML = renderRecommendation(
          resolved.recommendation,
          selectorHtml
        );
        applyLocalTimestamps(root);
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
      showError("No ticker was provided. Open a company from AI Recommendations.");
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
          applyLocalTimestamps(content);
          bindCompanyRunSelector(report, view);
          bindPriceChartDisclosure(view.ticker);
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
