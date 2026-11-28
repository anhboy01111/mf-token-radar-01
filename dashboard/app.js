// Titan Token Radar v3.0 — Zero-Network Analytical Dashboard
(function () {
  var DATA = window.RADAR;
  var root = document.getElementById("board-root");
  if (!DATA || !root) return;

  var state = {
    tab: "pre-token", // 'pre-token' | 'watchlist' | 'live'
    search: "",
    category: "all",
    chain: "all",
    sort: "implied", // 'implied' | 'tvl' | 'growth' | 'alpha'
    selectedSlug: null
  };

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "text") node.textContent = attrs[k];
        else if (k === "class") node.className = attrs[k];
        else if (k.slice(0, 2) === "on") node.addEventListener(k.slice(2), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c) node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function fmtUsd(n) {
    if (n == null || isNaN(n)) return "—";
    var abs = Math.abs(n);
    if (abs >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
    return "$" + Math.round(n).toLocaleString();
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    return (n > 0 ? "+" : "") + n.toFixed(1) + "%";
  }

  function isWatchlistRow(row) {
    return (row.tvl_usd || 0) >= (DATA.floor_usd || 50000000);
  }

  function buildFarmPlan(row) {
    var chains = row.chains && row.chains.length ? row.chains : ["Ethereum"];
    var primary = chains[0];
    var isCheap = ["Base", "Arbitrum", "Solana", "Polygon", "Optimism", "Sui", "Blast", "Scroll", "Linea"].indexOf(primary) >= 0;
    var gas = isCheap ? "~$0.20–$0.80 gas on " + primary : "~$8–$18 L1 gas on " + primary;
    var cat = (row.category || "DeFi").toLowerCase();
    var action2 = "Deposit $250–$1,000 into " + row.name + " core vault or pool on " + primary;
    if (cat.indexOf("lend") >= 0) action2 = "Supply stablecoins/ETH and borrow 30–40% LTV on " + row.name + " (" + primary + ")";
    else if (cat.indexOf("dex") >= 0 || cat.indexOf("amm") >= 0) action2 = "Provide concentrated liquidity and execute 3+ swaps on " + row.name + " (" + primary + ")";
    else if (cat.indexOf("deriv") >= 0 || cat.indexOf("perp") >= 0) action2 = "Generate $5,000+ cumulative perp volume with tight stops on " + row.name;

    return [
      "Bridge $250–$1,000 USDC/ETH to " + primary + " via official or Stargate bridge. Cost: " + gas + " | Time: 5 mins",
      action2 + ". Cost: " + gas + " + capital lock | Time: 10 mins",
      "Maintain active position for 30+ days and compound/rebalance weekly for points multiplier. Cost: ~$1/week | Time: 5 mins/wk",
      "Track snapshot & governance announcements for " + row.name + " across " + chains.slice(0, 3).join(", ") + ". Cost: $0 | Time: 2 mins/wk"
    ];
  }

  function computeAlpha(row) {
    var tvlScore = Math.min(35, Math.max(0, (Math.log10(Math.max(row.tvl_usd || 1, 1)) - 6.3) * 14));
    var g = row.change_7d || 0;
    var growthScore = Math.min(25, Math.max(0, 10 + g * 0.35));
    var chainScore = Math.min(15, (row.chains ? row.chains.length : 1) * 4);
    var wlBonus = isWatchlistRow(row) ? 15 : 6;
    var ageBonus = row.age_days && row.age_days > 365 ? 10 : 6;
    return Math.round(Math.min(99, Math.max(12, tvlScore + growthScore + chainScore + wlBonus + ageBonus)));
  }

  function computeCI(row) {
    var vol = Math.min(0.32, Math.abs(row.change_7d || 0) / 120);
    var size = row.tvl_usd > 300e6 ? 0.08 : row.tvl_usd > 50e6 ? 0.14 : 0.22;
    var margin = ((vol + size) / 2) * 1.645;
    return {
      low: Math.max(0, Math.round(row.implied_value_usd * (1 - margin))),
      high: Math.round(row.implied_value_usd * (1 + margin)),
      pct: Math.round(margin * 100)
    };
  }

  function readHash() {
    var h = (window.location.hash || "").replace(/^#/, "");
    if (!h) return;
    h.split("&").forEach(function (part) {
      var kv = part.split("=");
      if (kv.length !== 2) return;
      var k = decodeURIComponent(kv[0]);
      var v = decodeURIComponent(kv[1]);
      if (k === "tab") state.tab = v;
      if (k === "category") state.category = v;
      if (k === "chain") state.chain = v;
      if (k === "sort") state.sort = v;
      if (k === "detail") state.selectedSlug = v;
    });
  }

  function buildTopBar() {
    return el("header", { class: "topbar" }, [
      el("div", null, [
        el("div", { class: "brand-row" }, [
          el("div", { class: "brand-mark", text: "T" }),
          el("h1", { text: "Titan Token Launch Radar" })
        ]),
        el("p", {
          class: "subtitle",
          text: "Pre-token DeFi valuation model (" + DATA.model_version + ") — ranked by implied FDV with actionable farm plans"
        })
      ]),
      el("div", { class: "meta-pills" }, [
        el("span", { class: "meta-pill" }, ["Snapshot: ", el("strong", { text: DATA.as_of })]),
        el("span", { class: "meta-pill" }, ["Board: ", el("strong", { text: String(DATA.board_size || (DATA.rows ? DATA.rows.length : 0)) })]),
        el("span", { class: "meta-pill" }, ["Watchlist: ", el("strong", { text: String(DATA.watchlist_size || 0) + " / " + String(DATA.watchlist_size || 0) })])
      ])
    ]);
  }

  function buildKpiGrid() {
    var board = DATA.rows || [];
    var totalImplied = board.reduce(function (s, r) { return s + (r.implied_value_usd || 0); }, 0);
    var totalTvl = board.reduce(function (s, r) { return s + (r.tvl_usd || 0); }, 0);
    var topRow = board[0] || { name: "—", implied_value_usd: 0 };
    var fastGrowers = board.filter(function (r) { return (r.change_7d || 0) >= 10; }).length;

    var cards = [
      { lbl: "Ranked Pre-Token", val: String(board.length), sub: (DATA.watchlist_size || 0) + " watchlist floor" },
      { lbl: "Total Pre-Token TVL", val: fmtUsd(totalTvl), sub: "Across tracked protocols" },
      { lbl: "Aggregate Implied FDV", val: fmtUsd(totalImplied), sub: "Mean: " + fmtUsd(totalImplied / Math.max(board.length, 1)) },
      { lbl: "Top Ranked Target", val: topRow.name, sub: "Implied: " + fmtUsd(topRow.implied_value_usd) },
      { lbl: "High Momentum (≥10% 7d)", val: String(fastGrowers), sub: "Active TVL inflows" }
    ];

    return el("section", { class: "kpi-grid" }, cards.map(function (c) {
      return el("div", { class: "kpi-card" }, [
        el("div", { class: "kpi-lbl", text: c.lbl }),
        el("div", { class: "kpi-val", text: c.val }),
        el("div", { class: "kpi-sub", text: c.sub })
      ]);
    }));
  }

  function buildChartsRow() {
    var board = DATA.rows || [];
    var top8 = board.slice(0, 8);
    var maxVal = Math.max.apply(null, top8.map(function (r) { return r.implied_value_usd || 1; }).concat([1]));

    // Inline SVG Horizontal Bar Chart (Top 8 Implied Value)
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 640 208");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "208");

    top8.forEach(function (r, i) {
      var y = 10 + i * 24;
      var barW = Math.max(8, Math.round((r.implied_value_usd / maxVal) * 370));

      var label = document.createElementNS(svgNS, "text");
      label.setAttribute("x", "0");
      label.setAttribute("y", String(y + 13));
      label.setAttribute("fill", "#cbd5e1");
      label.setAttribute("font-size", "11");
      label.textContent = "#" + r.rank + " " + r.name.slice(0, 20);
      svg.appendChild(label);

      var bgRect = document.createElementNS(svgNS, "rect");
      bgRect.setAttribute("x", "165");
      bgRect.setAttribute("y", String(y + 3));
      bgRect.setAttribute("width", "370");
      bgRect.setAttribute("height", "12");
      bgRect.setAttribute("rx", "4");
      bgRect.setAttribute("fill", "#141e30");
      svg.appendChild(bgRect);

      var rect = document.createElementNS(svgNS, "rect");
      rect.setAttribute("x", "165");
      rect.setAttribute("y", String(y + 3));
      rect.setAttribute("width", String(barW));
      rect.setAttribute("height", "12");
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", i === 0 ? "#38bdf8" : "#10b981");
      svg.appendChild(rect);

      var valTxt = document.createElementNS(svgNS, "text");
      valTxt.setAttribute("x", "545");
      valTxt.setAttribute("y", String(y + 13));
      valTxt.setAttribute("fill", "#10b981");
      valTxt.setAttribute("font-size", "11");
      valTxt.setAttribute("font-family", "monospace");
      valTxt.textContent = fmtUsd(r.implied_value_usd);
      svg.appendChild(valTxt);
    });

    // Sector Breakdown
    var sectorTotals = {};
    board.forEach(function (r) {
      var cat = r.category || "Other";
      sectorTotals[cat] = (sectorTotals[cat] || 0) + (r.implied_value_usd || 0);
    });
    var sectors = Object.keys(sectorTotals).map(function (k) {
      return { name: k, val: sectorTotals[k] };
    }).sort(function (a, b) { return b.val - a.val; }).slice(0, 6);
    var maxSec = sectors.length ? sectors[0].val : 1;

    var sectorList = el("div", { class: "sector-bars" }, sectors.map(function (s) {
      var pct = Math.round((s.val / maxSec) * 100);
      return el("div", {
        class: "sector-row",
        onclick: function () {
          state.category = (state.category === s.name) ? "all" : s.name;
          render();
        }
      }, [
        el("span", { class: "sector-name", text: s.name }),
        el("div", { class: "sector-track" }, [
          el("div", { class: "sector-fill", style: "width:" + pct + "%" })
        ]),
        el("span", { class: "sector-val", text: fmtUsd(s.val) })
      ]);
    }));

    return el("section", { class: "charts-grid" }, [
      el("div", { class: "panel" }, [
        el("div", { class: "panel-head" }, [
          el("span", { class: "panel-title", text: "Top 8 Pre-Token Protocols by Implied FDV" }),
          el("span", { class: "panel-note", text: "Model: " + DATA.model_version })
        ]),
        svg
      ]),
      el("div", { class: "panel" }, [
        el("div", { class: "panel-head" }, [
          el("span", { class: "panel-title", text: "Sector Concentration (Click to Filter)" }),
          el("span", { class: "panel-note", text: state.category === "all" ? "All sectors" : "Filtered: " + state.category })
        ]),
        sectorList
      ])
    ]);
  }

  function buildControls() {
    var board = DATA.rows || [];
    var cats = Array.from(new Set(board.map(function (r) { return r.category || "Other"; }))).sort();
    var chains = Array.from(new Set(board.reduce(function (arr, r) { return arr.concat(r.chains || []); }, []))).sort();

    var catSel = el("select", {
      class: "sel",
      "aria-label": "Filter by category",
      onchange: function (e) { state.category = e.target.value; render(); }
    }, [el("option", { value: "all", text: "All Categories (" + cats.length + ")" })].concat(
      cats.map(function (c) {
        var opt = el("option", { value: c, text: c });
        if (state.category === c) opt.selected = true;
        return opt;
      })
    ));

    var chainSel = el("select", {
      class: "sel",
      "aria-label": "Filter by chain",
      onchange: function (e) { state.chain = e.target.value; render(); }
    }, [el("option", { value: "all", text: "All Chains (" + chains.length + ")" })].concat(
      chains.map(function (ch) {
        var opt = el("option", { value: ch, text: ch });
        if (state.chain === ch) opt.selected = true;
        return opt;
      })
    ));

    var searchInp = el("input", {
      class: "inp",
      type: "search",
      placeholder: "Search protocol, chain, category...",
      value: state.search,
      oninput: function (e) { state.search = e.target.value; renderTableOnly(); }
    });

    return el("section", { class: "controls" }, [
      el("div", { class: "tabs" }, [
        el("button", {
          class: "tab-btn" + (state.tab === "pre-token" ? " active" : ""),
          text: "Pre-Token Board (" + board.length + ")",
          onclick: function () { state.tab = "pre-token"; render(); }
        }),
        el("button", {
          class: "tab-btn" + (state.tab === "watchlist" ? " active" : ""),
          text: "Watchlist Floor (" + (DATA.watchlist_size || 0) + ")",
          onclick: function () { state.tab = "watchlist"; render(); }
        }),
        el("button", {
          class: "tab-btn" + (state.tab === "live" ? " active" : ""),
          text: "Live Comparables (" + (DATA.live ? DATA.live.length : 0) + ")",
          onclick: function () { state.tab = "live"; render(); }
        })
      ]),
      el("div", { class: "filters" }, [
        searchInp,
        catSel,
        chainSel,
        el("button", {
          class: "sort-btn" + (state.sort === "implied" ? " active" : ""),
          text: "Implied ↓",
          onclick: function () { state.sort = "implied"; render(); }
        }),
        el("button", {
          class: "sort-btn" + (state.sort === "alpha" ? " active" : ""),
          text: "Alpha ↓",
          onclick: function () { state.sort = "alpha"; render(); }
        }),
        el("button", {
          class: "sort-btn" + (state.sort === "growth" ? " active" : ""),
          text: "7d Growth ↓",
          onclick: function () { state.sort = "growth"; render(); }
        })
      ])
    ]);
  }

  function getFilteredRows() {
    var base = state.tab === "live" ? (DATA.live || []) : (DATA.rows || []);
    var q = state.search.trim().toLowerCase();

    var rows = base.filter(function (r) {
      if (state.tab === "watchlist" && !isWatchlistRow(r)) return false;
      if (state.category !== "all" && (r.category || "Other") !== state.category) return false;
      if (state.chain !== "all" && (r.chains || []).indexOf(state.chain) === -1) return false;
      if (q) {
        var hay = (r.name + " " + r.slug + " " + (r.category || "") + " " + (r.chains || []).join(" ")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    if (state.tab !== "live") {
      rows = rows.slice().sort(function (a, b) {
        if (state.sort === "alpha") return computeAlpha(b) - computeAlpha(a);
        if (state.sort === "growth") return (b.change_7d || -999) - (a.change_7d || -999);
        if (state.sort === "tvl") return (b.tvl_usd || 0) - (a.tvl_usd || 0);
        return (b.implied_value_usd || 0) - (a.implied_value_usd || 0);
      });
    }
    return rows;
  }

  function buildTable() {
    var rows = getFilteredRows();
    var isLive = state.tab === "live";

    var head = el("thead", null, el("tr", null, isLive ? [
      el("th", { text: "Protocol" }),
      el("th", { text: "Token" }),
      el("th", { text: "Category" }),
      el("th", { class: "num", text: "TVL" }),
      el("th", { class: "num", text: "Market Cap" }),
      el("th", { class: "num", text: "MCap / TVL" })
    ] : [
      el("th", { text: "Rank" }),
      el("th", { text: "Protocol" }),
      el("th", { text: "Category & Chains" }),
      el("th", { class: "num", text: "TVL" }),
      el("th", { class: "num", text: "7d Growth" }),
      el("th", { class: "num", text: "Alpha" }),
      el("th", { class: "num", text: "Implied Value (90% CI)" }),
      el("th", { class: "num", text: "Farm Plan" })
    ]));

    var body = el("tbody", { id: "table-body" }, rows.slice(0, 60).map(function (r) {
      if (isLive) {
        var ratio = r.tvl_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + "x" : "—";
        return el("tr", null, [
          el("td", null, el("span", { class: "proto-name", text: r.name })),
          el("td", null, el("span", { class: "chip", text: r.symbol || "—" })),
          el("td", null, el("span", { class: "chip", text: r.category || "Other" })),
          el("td", { class: "num", text: fmtUsd(r.tvl_usd) }),
          el("td", { class: "num", text: fmtUsd(r.mcap_usd) }),
          el("td", { class: "num pos", text: ratio })
        ]);
      }

      var alpha = computeAlpha(r);
      var ci = computeCI(r);
      var steps = (r.farm_steps && r.farm_steps.length) ? r.farm_steps : buildFarmPlan(r);
      var gCls = (r.change_7d || 0) >= 0 ? "num pos" : "num neg";
      var chainsTxt = (r.chains || []).slice(0, 3).join(", ") + ((r.chains || []).length > 3 ? " +" + ((r.chains || []).length - 3) : "");

      return el("tr", {
        class: "data-row",
        onclick: function () { openDetail(r); }
      }, [
        el("td", { class: "num", text: "#" + r.rank }),
        el("td", null, [
          el("div", { class: "proto-name" }, [
            document.createTextNode(r.name),
            isWatchlistRow(r) ? el("span", { class: "badge-wl", text: "WATCHLIST" }) : null
          ]),
          el("div", { class: "proto-meta", text: (r.age_days ? r.age_days + "d no token" : "Age unknown") })
        ]),
        el("td", null, [
          el("span", { class: "chip", text: r.category || "Other" }),
          el("div", { class: "proto-meta", text: chainsTxt || "Multi-chain" })
        ]),
        el("td", { class: "num", text: fmtUsd(r.tvl_usd) }),
        el("td", { class: gCls, text: fmtPct(r.change_7d) }),
        el("td", { class: "num" }, [
          el("div", { class: "alpha-wrap" }, [
            el("div", { class: "alpha-bar" }, el("div", { class: "alpha-fill", style: "width:" + alpha + "%" })),
            el("span", { text: String(alpha) })
          ])
        ]),
        el("td", { class: "num" }, [
          el("strong", { class: "pos", text: fmtUsd(r.implied_value_usd) }),
          el("span", { class: "ci-sub", text: fmtUsd(ci.low) + " – " + fmtUsd(ci.high) })
        ]),
        el("td", { class: "num" }, [
          el("button", {
            class: "btn-plan",
            text: steps.length + " steps →",
            onclick: function (e) { e.stopPropagation(); openDetail(r); }
          })
        ])
      ]);
    }));

    return el("div", { class: "table-wrap", id: "table-container" }, el("table", null, [head, body]));
  }

  var dialog = el("dialog", { class: "detail-modal" });
  function openDetail(row) {
    dialog.textContent = "";
    var ci = computeCI(row);
    var alpha = computeAlpha(row);

    dialog.appendChild(el("div", { class: "modal-head" }, [
      el("div", null, [
        el("span", { class: "badge-wl", text: "RANK #" + row.rank + " · ALPHA " + alpha + "/100" }),
        el("h2", { text: row.name }),
        el("p", { class: "subtitle", text: (row.category || "Other") + " on " + ((row.chains || []).join(", ") || "Multi-chain") })
      ]),
      el("button", { class: "btn-close", text: "Close", onclick: function () { dialog.close(); } })
    ]));

    dialog.appendChild(el("div", { class: "eq-grid" }, [
      el("div", { class: "eq-box" }, [el("span", { text: "TVL" }), el("b", { text: fmtUsd(row.tvl_usd) })]),
      el("div", { class: "eq-box" }, [el("span", { text: "7d TVL Growth" }), el("b", { text: fmtPct(row.change_7d) })]),
      el("div", { class: "eq-box" }, [el("span", { text: "Age (No Token)" }), el("b", { text: (row.age_days || "?") + " days" })]),
      el("div", { class: "eq-box" }, [el("span", { text: "Growth Multiplier" }), el("b", { text: String(row.growth_multiplier) + "x" })]),
      el("div", { class: "eq-box" }, [el("span", { text: "Maturity Multiplier" }), el("b", { text: String(row.maturity_multiplier) + "x" })]),
      el("div", { class: "eq-box" }, [el("span", { text: "Implied FDV (90% CI)" }), el("b", { class: "pos", text: fmtUsd(row.implied_value_usd) + " (±" + ci.pct + "%)" })])
    ]));

    var steps = (row.farm_steps && row.farm_steps.length) ? row.farm_steps : buildFarmPlan(row);
    dialog.appendChild(el("h3", { text: "Actionable Farm Plan (" + steps.length + " steps)" }));
    dialog.appendChild(el("ol", { class: "steps-list" }, steps.map(function (s) {
      var idx = s.indexOf(" Cost: ");
      var action = idx >= 0 ? s.slice(0, idx) : s;
      var tail = idx >= 0 ? s.slice(idx + 1) : "";
      return el("li", null, [
        el("strong", { text: action }),
        tail ? el("span", { class: "step-cost", text: tail }) : null
      ]);
    })));

    if (!dialog.isConnected) root.appendChild(dialog);
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
  }

  function renderTableOnly() {
    var old = document.getElementById("table-container");
    if (old && old.parentNode) {
      old.parentNode.replaceChild(buildTable(), old);
    }
  }

  function render() {
    root.textContent = "";
    var shell = el("div", { class: "shell" }, [
      buildTopBar(),
      buildKpiGrid(),
      buildChartsRow(),
      buildControls(),
      buildTable()
    ]);
    root.appendChild(shell);
    root.setAttribute("aria-busy", "false");

    if (state.selectedSlug) {
      var match = (DATA.rows || []).find(function (r) { return r.slug === state.selectedSlug; });
      if (match) openDetail(match);
      state.selectedSlug = null;
    }
  }

  readHash();
  render();
})();
