/*
 * Country centroids lookup used by the Trade Flow Map widget.
 *
 * Exposes window.TradeFlowCentroids = { iso2, iso3, name } where each
 * value maps an UPPERCASED identifier to { lat, lng, name }.
 *
 * Centroids are approximate population-weighted centers rounded to two
 * decimals. Sourced from public-domain datasets (NaturalEarth + CIA
 * World Factbook). Add new countries by appending rows to COUNTRIES.
 */
(function (global) {
  "use strict";

  // [ISO-2, ISO-3, English name, lat, lng]
  var COUNTRIES = [
    ["AE", "ARE", "United Arab Emirates", 24.00, 54.00],
    ["AF", "AFG", "Afghanistan", 33.93, 67.71],
    ["AO", "AGO", "Angola", -11.20, 17.87],
    ["AR", "ARG", "Argentina", -38.42, -63.62],
    ["AT", "AUT", "Austria", 47.52, 14.55],
    ["AU", "AUS", "Australia", -25.27, 133.78],
    ["BD", "BGD", "Bangladesh", 23.68, 90.36],
    ["BE", "BEL", "Belgium", 50.50, 4.47],
    ["BF", "BFA", "Burkina Faso", 12.24, -1.56],
    ["BG", "BGR", "Bulgaria", 42.73, 25.49],
    ["BH", "BHR", "Bahrain", 26.07, 50.55],
    ["BJ", "BEN", "Benin", 9.31, 2.32],
    ["BO", "BOL", "Bolivia", -16.29, -63.59],
    ["BR", "BRA", "Brazil", -14.24, -51.93],
    ["BW", "BWA", "Botswana", -22.33, 24.68],
    ["BY", "BLR", "Belarus", 53.71, 27.95],
    ["CA", "CAN", "Canada", 56.13, -106.35],
    ["CD", "COD", "Democratic Republic of the Congo", -4.04, 21.76],
    ["CG", "COG", "Republic of the Congo", -0.23, 15.83],
    ["CH", "CHE", "Switzerland", 46.82, 8.23],
    ["CI", "CIV", "Ivory Coast", 7.54, -5.55],
    ["CL", "CHL", "Chile", -35.68, -71.54],
    ["CM", "CMR", "Cameroon", 7.37, 12.35],
    ["CN", "CHN", "China", 35.86, 104.20],
    ["CO", "COL", "Colombia", 4.57, -74.30],
    ["CR", "CRI", "Costa Rica", 9.75, -83.75],
    ["CU", "CUB", "Cuba", 21.52, -77.78],
    ["CY", "CYP", "Cyprus", 35.13, 33.43],
    ["CZ", "CZE", "Czech Republic", 49.82, 15.47],
    ["DE", "DEU", "Germany", 51.17, 10.45],
    ["DK", "DNK", "Denmark", 56.26, 9.50],
    ["DO", "DOM", "Dominican Republic", 18.74, -70.16],
    ["DZ", "DZA", "Algeria", 28.03, 1.66],
    ["EC", "ECU", "Ecuador", -1.83, -78.18],
    ["EG", "EGY", "Egypt", 26.82, 30.80],
    ["ES", "ESP", "Spain", 40.46, -3.75],
    ["ET", "ETH", "Ethiopia", 9.15, 40.49],
    ["FI", "FIN", "Finland", 61.92, 25.75],
    ["FR", "FRA", "France", 46.23, 2.21],
    ["GA", "GAB", "Gabon", -0.80, 11.61],
    ["GB", "GBR", "United Kingdom", 55.38, -3.44],
    ["GE", "GEO", "Georgia", 42.32, 43.36],
    ["GH", "GHA", "Ghana", 7.95, -1.02],
    ["GN", "GIN", "Guinea", 9.95, -9.70],
    ["GR", "GRC", "Greece", 39.07, 21.82],
    ["GT", "GTM", "Guatemala", 15.78, -90.23],
    ["HK", "HKG", "Hong Kong", 22.32, 114.17],
    ["HN", "HND", "Honduras", 15.20, -86.24],
    ["HR", "HRV", "Croatia", 45.10, 15.20],
    ["HU", "HUN", "Hungary", 47.16, 19.50],
    ["ID", "IDN", "Indonesia", -0.79, 113.92],
    ["IE", "IRL", "Ireland", 53.41, -8.24],
    ["IL", "ISR", "Israel", 31.05, 34.85],
    ["IN", "IND", "India", 20.59, 78.96],
    ["IQ", "IRQ", "Iraq", 33.22, 43.68],
    ["IR", "IRN", "Iran", 32.43, 53.69],
    ["IS", "ISL", "Iceland", 64.96, -19.02],
    ["IT", "ITA", "Italy", 41.87, 12.57],
    ["JM", "JAM", "Jamaica", 18.11, -77.30],
    ["JO", "JOR", "Jordan", 30.59, 36.24],
    ["JP", "JPN", "Japan", 36.20, 138.25],
    ["KE", "KEN", "Kenya", -0.02, 37.91],
    ["KG", "KGZ", "Kyrgyzstan", 41.20, 74.77],
    ["KH", "KHM", "Cambodia", 12.57, 104.99],
    ["KR", "KOR", "South Korea", 35.91, 127.77],
    ["KW", "KWT", "Kuwait", 29.31, 47.48],
    ["KZ", "KAZ", "Kazakhstan", 48.02, 66.92],
    ["LA", "LAO", "Laos", 19.86, 102.50],
    ["LB", "LBN", "Lebanon", 33.85, 35.86],
    ["LK", "LKA", "Sri Lanka", 7.87, 80.77],
    ["LR", "LBR", "Liberia", 6.43, -9.43],
    ["LT", "LTU", "Lithuania", 55.17, 23.88],
    ["LU", "LUX", "Luxembourg", 49.82, 6.13],
    ["LV", "LVA", "Latvia", 56.88, 24.60],
    ["LY", "LBY", "Libya", 26.34, 17.23],
    ["MA", "MAR", "Morocco", 31.79, -7.09],
    ["MG", "MDG", "Madagascar", -18.77, 46.87],
    ["MW", "MWI", "Malawi", -13.25, 34.30],
    ["ML", "MLI", "Mali", 17.57, -3.99],
    ["MM", "MMR", "Myanmar", 21.91, 95.96],
    ["MN", "MNG", "Mongolia", 46.86, 103.85],
    ["MX", "MEX", "Mexico", 23.63, -102.55],
    ["MY", "MYS", "Malaysia", 4.21, 101.98],
    ["MZ", "MOZ", "Mozambique", -18.67, 35.53],
    ["NA", "NAM", "Namibia", -22.96, 18.49],
    ["NE", "NER", "Niger", 17.61, 8.08],
    ["NG", "NGA", "Nigeria", 9.08, 8.68],
    ["NI", "NIC", "Nicaragua", 12.87, -85.21],
    ["NL", "NLD", "Netherlands", 52.13, 5.29],
    ["NO", "NOR", "Norway", 60.47, 8.47],
    ["NP", "NPL", "Nepal", 28.39, 84.12],
    ["NZ", "NZL", "New Zealand", -40.90, 174.89],
    ["OM", "OMN", "Oman", 21.47, 55.97],
    ["PA", "PAN", "Panama", 8.54, -80.78],
    ["PE", "PER", "Peru", -9.19, -75.02],
    ["PG", "PNG", "Papua New Guinea", -6.31, 143.96],
    ["PH", "PHL", "Philippines", 12.88, 121.77],
    ["PK", "PAK", "Pakistan", 30.38, 69.35],
    ["PL", "POL", "Poland", 51.92, 19.15],
    ["PT", "PRT", "Portugal", 39.40, -8.22],
    ["PY", "PRY", "Paraguay", -23.44, -58.44],
    ["QA", "QAT", "Qatar", 25.35, 51.18],
    ["RO", "ROU", "Romania", 45.94, 24.97],
    ["RS", "SRB", "Serbia", 44.02, 21.01],
    ["RU", "RUS", "Russia", 61.52, 105.32],
    ["SA", "SAU", "Saudi Arabia", 23.89, 45.08],
    ["SD", "SDN", "Sudan", 12.86, 30.22],
    ["SE", "SWE", "Sweden", 60.13, 18.64],
    ["SG", "SGP", "Singapore", 1.35, 103.82],
    ["SI", "SVN", "Slovenia", 46.15, 14.99],
    ["SK", "SVK", "Slovakia", 48.67, 19.70],
    ["SN", "SEN", "Senegal", 14.50, -14.45],
    ["SO", "SOM", "Somalia", 5.15, 46.20],
    ["SR", "SUR", "Suriname", 3.92, -56.03],
    ["SY", "SYR", "Syria", 34.80, 38.99],
    ["TD", "TCD", "Chad", 15.45, 18.73],
    ["TG", "TGO", "Togo", 8.62, 0.82],
    ["TH", "THA", "Thailand", 15.87, 100.99],
    ["TJ", "TJK", "Tajikistan", 38.86, 71.28],
    ["TM", "TKM", "Turkmenistan", 38.97, 59.56],
    ["TN", "TUN", "Tunisia", 33.89, 9.54],
    ["TR", "TUR", "Turkey", 38.96, 35.24],
    ["TT", "TTO", "Trinidad and Tobago", 10.69, -61.22],
    ["TW", "TWN", "Taiwan", 23.70, 120.96],
    ["TZ", "TZA", "Tanzania", -6.37, 34.89],
    ["UA", "UKR", "Ukraine", 48.38, 31.17],
    ["UG", "UGA", "Uganda", 1.37, 32.29],
    ["US", "USA", "United States", 37.09, -95.71],
    ["UY", "URY", "Uruguay", -32.52, -55.77],
    ["UZ", "UZB", "Uzbekistan", 41.38, 64.59],
    ["VE", "VEN", "Venezuela", 6.42, -66.59],
    ["VN", "VNM", "Vietnam", 14.06, 108.28],
    ["YE", "YEM", "Yemen", 15.55, 48.52],
    ["ZA", "ZAF", "South Africa", -30.56, 22.94],
    ["ZM", "ZMB", "Zambia", -13.13, 27.85],
    ["ZW", "ZWE", "Zimbabwe", -19.02, 29.15]
  ];

  // Common aliases seen in trade finance data.
  var ALIASES = {
    "USA": "US", "U.S.A.": "US", "U.S.": "US", "AMERICA": "US", "UNITED STATES OF AMERICA": "US",
    "UK": "GB", "U.K.": "GB", "GREAT BRITAIN": "GB", "ENGLAND": "GB", "BRITAIN": "GB",
    "UAE": "AE", "U.A.E.": "AE",
    "KOREA": "KR", "SOUTH KOREA": "KR", "REPUBLIC OF KOREA": "KR",
    "RUSSIA": "RU", "RUSSIAN FEDERATION": "RU",
    "IVORY COAST": "CI", "COTE D'IVOIRE": "CI", "COTE DIVOIRE": "CI",
    "VIET NAM": "VN",
    "HONG KONG SAR": "HK", "HONG KONG, CHINA": "HK",
    "CZECHIA": "CZ",
    "BURMA": "MM",
    "DRC": "CD", "CONGO (KINSHASA)": "CD", "CONGO, DEM. REP.": "CD",
    "CONGO (BRAZZAVILLE)": "CG", "CONGO, REP.": "CG",
    "TAIWAN, PROVINCE OF CHINA": "TW",
    "IRAN, ISLAMIC REPUBLIC OF": "IR",
    "SYRIAN ARAB REPUBLIC": "SY",
    "BOLIVIA, PLURINATIONAL STATE OF": "BO",
    "VENEZUELA, BOLIVARIAN REPUBLIC OF": "VE",
    "TANZANIA, UNITED REPUBLIC OF": "TZ"
  };

  var iso2 = {}, iso3 = {}, name = {};

  COUNTRIES.forEach(function (row) {
    var code2 = row[0], code3 = row[1], n = row[2];
    var entry = { lat: row[3], lng: row[4], name: n };
    iso2[code2] = entry;
    iso3[code3] = entry;
    name[n.toUpperCase()] = entry;
  });

  Object.keys(ALIASES).forEach(function (alias) {
    var target = iso2[ALIASES[alias]];
    if (target) name[alias] = target;
  });

  global.TradeFlowCentroids = { iso2: iso2, iso3: iso3, name: name };
})(typeof window !== "undefined" ? window : this);
