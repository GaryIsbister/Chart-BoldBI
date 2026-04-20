/*
 * Commodity category registry for the Trade Flow Globe widget.
 *
 * Defines the six categories used by the trade-finance fund, with their
 * fixed colours, inline-SVG icons, and a lookup of which specific
 * commodities belong to each category. If the source dataset provides a
 * Category column we trust that value; if it only provides Commodity we
 * classify via the commodityToCategory map below.
 */
(function (global) {
  "use strict";

  // The six fund categories, in the order the user specified.
  // Colour choices:
  //   Soft Commodities        green       - agricultural / grown
  //   Hard Commodities        slate       - mined / extracted
  //   FMCG                    pink        - consumer-facing
  //   Industrial Products     orange      - machinery / inputs
  //   Financial Instruments   indigo      - paper / intangible
  //   Tobacco                 brown       - its own bucket per user request
  var CATEGORIES = {
    "Soft Commodities": {
      color: "#6FAE4A",
      icon: wheatIcon(),
      order: 1
    },
    "Hard Commodities": {
      color: "#546E7A",
      icon: pickIcon(),
      order: 2
    },
    "FMCG": {
      color: "#E91E63",
      icon: cartIcon(),
      order: 3
    },
    "Industrial Products": {
      color: "#E3672B",
      icon: gearIcon(),
      order: 4
    },
    "Financial Instruments": {
      color: "#5D3FD3",
      icon: chartIcon(),
      order: 5
    },
    "Tobacco": {
      color: "#795548",
      icon: leafIcon(),
      order: 6
    }
  };

  // Specific commodity -> category. Keys are UPPERCASED for matching.
  var COMMODITY_TO_CATEGORY = {
    // Soft Commodities ------------------------------------------------
    "COCOA": "Soft Commodities",
    "COFFEE": "Soft Commodities",
    "SUGAR": "Soft Commodities",
    "COTTON": "Soft Commodities",
    "WHEAT": "Soft Commodities",
    "CORN": "Soft Commodities",
    "MAIZE": "Soft Commodities",
    "SOYBEANS": "Soft Commodities",
    "SOYBEAN": "Soft Commodities",
    "SOY": "Soft Commodities",
    "RICE": "Soft Commodities",
    "PALM OIL": "Soft Commodities",
    "VEGETABLE OIL": "Soft Commodities",
    "RUBBER": "Soft Commodities",
    "CUT FLOWERS": "Soft Commodities",
    "FLOWERS": "Soft Commodities",
    "HAZELNUTS": "Soft Commodities",
    "NUTS": "Soft Commodities",
    "ORANGE JUICE": "Soft Commodities",
    "BARLEY": "Soft Commodities",
    "OATS": "Soft Commodities",
    "TEA": "Soft Commodities",
    "SPICES": "Soft Commodities",

    // Hard Commodities ------------------------------------------------
    "CRUDE OIL": "Hard Commodities",
    "OIL": "Hard Commodities",
    "BRENT": "Hard Commodities",
    "WTI": "Hard Commodities",
    "LNG": "Hard Commodities",
    "NATURAL GAS": "Hard Commodities",
    "GAS": "Hard Commodities",
    "COAL": "Hard Commodities",
    "URANIUM": "Hard Commodities",
    "GOLD": "Hard Commodities",
    "SILVER": "Hard Commodities",
    "PLATINUM": "Hard Commodities",
    "PALLADIUM": "Hard Commodities",
    "COPPER": "Hard Commodities",
    "ALUMINUM": "Hard Commodities",
    "ALUMINIUM": "Hard Commodities",
    "ZINC": "Hard Commodities",
    "NICKEL": "Hard Commodities",
    "IRON ORE": "Hard Commodities",
    "IRON": "Hard Commodities",
    "COBALT": "Hard Commodities",
    "LITHIUM": "Hard Commodities",
    "TIN": "Hard Commodities",
    "LEAD": "Hard Commodities",
    "RARE EARTHS": "Hard Commodities",

    // FMCG ------------------------------------------------------------
    "WINE": "FMCG",
    "SPIRITS": "FMCG",
    "BEER": "FMCG",
    "BOTTLED WATER": "FMCG",
    "SOFT DRINKS": "FMCG",
    "BEVERAGES": "FMCG",
    "CHOCOLATE": "FMCG",
    "CONFECTIONERY": "FMCG",
    "DAIRY": "FMCG",
    "CHEESE": "FMCG",
    "MILK POWDER": "FMCG",
    "MEAT": "FMCG",
    "POULTRY": "FMCG",
    "FISH": "FMCG",
    "SEAFOOD": "FMCG",
    "PACKAGED FOOD": "FMCG",
    "PERSONAL CARE": "FMCG",
    "COSMETICS": "FMCG",
    "CLEANING PRODUCTS": "FMCG",
    "HOUSEHOLD": "FMCG",
    "TEXTILES": "FMCG",
    "APPAREL": "FMCG",
    "FOOTWEAR": "FMCG",

    // Industrial Products --------------------------------------------
    "MACHINERY": "Industrial Products",
    "EQUIPMENT": "Industrial Products",
    "CHEMICALS": "Industrial Products",
    "PETROCHEMICALS": "Industrial Products",
    "FERTILIZER": "Industrial Products",
    "FERTILISER": "Industrial Products",
    "UREA": "Industrial Products",
    "POTASH": "Industrial Products",
    "STEEL": "Industrial Products",
    "REBAR": "Industrial Products",
    "CEMENT": "Industrial Products",
    "PLASTICS": "Industrial Products",
    "POLYMERS": "Industrial Products",
    "GLASS": "Industrial Products",
    "PAPER": "Industrial Products",
    "PULP": "Industrial Products",
    "LUMBER": "Industrial Products",
    "TIMBER": "Industrial Products",
    "AUTO PARTS": "Industrial Products",
    "ELECTRONICS": "Industrial Products",

    // Financial Instruments ------------------------------------------
    "BONDS": "Financial Instruments",
    "EQUITIES": "Financial Instruments",
    "EQUITY": "Financial Instruments",
    "LETTERS OF CREDIT": "Financial Instruments",
    "LC": "Financial Instruments",
    "RECEIVABLES": "Financial Instruments",
    "FACTORING": "Financial Instruments",
    "FORFAITING": "Financial Instruments",
    "FX": "Financial Instruments",
    "DERIVATIVES": "Financial Instruments",
    "SWAPS": "Financial Instruments",
    "REPO": "Financial Instruments",
    "NOTES": "Financial Instruments",

    // Tobacco --------------------------------------------------------
    "TOBACCO": "Tobacco",
    "LEAF TOBACCO": "Tobacco",
    "CIGARS": "Tobacco",
    "CIGARETTES": "Tobacco",
    "BURLEY": "Tobacco",
    "VIRGINIA TOBACCO": "Tobacco"
  };

  function classify(category, commodity) {
    var cat = (category || "").trim();
    if (cat && CATEGORIES[cat]) return cat;
    // Case-insensitive match for category value even if casing is off.
    if (cat) {
      var upper = cat.toUpperCase();
      var keys = Object.keys(CATEGORIES);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].toUpperCase() === upper) return keys[i];
      }
    }
    // Fall back to commodity lookup.
    if (commodity) {
      var c = String(commodity).trim().toUpperCase();
      if (COMMODITY_TO_CATEGORY[c]) return COMMODITY_TO_CATEGORY[c];
      // Loose match: any known commodity substring.
      var names = Object.keys(COMMODITY_TO_CATEGORY);
      for (var j = 0; j < names.length; j++) {
        if (c.indexOf(names[j]) !== -1) return COMMODITY_TO_CATEGORY[names[j]];
      }
    }
    return "Other";
  }

  function definition(category) {
    return CATEGORIES[category] || {
      color: "#9E9E9E",
      icon: dotIcon(),
      order: 99
    };
  }

  // -------- Inline SVG icons (24x24, fill="currentColor") --------
  function svg(path) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">' +
           path + '</svg>';
  }

  function wheatIcon() {
    return svg(
      '<path d="M12 2c-.8 1.2-1.2 2.6-1.2 4 0 1.4.4 2.8 1.2 4 .8-1.2 1.2-2.6 1.2-4 0-1.4-.4-2.8-1.2-4z"/>' +
      '<path d="M6 6c-.4 1.2-.4 2.6 0 3.8.4 1.2 1.2 2.2 2.2 2.8.4-1.2.4-2.6 0-3.8C7.8 7.6 7 6.6 6 6z"/>' +
      '<path d="M18 6c.4 1.2.4 2.6 0 3.8-.4 1.2-1.2 2.2-2.2 2.8-.4-1.2-.4-2.6 0-3.8.4-1.2 1.2-2.2 2.2-2.8z"/>' +
      '<path d="M12 10v12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    );
  }

  function pickIcon() {
    return svg(
      '<path d="M14 2l8 8-2 2-3-3-8 8 2 2-2 2-6-6 2-2 2 2 8-8-3-3z"/>'
    );
  }

  function cartIcon() {
    return svg(
      '<path d="M2 3h3l2.4 11.3c.2 1 1.1 1.7 2.1 1.7H19v-2H9.9l-.4-2H19c.9 0 1.7-.6 1.9-1.5L22 5H6.2L5.3 1H2v2z"/>' +
      '<circle cx="10" cy="20" r="1.7"/>' +
      '<circle cx="18" cy="20" r="1.7"/>'
    );
  }

  function gearIcon() {
    return svg(
      '<path d="M19.4 13a7 7 0 000-2l2-1.6-2-3.4-2.4.8a7 7 0 00-1.8-1L14.8 3h-4l-.4 2.8a7 7 0 00-1.8 1l-2.4-.8-2 3.4L6.4 11a7 7 0 000 2l-2 1.6 2 3.4 2.4-.8a7 7 0 001.8 1l.4 2.8h4l.4-2.8a7 7 0 001.8-1l2.4.8 2-3.4-2-1.6zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z"/>'
    );
  }

  function chartIcon() {
    return svg(
      '<path d="M3 20h18v2H3v-2z"/>' +
      '<path d="M4 16l5-5 3 3 7-8 1.5 1.3-8.5 9.7-3-3L6 18l-2-2z"/>'
    );
  }

  function leafIcon() {
    return svg(
      '<path d="M20 3c-7 0-12 4-14 10-1 3 0 6 3 7 6 2 12-3 13-10 .3-2.3.6-5 1-7-1 0-2 0-3 0z"/>' +
      '<path d="M6 20c3-4 6-7 11-9" stroke="#fff" stroke-width="1" fill="none" opacity=".35"/>'
    );
  }

  function dotIcon() {
    return svg('<circle cx="12" cy="12" r="6"/>');
  }

  global.TradeCategoryRegistry = {
    categories: CATEGORIES,
    classify: classify,
    definition: definition,
    all: function () {
      return Object.keys(CATEGORIES).sort(function (a, b) {
        return CATEGORIES[a].order - CATEGORIES[b].order;
      });
    }
  };
})(typeof window !== "undefined" ? window : this);
