from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
import httpx
import asyncio
import io
import os
from datetime import datetime, timezone
import logging

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Hubbard Brook Weather Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────────
# Data state (in-memory; updated hourly from live portal)
# ──────────────────────────────────────────────────────────────────
LIVE_URL   = "https://data-jam.replit.app/api/live-data"
LOCAL_CSV  = os.path.join(os.path.dirname(__file__), "..", "ForestDataJam_hourly.csv")

# Live-data column map  →  internal alias
LIVE_COL_MAP = {
    "airtemp":         "airtemp",
    "windspeed":       "windspeed",
    "winddir":         "wind_dir",
    "precip_mm_hr":    "precip",
    "solrad":          "solar",
    "RH":              "rh",
    "snow_mm":         "snow",
    "discharge_mm_hr": "stream",
    "et_mm_hr":        "et",
    "pressure":        "pressure",
    "streamflow_cfs":  "streamflow",
    "soil_mm":         "soil",
    "gw_mm":           "gw",
}

# ForestDataJam_hourly.csv column map  →  internal alias
LOCAL_COL_MAP = {
    "Air_Temperature_celsius": "airtemp",
    "Wind_Speed":              "windspeed",
    "Wind_Direction":          "wind_dir",
    "Precipitation_mm_hr":     "precip",
    "Solar_Radiation":         "solar",
    "Relative_Humidity":       "rh",
    "Snow_mm":                 "snow",
    "Stream_Discharge_mm_hr":  "stream",
    "Evapotranspiration_mm_hr":"et",
    "Air_Pressure":            "pressure",
    "streamflow_cfs":          "streamflow",
    "Soil_mm":                 "soil",
}

# All aliases used throughout API responses
ALL_ALIASES = list(set(LIVE_COL_MAP.values()))

df: pd.DataFrame = pd.DataFrame()
data_source: str = "none"
last_fetched: str = "never"

THRESHOLDS = {
    "airtemp":    1.0,
    "windspeed":  1.0,
    "precip":     0.5,
    "solar":      50.0,
    "rh":         1.0,
    "snow":       5.0,
    "stream":     0.1,
    "et":         0.001,
    "streamflow": 0.01,
}

ALIAS_LABELS = {
    "airtemp":    "Air Temperature",
    "windspeed":  "Wind Speed",
    "wind_dir":   "Wind Direction",
    "precip":     "Precipitation",
    "solar":      "Solar Radiation",
    "rh":         "Humidity",
    "snow":       "Snow Depth",
    "stream":     "Stream Discharge",
    "et":         "Evapotranspiration",
    "pressure":   "Pressure",
    "streamflow": "Streamflow",
    "soil":       "Soil Moisture",
    "gw":         "Groundwater",
}


# ──────────────────────────────────────────────────────────────────
# Data loading helpers
# ──────────────────────────────────────────────────────────────────

def _process_df(raw: pd.DataFrame, col_map: dict) -> pd.DataFrame:
    """Rename columns to aliases, parse dates, keep only aliased cols."""
    out = pd.DataFrame()
    for src, alias in col_map.items():
        if src in raw.columns:
            out[alias] = pd.to_numeric(raw[src], errors="coerce")
    # Parse datetime
    if "date" in raw.columns:
        dates = pd.to_datetime(raw["date"], errors="coerce")
    elif "timestamp" in raw.columns:
        dates = pd.to_datetime(raw["timestamp"], unit="s", errors="coerce")
    else:
        dates = pd.Series(pd.NaT, index=raw.index)
    out["_dt"]       = dates
    out["_date_str"] = dates.dt.strftime("%Y-%m-%d")
    out["_hour"]     = dates.dt.hour
    return out.dropna(subset=["_dt"])


async def _fetch_live() -> bool:
    """Fetch from the live portal. Returns True on success."""
    global df, data_source, last_fetched
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(LIVE_URL)
            resp.raise_for_status()
        raw = pd.read_csv(io.StringIO(resp.text))
        new_df = _process_df(raw, LIVE_COL_MAP)
        if len(new_df) > 100:
            df          = new_df
            data_source = "live"
            last_fetched = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            logger.info(f"✅ Fetched {len(df)} rows from live portal")
            return True
    except Exception as e:
        logger.warning(f"⚠️  Live fetch failed: {e}")
    return False


def _load_local() -> bool:
    """Fall back to local CSV."""
    global df, data_source
    try:
        raw    = pd.read_csv(LOCAL_CSV)
        new_df = _process_df(raw, LOCAL_COL_MAP)
        if len(new_df) > 0:
            df = new_df
            data_source = "local"
            logger.info(f"✅ Loaded {len(df)} rows from local CSV")
            return True
    except Exception as e:
        logger.error(f"❌ Local CSV load failed: {e}")
    return False


async def _hourly_refresh():
    """Background task: refresh from live portal every hour."""
    while True:
        await asyncio.sleep(3600)   # wait 1 hour
        success = await _fetch_live()
        if not success:
            logger.warning("Live refresh failed; keeping current data.")


@app.on_event("startup")
async def startup_event():
    # 1. Try live portal first
    ok = await _fetch_live()
    if not ok:
        # 2. Fall back to local CSV if live fetch fails
        _load_local()
    # 3. Schedule hourly background refresh
    asyncio.create_task(_hourly_refresh())
    logger.info(f"API ready — source: {data_source}, rows: {len(df)}")


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

def _require_data():
    if df.empty:
        raise HTTPException(status_code=503, detail="Data not available yet")


def _get_row(date: str, hour: int) -> pd.Series:
    _require_data()
    mask = (df["_date_str"] == date) & (df["_hour"] == hour)
    rows = df[mask]
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"No data for {date} hour {hour}")
    return rows.iloc[0]


def _row_to_dict(row: pd.Series) -> dict:
    result = {}
    for alias in ALL_ALIASES:
        if alias in row and not pd.isna(row[alias]):
            result[alias] = round(float(row[alias]), 6)
        else:
            result[alias] = 0.0
    result["date"]      = row["_date_str"]
    result["hour"]      = int(row["_hour"])
    result["date_full"] = str(row["_dt"])
    return result


# ──────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────

@app.get("/")
def read_root():
    return {
        "message":      "Hubbard Brook Weather Analysis API",
        "data_source":  data_source,
        "last_fetched": last_fetched,
        "rows":         len(df),
    }


@app.get("/weather-timeline")
def get_weather_timeline(date: str = "2024-01-01", hour: int = 0):
    row = _get_row(date, hour)
    return _row_to_dict(row)


@app.get("/weather-day")
def get_weather_day(date: str = "2024-01-01"):
    _require_data()
    mask = df["_date_str"] == date
    rows = df[mask].sort_values("_hour")
    if rows.empty:
        raise HTTPException(status_code=404, detail=f"No data for {date}")
    return [_row_to_dict(r) for _, r in rows.iterrows()]


@app.get("/weather-summary")
def get_weather_summary(date: str = "2024-01-01", hour: int = 0):
    row = _get_row(date, hour)
    metrics = []
    for alias, threshold in THRESHOLDS.items():
        if alias not in row or pd.isna(row[alias]):
            continue
        val   = float(row[alias])
        score = abs(val) / threshold if alias == "airtemp" else val / threshold
        metrics.append({
            "name":  ALIAS_LABELS.get(alias, alias),
            "alias": alias,
            "value": round(val, 4),
            "score": round(score, 4),
        })
    metrics.sort(key=lambda x: x["score"], reverse=True)
    return {
        "date": date, "hour": hour,
        "summary": {
            "severe":   metrics[0:2],
            "moderate": metrics[2:4],
            "chill":    metrics[4:6],
        }
    }


@app.get("/latest-data")
def get_latest_data():
    _require_data()
    row = df[df["_dt"] == df["_dt"].max()].iloc[0]
    return _row_to_dict(row)


@app.get("/date-range")
def get_date_range():
    _require_data()
    return {
        "start":  df["_date_str"].min(),
        "end":    df["_date_str"].max(),
        "source": data_source,
        "fetched": last_fetched,
    }


@app.get("/force-refresh")
async def force_refresh():
    """Manually trigger a live data refresh."""
    success = await _fetch_live()
    return {"success": success, "source": data_source,
            "rows": len(df), "last_fetched": last_fetched}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
