(function () {
  "use strict";

  window.LewyTrader = window.LewyTrader || {};

  var RANGE_OPTIONS = [
    { id: "3M", days: 90 },
    { id: "6M", days: 180 },
    { id: "1Y", days: 365 },
    { id: "3Y", days: 1095 },
    { id: "5Y", days: 1825 },
    { id: "MAX", days: null },
  ];

  var DEFAULT_RANGE = "1Y";

  function parseDate(dateString) {
    return new Date(dateString + "T00:00:00").getTime();
  }

  function toSeries(dates, values) {
    var points = [];
    for (var index = 0; index < dates.length; index += 1) {
      var value = values[index];
      if (value !== null && value !== undefined) {
        points.push({ x: parseDate(dates[index]), y: value });
      }
    }
    return points;
  }

  function rangeBounds(chartData, days) {
    var dates = chartData.dates;
    if (!dates.length) {
      return { min: undefined, max: undefined };
    }

    var max = parseDate(dates[dates.length - 1]);
    if (days === null) {
      return { min: parseDate(dates[0]), max: max };
    }

    var minDate = new Date(max);
    minDate.setDate(minDate.getDate() - days);
    var min = Math.max(parseDate(dates[0]), minDate.getTime());
    return { min: min, max: max };
  }

  function buildSeries(chartData) {
    return [
      {
        name: "Adjusted Close",
        data: toSeries(chartData.dates, chartData.adjusted_close),
      },
      {
        name: "SMA50",
        data: toSeries(chartData.dates, chartData.sma50),
      },
      {
        name: "SMA200",
        data: toSeries(chartData.dates, chartData.sma200),
      },
    ];
  }

  function buildToolbar() {
    return (
      '<div class="chart-range-toolbar" role="toolbar" aria-label="Chart time range">' +
      RANGE_OPTIONS.map(function (option) {
        var activeClass = option.id === DEFAULT_RANGE ? " active" : "";
        return (
          '<button type="button" class="chart-range-btn' +
          activeClass +
          '" data-range="' +
          option.id +
          '">' +
          option.id +
          "</button>"
        );
      }).join("") +
      "</div>"
    );
  }

  function chartUrl(ticker, variant) {
    return "data/charts/" + encodeURIComponent(ticker) + "-" + variant + ".json";
  }

  function loadFullChart(ticker) {
    return fetch(chartUrl(ticker, "full")).then(function (response) {
      if (!response.ok) {
        throw new Error("Failed to load full chart data.");
      }
      return response.json();
    });
  }

  function setChartLoading(container, show, message) {
    var loading = container.querySelector(".chart-loading");
    if (show) {
      if (!loading) {
        loading = document.createElement("div");
        loading.className = "chart-loading";
        loading.setAttribute("role", "status");
        container.appendChild(loading);
      }
      loading.textContent = message || "Loading full history…";
      loading.classList.remove("hidden");
      return;
    }
    if (loading) {
      loading.classList.add("hidden");
    }
  }

  function readChartTheme() {
    var styles = getComputedStyle(document.documentElement);
    var isDark = document.documentElement.getAttribute("data-theme") === "dark";
    return {
      colors: [
        styles.getPropertyValue("--chart-color-primary").trim() || "#0f4c81",
        styles.getPropertyValue("--chart-color-secondary").trim() || "#b26a00",
        styles.getPropertyValue("--chart-color-tertiary").trim() || "#6b4c9a",
      ],
      gridColor: styles.getPropertyValue("--border").trim() || "#d8dee6",
      foreColor: styles.getPropertyValue("--text").trim() || "#1b2430",
      tooltipTheme: isDark ? "dark" : "light",
    };
  }

  function chartThemeOptions(theme) {
    return {
      colors: theme.colors,
      chart: { foreColor: theme.foreColor },
      grid: { borderColor: theme.gridColor },
      tooltip: { theme: theme.tooltipTheme },
      xaxis: {
        crosshairs: {
          stroke: { color: theme.gridColor },
        },
      },
    };
  }

  function initPriceChart(container, chartData, ticker) {
    if (!container || !chartData || !chartData.dates || !chartData.dates.length) {
      return null;
    }

    if (typeof ApexCharts === "undefined") {
      container.innerHTML = '<p class="muted">Chart library failed to load.</p>';
      return null;
    }

    container.innerHTML =
      buildToolbar() + '<div id="price-chart" class="price-chart-host"></div>';

    var chartHost = container.querySelector("#price-chart");
    var toolbar = container.querySelector(".chart-range-toolbar");
    var initialRange = rangeBounds(chartData, 365);
    var activeChartData = chartData;
    var fullChartData = null;
    var fullChartPromise = null;

    var chartTheme = readChartTheme();
    var chart = new ApexCharts(chartHost, {
      chart: {
        type: "line",
        height: 440,
        width: "100%",
        animations: { enabled: false },
        zoom: { enabled: true, type: "x", autoScaleYaxis: true, allowMouseWheelZoom: false },
        toolbar: {
          show: true,
          tools: {
            download: false,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true,
          },
        },
        fontFamily: "Segoe UI, system-ui, sans-serif",
        foreColor: chartTheme.foreColor,
      },
      colors: chartTheme.colors,
      stroke: { width: [2.5, 1.8, 1.8], curve: "smooth" },
      series: buildSeries(chartData),
      xaxis: {
        type: "datetime",
        min: initialRange.min,
        max: initialRange.max,
        labels: { datetimeUTC: false },
        crosshairs: {
          stroke: { color: chartTheme.gridColor },
        },
      },
      yaxis: {
        labels: {
          formatter: function (value) {
            return value == null ? "" : value.toFixed(2);
          },
        },
      },
      tooltip: {
        theme: chartTheme.tooltipTheme,
        shared: true,
        intersect: false,
        x: { format: "dd MMM yyyy" },
        y: {
          formatter: function (value) {
            return value == null ? "—" : value.toFixed(2);
          },
        },
      },
      legend: {
        show: true,
        position: "top",
        horizontalAlign: "left",
      },
      grid: {
        borderColor: chartTheme.gridColor,
        strokeDashArray: 4,
      },
      markers: {
        size: 0,
        hover: { size: 4 },
      },
    });

    chart.render();

    document.addEventListener("lewytrader-theme-change", function () {
      chart.updateOptions(chartThemeOptions(readChartTheme()));
    });

    function setActiveButton(rangeId) {
      if (!toolbar) {
        return;
      }
      toolbar.querySelectorAll("[data-range]").forEach(function (button) {
        button.classList.toggle("active", button.getAttribute("data-range") === rangeId);
      });
    }

    function applyRangeToChart(rangeId, data) {
      var option = RANGE_OPTIONS.find(function (entry) {
        return entry.id === rangeId;
      });
      if (!option) {
        return;
      }
      var bounds = rangeBounds(data, option.days);
      chart.updateOptions({
        series: buildSeries(data),
        xaxis: { min: bounds.min, max: bounds.max },
      });
      setActiveButton(rangeId);
    }

    function applyRange(rangeId) {
      if (rangeId === "MAX" && ticker && !fullChartData) {
        if (!fullChartPromise) {
          setChartLoading(container, true);
          fullChartPromise = loadFullChart(ticker)
            .then(function (fullData) {
              fullChartData = fullData;
              activeChartData = fullData;
              applyRangeToChart("MAX", fullData);
            })
            .catch(function () {
              setChartLoading(container, true, "Unable to load full history.");
            })
            .finally(function () {
              setChartLoading(container, false);
            });
        }
        return;
      }

      var data = fullChartData || activeChartData;
      applyRangeToChart(rangeId, data);
    }

    if (toolbar) {
      toolbar.addEventListener("click", function (event) {
        var button = event.target.closest("[data-range]");
        if (!button) {
          return;
        }
        applyRange(button.getAttribute("data-range"));
      });
    }

    return chart;
  }

  window.LewyTrader.initPriceChart = initPriceChart;
})();
