import { NextResponse } from 'next/server';

const NOAA = 'https://services.swpc.noaa.gov';

export async function GET() {
  try {
    const [plasmaRes, kpRes, xrayRes] = await Promise.all([
      fetch(`${NOAA}/products/solar-wind/plasma-7-day.json`, { cache: 'no-store' }),
      fetch(`${NOAA}/json/planetary_k_index_1m.json`, { cache: 'no-store' }),
      fetch(`${NOAA}/json/goes/primary/xrays-7-day.json`, { cache: 'no-store' }),
    ]);

    // mag is separate — keep it for Bz/Bt
    const magRes = await fetch(`${NOAA}/products/solar-wind/mag-5-minute.json`, { cache: 'no-store' });

    if (!plasmaRes.ok || !kpRes.ok || !magRes.ok) {
      const statuses = `plasma=${plasmaRes.status} kp=${kpRes.status} mag=${magRes.status} xray=${xrayRes.status}`;
      throw new Error(`NOAA upstream error: ${statuses}`);
    }

    const [plasma, kp, mag] = await Promise.all([plasmaRes.json(), kpRes.json(), magRes.json()]);
    // xray is optional — don't fail if it's down
    const xray = xrayRes.ok ? await xrayRes.json() : [];

    return NextResponse.json({ plasma, kp, mag, xray });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    console.error('[space-weather]', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
