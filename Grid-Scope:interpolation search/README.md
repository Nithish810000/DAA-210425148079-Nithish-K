# GridScope — Smart Meter Search Lab

A dependency-free dashboard demonstrating interpolation search on smart-meter time-series data, with binary-search benchmarks and irregular timestamp experiments.

## Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## CSV format

```csv
timestamp,value_kw
2026-06-01T00:00:00.000Z,0.615
2026-06-01T00:05:00.000Z,0.592
```

Timestamps must be parseable dates and readings must be numeric. Imported rows are sorted automatically.
