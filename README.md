# Trade Flow Globe — Bold BI Custom Widget

A spinning 3D globe for Bold BI dashboards that shows commodity flows from
origin to destination countries. Built for trade finance fund dashboards —
every deal has a buyer, a seller, a commodity, a category, and a USD amount
being financed.

## What it does

- Renders a **spinning 3D globe** (three.js / globe.gl) with every deal drawn
  as a glowing arc from origin → destination country centroid.
- Each arc is coloured by **commodity category** with a fixed palette:
  | Category              | Colour    | Icon       |
  |-----------------------|-----------|------------|
  | Soft Commodities      | `#6FAE4A` | wheat      |
  | Hard Commodities      | `#546E7A` | pickaxe    |
  | FMCG                  | `#E91E63` | cart       |
  | Industrial Products   | `#E3672B` | gear       |
  | Financial Instruments | `#5D3FD3` | chart line |
  | Tobacco               | `#795548` | leaf       |
- Arc **thickness** scales with the financed USD amount.
- Arc **altitude** scales with the great-circle distance — long-haul flows
  arc higher so you can see them stacking over short-haul flows.
- An **icon** is drawn on each origin country showing the dominant category
  financed out of that country.
- Rich hover tooltip with origin → destination, category, commodity,
  financed USD, and volume.
- Auto-rotation, zoom, and three basemap styles (Night, Day, Topographic).

## Repository layout

```
widget/
  manifest.json             Bold BI widget manifest (bindings + appearance)
  trade-flow-map.js         Widget implementation (globe.gl)
  trade-flow-map.css        Widget styles
  country-centroids.js      ISO-2 / ISO-3 / name → lat,lng lookup (130+ countries)
  commodity-categories.js   Category definitions, colours, icons, classifier
  icon.svg                  Widget tile icon
sample/
  sample-trade-data.csv     64-row synthetic trade-finance book covering every category
preview.html                Standalone preview of the widget outside Bold BI
```

## Required data columns

Map these columns in the Bold BI data panel when adding the widget:

| Binding               | Type      | Required | Description                                                                            |
|-----------------------|-----------|----------|----------------------------------------------------------------------------------------|
| Origin Country        | Dimension | yes      | Country of export. Accepts ISO-2 (`US`), ISO-3 (`USA`), or English name.               |
| Destination Country   | Dimension | yes      | Country of import. Same accepted formats.                                              |
| Commodity             | Dimension | no       | Specific commodity, e.g. `Cocoa`, `Copper`, `Crude Oil`.                               |
| Commodity Category    | Dimension | no       | One of the six categories above. If missing, the widget infers it from Commodity.      |
| Financed Amount       | Measure   | yes      | USD value. Drives arc thickness.                                                       |
| Volume                | Measure   | no       | Physical volume (tonnes, barrels…). Shown in tooltip.                                  |

### Category rules

- If the **Commodity Category** column is present and matches one of the six
  canonical names (case-insensitive), it is used as-is.
- Otherwise the widget looks up the **Commodity** value in a built-in
  classifier (`widget/commodity-categories.js`). It knows about 100+ common
  commodities — wheat → Soft, cobalt → Hard, wine → FMCG, urea → Industrial,
  letters of credit → Financial, burley → Tobacco, etc.
- Commodities that don't match anything fall into a generic `Other` bucket
  (grey, dot icon) rather than breaking the widget.

## Installing into Bold BI

### On-prem / Docker

1. Copy the contents of `widget/` into your Bold BI custom widgets directory.
   - Linux / Docker: `/application/app_data/custom-widgets/trade-flow-globe/`
   - Windows: `C:\Bold Services\Application\app_data\custom-widgets\trade-flow-globe\`
2. Restart the `bold-designer` service
   (Docker: `docker restart bold-designer`, Windows: recycle the
   `BoldBI Designer` IIS app pool).
3. Sign in as a site admin, open **Settings → Custom Widgets**, confirm
   *Trade Flow Globe* is listed and enabled.

### Bold BI Cloud

1. Open **Data → Custom Widgets → Add Widget**.
2. Upload the `widget/` folder as a ZIP. Bold BI reads `manifest.json` to
   register the widget.
3. Assign the widget to the tenants / users who should see it.

## Adding to a dashboard

1. Edit any dashboard. The widget appears under **Custom Widgets →
   Trade Flow Globe**.
2. Drag it onto the canvas. Resize freely — the globe is responsive.
3. In the **Data** panel, map each dataset column to the binding shown in
   the table above.
4. In the **Properties / Appearance** panel, toggle spin, animation, icon
   display, basemap style, and legend visibility.

## Previewing locally (before installing)

Open `preview.html` in a browser. It loads the sample CSV and wires it up
to the exact same widget code Bold BI will load — the fastest way to see
the globe and iterate on styling.

```
# macOS / Linux
cd Chart-BoldBI
python3 -m http.server 8000
# then open http://localhost:8000/preview.html
```

## Extending

- **Add a commodity** — append to `COMMODITY_TO_CATEGORY` in
  `widget/commodity-categories.js`.
- **Add a country** — append to `COUNTRIES` in
  `widget/country-centroids.js`. Each row is
  `[ISO-2, ISO-3, "English name", lat, lng]`.
- **Change a category colour / icon** — edit `CATEGORIES` in
  `widget/commodity-categories.js`. Icons are inline SVGs that inherit
  the category colour through `fill="currentColor"`.
- **Tweak arc altitude / curvature** — edit `arcAltitude()` in
  `widget/trade-flow-map.js`.

## Third-party assets

- [globe.gl 2.32.0](https://github.com/vasturiano/globe.gl) — MIT, loaded from unpkg.
- [three.js 0.160.0](https://threejs.org/) — MIT, loaded from unpkg.
- Earth texture imagery — bundled in three-globe examples (NASA Blue Marble /
  night lights, public domain).
