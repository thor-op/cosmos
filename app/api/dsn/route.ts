import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const url = `https://eyes.jpl.nasa.gov/dsn/data/dsn.xml?r=${Date.now()}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/xml,application/xml' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ error: `DSN returned ${res.status}` }, { status: 502 });
    const text = await res.text();
    return new NextResponse(text, {
      headers: { 'Content-Type': 'text/xml', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
