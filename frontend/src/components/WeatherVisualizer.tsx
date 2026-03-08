"use client";

import { useState, useEffect } from "react";
import TreeVisualizer from "./TreeVisualizer";
import WeatherEffects from "./WeatherEffects";
import { Loader2 } from "lucide-react";

interface WeatherData {
    snow_depth_max_mm: number;
    precip_total_mm: number;
    stream_total_mm: number;
    et_mm: number;
    solar_mean_wm2: number;
    windspeed_mean_ms: number;
    airtemp_mean_oC: number;
    rh_pct: number;
    date: string;
    hour: number;
}

export default function WeatherVisualizer() {
    const [data, setData] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Controlled Date/Hour
    // Defaulting to an interesting winter day from the dataset preview
    const [currentDate, setCurrentDate] = useState("1/5/2022");
    const [currentHour, setCurrentHour] = useState(12);

    const fetchWeatherData = async (date: string, hour: number) => {
        setLoading(true);
        setError(null);
        try {
            // Fetching from the FastAPI backend running locally
            const response = await fetch(`http://127.0.0.1:8000/weather-timeline?date=${date}&hour=${hour}`);
            if (!response.ok) {
                throw new Error("Failed to fetch weather data");
            }
            const rawData = await response.json();
            setData(rawData);
        } catch (err) {
            console.error(err);
            setError("Could not load data. Ensure FastAPI is running on port 8000.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWeatherData(currentDate, currentHour);
    }, [currentDate, currentHour]);

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-zinc-900 text-white font-sans overflow-hidden">
            {/* Visualizer Background layer */}
            {data && (
                <>
                    <WeatherEffects
                        precip={data.precip_total_mm}
                        solar={data.solar_mean_wm2}
                        rh={data.rh_pct}
                    />
                    <TreeVisualizer
                        airtemp={data.airtemp_mean_oC}
                        windspeed={data.windspeed_mean_ms}
                        stream={data.stream_total_mm}
                    />
                </>
            )}

            {/* Loading overlay */}
            {loading && !data && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-red-900/50 backdrop-blur-sm p-4 text-center">
                    <div>
                        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {/* Controls Overlay */}
            <div className="absolute bottom-0 z-50 w-full p-6 pb-12">
                <div className="mx-auto max-w-2xl rounded-2xl bg-black/60 p-6 backdrop-blur-md shadow-2xl border border-white/10">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-light tracking-widest text-white/90">
                                HUBBARD BROOK <span className="font-bold">VIZ</span>
                            </h1>

                            <div className="text-right">
                                <p className="text-sm font-medium text-white/60">Currently Viewing</p>
                                <p className="text-lg font-mono font-bold">
                                    {currentDate} @ {currentHour.toString().padStart(2, "0")}:00
                                </p>
                            </div>
                        </div>

                        {/* Scrubber / Slider */}
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-xs font-mono text-white/50">
                                <span>0:00</span>
                                <span>12:00</span>
                                <span>23:00</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="23"
                                value={currentHour}
                                onChange={(e) => setCurrentHour(parseInt(e.target.value))}
                                className="w-full cursor-pointer accent-white"
                            />
                        </div>

                        {/* Quick metrics readout */}
                        {data && (
                            <div className="grid grid-cols-4 gap-4 pt-4 border-t border-white/10 text-center text-sm font-mono">
                                <div>
                                    <span className="block text-white/50">Temp</span>
                                    <span className="font-bold">{data.airtemp_mean_oC.toFixed(1)}°C</span>
                                </div>
                                <div>
                                    <span className="block text-white/50">Wind</span>
                                    <span className="font-bold">{data.windspeed_mean_ms.toFixed(1)}m/s</span>
                                </div>
                                <div>
                                    <span className="block text-white/50">Precip</span>
                                    <span className="font-bold">{data.precip_total_mm}mm</span>
                                </div>
                                <div>
                                    <span className="block text-white/50">Solar</span>
                                    <span className="font-bold">{data.solar_mean_wm2}W</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
