import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat') || '0';
  const lon = searchParams.get('lon') || '0';

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,precipitation` +
    `&daily=sunrise,sunset,uv_index_max,precipitation_sum,temperature_2m_max,temperature_2m_min,weather_code,wind_speed_10m_max` +
    `&timezone=auto&forecast_days=7`;

  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=pm10,pm2_5,us_aqi&timezone=auto`;

  try {
    const [wRes, aqRes] = await Promise.all([fetch(url), fetch(aqUrl)]);
    const [weather, aq] = await Promise.all([wRes.json(), aqRes.json()]);
    return NextResponse.json({ weather, aq });
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}
