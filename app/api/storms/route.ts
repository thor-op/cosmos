import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const JTWC_BASE = 'https://www.metoc.navy.mil/jtwc';

function parseTcw(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headerLine = lines.find(l => /^\d{10}\s+\w+/.test(l));
  if (!headerLine) return null;
  const hParts = headerLine.split(/\s+/);
  const stormNum = hParts[1];
  const name = hParts[2];
  const t000 = lines.find(l => l.startsWith('T000'));
  if (!t000) return null;
  const posMatch = t000.match(/T000\s+(\d+)([NS])\s+(\d+)([EW])\s+(\d+)/);
  if (!posMatch) return null;
  let lat = parseInt(posMatch[1]) / 10;
  if (posMatch[2] === 'S') lat = -lat;
  let lon = parseInt(posMatch[3]) / 10;
  if (posMatch[4] === 'W') lon = -lon;
  const windKt = parseInt(posMatch[5]);
  const forecastTrack: [number, number][] = [[lat, lon]];
  for (const line of lines) {
    const m = line.match(/^T(\d+)\s+(\d+)([NS])\s+(\d+)([EW])\s+(\d+)/);
    if (!m || m[1] === '000') continue;
    let fLat = parseInt(m[2]) / 10;
    if (m[3] === 'S') fLat = -fLat;
    let fLon = parseInt(m[4]) / 10;
    if (m[5] === 'W') fLon = -fLon;
    forecastTrack.push([fLat, fLon]);
  }
  const suffix = stormNum.slice(-1).toUpperCase();
  const basinMap: Record<string, string> = {
    L: 'Atlantic', E: 'E. Pacific', C: 'C. Pacific',
    W: 'W. Pacific', A: 'Arabian Sea', B: 'Bay of Bengal',
    S: 'S. Indian', P: 'S. Pacific / Australian',
  };
  const basin = basinMap[suffix] ?? 'Global';
  const isInvest = parseInt(stormNum) >= 90;
  const classification = isInvest
    ? 'Invest'
    : windKt >= 64 ? 'Typhoon/Hurricane' : windKt >= 34 ? 'Tropical Storm' : 'Tropical Depression';
  return {
    id: `jtwc-${stormNum.toLowerCase()}`,
    name: isInvest ? stormNum : name,
    basin,
    classification,
    lat,
    lon,
    windSpeed: windKt,
    source: 'jtwc',
    forecastTrack: forecastTrack.length > 1 ? forecastTrack : undefined,
  };
}

function extractTcwUrls(rssText: string): string[] {
  const urls: string[] = [];
  const re = /href='(https?:\/\/[^']+\.tcw)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rssText)) !== null) urls.push(m[1]);
  return [...new Set(urls)];
}

function parseNhcStorms(raw: any[]) {
  return raw.map((s: any) => {
    const windMph = parseFloat(s.maxWindMPH ?? 0);
    const windKt = windMph > 0 ? windMph * 0.868976 : parseFloat(s.windKt ?? 0);
    return {
      id: s.id ?? `nhc-${s.name}`,
      name: s.name ?? 'Unknown',
      basin: s.basin ?? 'Atlantic',
      classification: s.classification ?? '',
      lat: parseFloat(s.latitudeNumeric ?? s.lat ?? 0),
      lon: parseFloat(s.longitudeNumeric ?? s.lon ?? 0),
      windSpeed: windKt,
      pressure: s.minPressureMB ? parseFloat(s.minPressureMB) : undefined,
      movement: s.movementDesc,
      source: 'nhc',
    };
  }).filter((s: any) => isFinite(s.lat) && isFinite(s.lon));
}

export async function GET() {
  try {
    const [nhcRes, rssRes] = await Promise.allSettled([
      fetch('https://www.nhc.noaa.gov/CurrentStorms.json', {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }),
      fetch(`${JTWC_BASE}/rss/jtwc.rss`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(8000),
      }),
    ]);

    let nhcStorms: any[] = [];
    let jtwcStorms: any[] = [];

    if (nhcRes.status === 'fulfilled' && nhcRes.value.ok) {
      try {
        const data = await nhcRes.value.json();
        nhcStorms = parseNhcStorms(data.activeStorms ?? []);
      } catch {}
    }

    if (rssRes.status === 'fulfilled' && rssRes.value.ok) {
      try {
        const rssText = await rssRes.value.text();
        const tcwUrls = extractTcwUrls(rssText);
        const tcwResults = await Promise.allSettled(
          tcwUrls.map(url =>
            fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) })
              .then(r => r.text())
          )
        );
        for (const result of tcwResults) {
          if (result.status !== 'fulfilled') continue;
          const parsed = parseTcw(result.value);
          if (parsed) jtwcStorms.push(parsed);
        }
      } catch {}
    }

    const nhcNames = new Set(nhcStorms.map((s: any) => s.name.toLowerCase()));
    const merged = [
      ...nhcStorms,
      ...jtwcStorms.filter((s: any) => !nhcNames.has(s.name.toLowerCase())),
    ];

    return NextResponse.json({ storms: merged, fetchedAt: Date.now() });
  } catch (e) {
    return NextResponse.json({ storms: [], fetchedAt: Date.now(), error: String(e) });
  }
}
