/**
 * TravelWeatherCard — Destination weather/UV/humidity context for travel consultations.
 * Geocodes destination, then fetches weather from Open-Meteo.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Cloud, Sun, Thermometer, Droplets, Wind, AlertTriangle, MapPin, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { geocodeLocation, getTravelWeatherContext, type TravelWeatherContext, type GeocodeResult } from '@/lib/clinicalApiService';

// WMO weather code to description
const weatherDesc: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
  55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail',
};

interface TravelWeatherCardProps {
  destination?: string;
  className?: string;
}

export function TravelWeatherCard({ destination: initialDest, className = '' }: TravelWeatherCardProps) {
  const [destination, setDestination] = useState(initialDest || '');
  const [weather, setWeather] = useState<TravelWeatherContext | null>(null);
  const [geocode, setGeocode] = useState<GeocodeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async (dest?: string) => {
    const query = dest || destination;
    if (!query.trim()) return;
    setLoading(true);
    setError(null);

    try {
      // Step 1: Geocode
      const geo = await geocodeLocation(query);
      if (geo.error || !geo.latitude) {
        setError(geo.error || 'Location not found');
        setLoading(false);
        return;
      }
      setGeocode(geo);

      // Step 2: Get weather
      const w = await getTravelWeatherContext(geo.latitude, geo.longitude, query);
      if (w.error) {
        setError(w.error);
      } else {
        setWeather(w);
      }
    } catch {
      setError('Weather data unavailable');
    } finally {
      setLoading(false);
    }
  };

  const uvBadgeColor = (uv: number) => {
    if (uv >= 11) return 'bg-purple-600 text-white';
    if (uv >= 8) return 'bg-red-500 text-white';
    if (uv >= 6) return 'bg-orange-500 text-white';
    if (uv >= 3) return 'bg-yellow-500 text-foreground';
    return 'bg-green-500 text-white';
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Cloud className="h-4 w-4 text-primary" />
          Destination Weather Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchWeather()}
              placeholder="Enter destination…"
              className="pl-8 text-sm h-8"
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => fetchWeather()} disabled={loading} className="h-8">
            {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Lookup'}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" /> {error}
          </div>
        )}

        {loading && (
          <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-24 w-full" /></div>
        )}

        {weather && weather.current && !loading && (
          <>
            {/* Current conditions */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded bg-muted/30">
                <Thermometer className="h-4 w-4 mx-auto text-primary mb-1" />
                <span className="text-lg font-bold">{weather.current.temperature}°</span>
                <p className="text-[10px] text-muted-foreground">Temp</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <Thermometer className="h-4 w-4 mx-auto text-orange-500 mb-1" />
                <span className="text-lg font-bold">{weather.current.apparentTemperature}°</span>
                <p className="text-[10px] text-muted-foreground">Feels like</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <Droplets className="h-4 w-4 mx-auto text-blue-500 mb-1" />
                <span className="text-lg font-bold">{weather.current.humidity}%</span>
                <p className="text-[10px] text-muted-foreground">Humidity</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <Wind className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <span className="text-lg font-bold">{weather.current.windSpeed}</span>
                <p className="text-[10px] text-muted-foreground">km/h</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              {weatherDesc[weather.current.weatherCode] || `Code: ${weather.current.weatherCode}`}
              {geocode?.displayName && ` · ${geocode.displayName.split(',').slice(0, 2).join(',')}`}
            </p>

            {/* 7-day forecast */}
            {weather.daily && weather.daily.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">7-Day Forecast</p>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                  {weather.daily.map((d, i) => (
                    <div key={i} className="p-1 rounded bg-muted/20">
                      <p className="font-medium">{new Date(d.date).toLocaleDateString('en-AU', { weekday: 'short' })}</p>
                      <p>{d.tempMax}°/{d.tempMin}°</p>
                      <div className={`text-[9px] px-1 rounded mt-0.5 ${uvBadgeColor(d.uvIndexMax)}`}>
                        UV {d.uvIndexMax}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Health alerts */}
            {weather.alerts && weather.alerts.length > 0 && (
              <div className="space-y-1">
                {weather.alerts.map((alert, i) => (
                  <Alert key={i} className="py-2 border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <AlertDescription className="text-xs">{alert}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Source: Open-Meteo. Contextual support only — not definitive medical advice.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
