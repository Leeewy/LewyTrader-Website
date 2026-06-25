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

  function renderCompany(view) {
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
      '<p class="eyebrow"><a href="index.html">Watchlist Opportunities</a></p>' +
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
      section("Watchlist opportunity score", renderOpportunity(view.opportunity, view.is_active)) +
      section("Investment thesis", proseBlock(view.thesis, "No investment thesis recorded.")) +
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
            '</p><p><a href="index.html">Return to Watchlist Opportunities</a></p>'
        );
    }
    document.title = "Company not found · LewyTrader";
  }

  function initCompanyPage() {
    var root = document.getElementById("company-app");
    if (!root) {
      return;
    }

    var ticker = readTicker();
    if (!ticker) {
      showError("No ticker was provided. Open a company from Watchlist Opportunities.");
      return;
    }

    loadReport()
      .then(function (report) {
        var view = report.companies && report.companies[ticker];
        if (!view) {
          showError("'" + ticker + "' was not found in the current watchlist report.");
          return;
        }

        document.title = view.ticker + " · " + view.name + " · LewyTrader";
        var loading = document.getElementById("company-loading");
        var content = document.getElementById("company-content");
        if (loading) {
          loading.classList.add("hidden");
        }
        if (content) {
          content.classList.remove("hidden");
          content.innerHTML = renderCompany(view);
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
