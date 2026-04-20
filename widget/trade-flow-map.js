/*
 * Trade Flow Globe - Bold BI custom widget
 *
 * Renders a spinning 3D globe showing commodity flows from origin to
 * destination countries. Each category (Soft / Hard / FMCG / Industrial /
 * Financial / Tobacco) has its own colour and icon. Built on globe.gl
 * (three.js + three-globe) so it works inside any modern browser.
 *
 * Depends on:
 *   - window.Globe                  (globe.gl)
 *   - window.TradeFlowCentroids     (country-centroids.js)
 *   - window.TradeCategoryRegistry  (commodity-categories.js)
 */
(function (global) {
  "use strict";

  var WIDGET_ID = "trade-flow-globe";

  var GLOBE_IMAGES = {
    night: "https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg",
    day:   "https://unpkg.com/three-globe@2.31.0/example/img/earth-day.jpg",
    topo:  "https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png"
  };
  var BG_IMAGE = "https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png";

  // -------- Helpers --------
  function toKey(v) { return (v == null ? "" : String(v)).trim().toUpperCase(); }

  function lookupCentroid(raw) {
    if (!global.TradeFlowCentroids) return null;
    var key = toKey(raw);
    if (!key) return null;
    var c = global.TradeFlowCentroids;
    return c.iso2[key] || c.iso3[key] || c.name[key] || null;
  }

  function formatUSD(v) {
    if (v == null || isNaN(v)) return "-";
    var a = Math.abs(v);
    if (a >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
    if (a >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
    if (a >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
    return "$" + v.toFixed(0);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function scaleWidth(value, max, minW, maxW) {
    if (!max || max <= 0) return minW;
    var ratio = Math.sqrt(value / max);
    return minW + (maxW - minW) * ratio;
  }

  // -------- Widget --------
  function TradeFlowGlobe() {
    this._globe = null;
    this._container = null;
    this._resizeObserver = null;
  }

  TradeFlowGlobe.prototype.render = function (container, data, settings) {
    this._container = container;
    container.classList.add("trade-flow-globe-container");
    container.innerHTML =
      '<div class="tfg-stage"></div>' +
      '<div class="tfg-legend" style="display:none"></div>';

    var stageEl = container.querySelector(".tfg-stage");

    if (typeof global.Globe === "undefined") {
      stageEl.innerHTML =
        '<div class="tfg-error">globe.gl failed to load. ' +
        'Check that the widget has network access to unpkg.com.</div>';
      return;
    }

    var style = (settings && settings.globeStyle) || "night";
    this._globe = global.Globe()(stageEl)
      .globeImageUrl(GLOBE_IMAGES[style] || GLOBE_IMAGES.night)
      .backgroundImageUrl(style === "day" ? null : BG_IMAGE)
      .backgroundColor(style === "day" ? "#eaf3fb" : "#000010")
      .showAtmosphere(true)
      .atmosphereColor(style === "day" ? "#7fb3d5" : "#4aa3ff")
      .atmosphereAltitude(0.18);

    this._applyControls(settings);
    this._observeResize(stageEl);
    this.update(data, settings);
  };

  TradeFlowGlobe.prototype._applyControls = function (settings) {
    if (!this._globe) return;
    var controls = this._globe.controls();
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate   = settings && settings.autoRotate !== false;
    controls.autoRotateSpeed = Number(settings && settings.rotateSpeed) || 0.4;
    controls.minDistance = 180;
    controls.maxDistance = 600;
  };

  TradeFlowGlobe.prototype._observeResize = function (stageEl) {
    if (typeof ResizeObserver === "undefined") return;
    var self = this;
    this._resizeObserver = new ResizeObserver(function () {
      if (self._globe) {
        self._globe.width(stageEl.clientWidth);
        self._globe.height(stageEl.clientHeight);
      }
    });
    this._resizeObserver.observe(stageEl);
  };

  TradeFlowGlobe.prototype.update = function (data, settings) {
    if (!this._globe) return;
    settings = settings || {};
    this._applyControls(settings);

    var rows = normaliseRows(data);
    var aggregated = aggregate(rows);
    var categoriesInUse = {};
    var maxAmount = 0;

    var arcs = [];
    aggregated.forEach(function (r) {
      var origin = lookupCentroid(r.origin);
      var dest   = lookupCentroid(r.destination);
      if (!origin || !dest) return;
      var cat = global.TradeCategoryRegistry.classify(r.category, r.commodity);
      var def = global.TradeCategoryRegistry.definition(cat);
      categoriesInUse[cat] = true;
      if (r.amount > maxAmount) maxAmount = r.amount;
      arcs.push({
        startLat: origin.lat, startLng: origin.lng,
        endLat:   dest.lat,   endLng:   dest.lng,
        amount: r.amount,
        volume: r.volume,
        volumeKnown: r.volumeKnown,
        commodity: r.commodity,
        category: cat,
        color: def.color,
        origin: r.origin,
        destination: r.destination
      });
    });

    var minArc = Number(settings.minArcWidth) || 0.2;
    var maxArc = Number(settings.maxArcWidth) || 2.5;
    var animate = settings.animateArcs !== false;

    this._globe
      .arcsData(arcs)
      .arcColor(function (a) {
        // globe.gl accepts gradient arrays for a fading effect.
        return [a.color + "cc", a.color + "33"];
      })
      .arcStroke(function (a) { return scaleWidth(a.amount, maxAmount, minArc, maxArc); })
      .arcAltitude(function (a) {
        var gcd = greatCircleDist(a.startLat, a.startLng, a.endLat, a.endLng);
        return Math.min(0.05 + gcd * 0.25, 0.55);
      })
      .arcDashLength(animate ? 0.5 : 1)
      .arcDashGap(animate ? 0.25 : 0)
      .arcDashAnimateTime(animate ? 3500 : 0)
      .arcsTransitionDuration(600)
      .arcLabel(arcTooltip);

    // HTML icon markers at origin countries, one per (country, category) pair.
    var iconPoints = settings.showIcons === false ? [] : buildIconPoints(arcs);
    this._globe
      .htmlElementsData(iconPoints)
      .htmlLat(function (d) { return d.lat; })
      .htmlLng(function (d) { return d.lng; })
      .htmlAltitude(0.01)
      .htmlElement(function (d) {
        var el = document.createElement("div");
        el.className = "tfg-icon tfg-icon-" + slug(d.category);
        el.style.color = d.color;
        el.title = d.country + " - " + d.category;
        el.innerHTML = d.iconHtml;
        return el;
      });

    // Country points - small dots so destinations are visible even when no
    // icon is drawn. Origins are already marked by icons.
    var points = buildCountryPoints(arcs);
    this._globe
      .pointsData(points)
      .pointLat(function (p) { return p.lat; })
      .pointLng(function (p) { return p.lng; })
      .pointAltitude(0)
      .pointRadius(function (p) { return p.role === "destination" ? 0.35 : 0.25; })
      .pointColor(function (p) { return p.role === "destination" ? "#ffffff" : "#bbbbbb"; })
      .pointLabel(function (p) { return "<div class='tfg-point-label'>" + escapeHtml(p.country) + "</div>"; });

    this._renderLegend(Object.keys(categoriesInUse), settings);
  };

  TradeFlowGlobe.prototype._renderLegend = function (categories, settings) {
    var legendEl = this._container.querySelector(".tfg-legend");
    if (!legendEl) return;
    if (settings.showLegend === false || !categories.length) {
      legendEl.style.display = "none";
      legendEl.innerHTML = "";
      return;
    }
    var reg = global.TradeCategoryRegistry;
    categories.sort(function (a, b) {
      return reg.definition(a).order - reg.definition(b).order;
    });
    var html = '<div class="tfg-legend-title">Commodity Categories</div>';
    categories.forEach(function (cat) {
      var def = reg.definition(cat);
      html += '<div class="tfg-legend-item">' +
              '<span class="tfg-legend-icon" style="color:' + def.color + '">' +
                def.icon +
              '</span>' +
              '<span class="tfg-legend-label">' + escapeHtml(cat) + '</span>' +
              '</div>';
    });
    legendEl.innerHTML = html;
    legendEl.style.display = "block";
  };

  TradeFlowGlobe.prototype.onResize = function () {
    if (!this._globe || !this._container) return;
    var stage = this._container.querySelector(".tfg-stage");
    if (!stage) return;
    this._globe.width(stage.clientWidth);
    this._globe.height(stage.clientHeight);
  };

  TradeFlowGlobe.prototype.destroy = function () {
    if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
    if (this._globe && this._globe._destructor) this._globe._destructor();
    this._globe = null;
    if (this._container) {
      this._container.innerHTML = "";
      this._container.classList.remove("trade-flow-globe-container");
    }
  };

  // -------- Data shaping --------
  function normaliseRows(data) {
    if (!data) return [];
    var rows = Array.isArray(data) ? data : (data.values || data.rows || []);
    return rows.map(function (r) {
      var rawVolume = r.Volume != null ? r.Volume : r.volume;
      var volume = null;
      if (rawVolume !== undefined && rawVolume !== null && String(rawVolume).trim() !== "") {
        var n = Number(rawVolume);
        if (!isNaN(n)) volume = n;
      }
      return {
        origin: r.OriginCountry != null ? r.OriginCountry : r["Origin Country"],
        destination: r.DestinationCountry != null ? r.DestinationCountry : r["Destination Country"],
        commodity: r.Commodity != null ? r.Commodity : (r.commodity || ""),
        category: r.Category != null ? r.Category : (r["Commodity Category"] || ""),
        amount: Number(r.FinancedAmount != null ? r.FinancedAmount : r["Financed Amount"]) || 0,
        volume: volume
      };
    }).filter(function (r) { return r.origin && r.destination; });
  }

  function aggregate(rows) {
    var map = {};
    rows.forEach(function (r) {
      var key = toKey(r.origin) + "|" + toKey(r.destination) + "|" + (r.commodity || "") + "|" + (r.category || "");
      if (!map[key]) {
        map[key] = {
          origin: r.origin,
          destination: r.destination,
          commodity: r.commodity || "",
          category: r.category || "",
          amount: 0,
          volume: 0,
          volumeKnown: false
        };
      }
      map[key].amount += r.amount;
      if (r.volume != null && !isNaN(r.volume)) {
        map[key].volume += r.volume;
        map[key].volumeKnown = true;
      }
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  // For each origin country, pick the category with the largest total
  // financed amount and render one icon. Avoids cluttering the globe
  // with overlapping icons when many commodities share an origin.
  function buildIconPoints(arcs) {
    var byCountry = {};
    arcs.forEach(function (a) {
      var key = toKey(a.origin);
      if (!byCountry[key]) {
        byCountry[key] = {
          country: a.origin,
          lat: a.startLat,
          lng: a.startLng,
          catTotals: {}
        };
      }
      byCountry[key].catTotals[a.category] =
        (byCountry[key].catTotals[a.category] || 0) + a.amount;
    });
    return Object.keys(byCountry).map(function (k) {
      var c = byCountry[k];
      var bestCat = null, bestAmt = -1;
      Object.keys(c.catTotals).forEach(function (cat) {
        if (c.catTotals[cat] > bestAmt) { bestAmt = c.catTotals[cat]; bestCat = cat; }
      });
      var def = global.TradeCategoryRegistry.definition(bestCat);
      return {
        country: c.country,
        lat: c.lat,
        lng: c.lng,
        category: bestCat,
        color: def.color,
        iconHtml: def.icon
      };
    });
  }

  function buildCountryPoints(arcs) {
    var seen = {};
    var out = [];
    arcs.forEach(function (a) {
      var oKey = "O-" + toKey(a.origin);
      if (!seen[oKey]) {
        seen[oKey] = true;
        out.push({ country: a.origin, lat: a.startLat, lng: a.startLng, role: "origin" });
      }
      var dKey = "D-" + toKey(a.destination);
      if (!seen[dKey]) {
        seen[dKey] = true;
        out.push({ country: a.destination, lat: a.endLat, lng: a.endLng, role: "destination" });
      }
    });
    return out;
  }

  function arcTooltip(a) {
    var parts = [
      '<div class="tfg-tt">',
      '<div class="tfg-tt-route"><span class="tfg-tt-dot" style="background:' + a.color + '"></span>' +
        escapeHtml(String(a.origin)) + ' &rarr; ' + escapeHtml(String(a.destination)) +
      '</div>',
      '<div class="tfg-tt-cat">' + escapeHtml(a.category) + '</div>'
    ];
    if (a.commodity) {
      parts.push('<div class="tfg-tt-line"><b>Commodity:</b> ' + escapeHtml(a.commodity) + '</div>');
    }
    parts.push('<div class="tfg-tt-line"><b>Financed:</b> ' + formatUSD(a.amount) + '</div>');
    if (a.volumeKnown) {
      parts.push('<div class="tfg-tt-line"><b>Volume:</b> ' + (a.volume || 0).toLocaleString() + '</div>');
    }
    parts.push('</div>');
    return parts.join("");
  }

  function slug(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  function greatCircleDist(lat1, lng1, lat2, lng2) {
    // Returns a normalised 0..1 distance (fraction of half-circumference).
    var toRad = Math.PI / 180;
    var a = Math.sin(((lat2 - lat1) * toRad) / 2);
    var b = Math.sin(((lng2 - lng1) * toRad) / 2);
    var h = a * a + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * b * b;
    return Math.min(1, 2 * Math.asin(Math.min(1, Math.sqrt(h))) / Math.PI);
  }

  // -------- Bold BI registration --------
  var widget = new TradeFlowGlobe();
  var descriptor = {
    id: WIDGET_ID,
    name: "Trade Flow Globe",
    render:  function (ctx) { widget.render(ctx.container, ctx.data, ctx.settings); },
    update:  function (ctx) { widget.update(ctx.data, ctx.settings); },
    resize:  function ()    { widget.onResize(); },
    destroy: function ()    { widget.destroy(); }
  };

  if (global.BoldBI && typeof global.BoldBI.registerCustomWidget === "function") {
    global.BoldBI.registerCustomWidget(descriptor);
  } else if (global.BoldBIDesigner && typeof global.BoldBIDesigner.registerCustomWidget === "function") {
    global.BoldBIDesigner.registerCustomWidget(descriptor);
  }

  global.TradeFlowGlobeWidget = {
    create: function () { return new TradeFlowGlobe(); },
    descriptor: descriptor
  };
})(typeof window !== "undefined" ? window : this);
