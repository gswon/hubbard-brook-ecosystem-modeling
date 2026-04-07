from fastapi import FastAPI, HTTPException
import pandas as pd
from typing import List, Dict, Any

app = FastAPI(title="Weather Analysis API")

# Load data globally 
# In a real production app, you might want to load this into a database.
try:
    df = pd.read_csv("2022_Hourly_Data.csv")
    # Clean up column names or types if necessary
except Exception as e:
    df = pd.DataFrame()
    print(f"Error loading CSV: {e}")

# Base thresholds to determine how 'predominant' a weather factor is.
# Based on your notes: 
# snow: 5cm (50mm)
# precip: 1mm
# stream: 1mm
# et: 1mm
# solar: 1W/m2 
# windspeed: 1m/s
# airtemp: 1oC
# rh: 1%

THRESHOLDS = {
    'snow_depth_max_mm': 50.0,
    'precip_total_mm': 1.0,
    'stream_total_mm': 1.0,
    'et_mm': 1.0,
    'solar_mean_wm2': 1.0,  
    'windspeed_mean_ms': 1.0,
    'airtemp_mean_oC': 1.0, 
    'rh_pct': 1.0
}

@app.get("/")
def read_root():
    return {"message": "Welcome to the Weather Analysis API"}

@app.get("/weather-summary")
def get_weather_summary(date: str = "1/1/2022", hour: int = 0):
    if df.empty:
        raise HTTPException(status_code=500, detail="Data not available")
        
    # filter data
    row = df[(df['Date'] == date) & (df['Hour'] == hour)]
    
    if row.empty:
        raise HTTPException(status_code=404, detail="Data not found for the given date and hour")
    
    row = row.iloc[0]
    
    # Calculate score for each weather feature
    metrics = []
    for col, threshold in THRESHOLDS.items():
        if col not in row:
            continue
            
        val = row[col]
        
        # Calculate impact score (how dominant it is compared to base unit)
        if pd.isna(val):
            score = 0
            val = None
        elif col == 'airtemp_mean_oC':
            score = abs(val) / threshold # Extreme cold or hot are both impactful
        else:
            score = val / threshold
            
        metrics.append({
            'name': col.replace('_mm', '').replace('_mean', '').replace('_ms', '').replace('_oC', '').replace('_pct', '').replace('_wm2', '').replace('_max', ''),
            'raw_column': col, 
            'value': val, 
            'score': float(score)
        })
    
    # Sort by predominant (score descending)
    metrics.sort(key=lambda x: x['score'], reverse=True)
    
    # Divide into 3 distinct categories based on relative ranking
    # The user asked to divide into severe/moderate/chill and return top 2 for each
    categorized = {
        "severe": metrics[0:2],
        "moderate": metrics[2:4],
        "chill": metrics[4:6]
    }
    
    return {
        "date": date,
        "hour": hour,
        "summary": categorized
    }

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/weather-timeline")
def get_weather_timeline(date: str = "1/1/2022", hour: int = 0):
    if df.empty:
        raise HTTPException(status_code=500, detail="Data not available")
        
    row = df[(df['Date'] == date) & (df['Hour'] == hour)]
    
    if row.empty:
        raise HTTPException(status_code=404, detail="Data not found for the given date and hour")
    
    # Return the raw row data for frontend mapping
    d = row.iloc[0].to_dict()
    import math
    for k, v in d.items():
        if isinstance(v, float) and math.isnan(v):
            d[k] = None
    return d

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
