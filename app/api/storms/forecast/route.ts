import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const stormId = searchParams.get('id');
  if (!stormId) return NextResponse.json({ error: 'missing id' }, { status: 400 });

  try {
    const url = `https://www.nhc.noaa.gov/storm_graphics/api/public/${stormId}_5day_pgn.json`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ error: `NHC returned ${res.status}` }, { status: 502 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
