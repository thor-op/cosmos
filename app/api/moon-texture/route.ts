import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ordered by preference — first one that loads wins
const TEXTURE_SOURCES: Record<string, string[]> = {
  color: [
    // Solar System Scope — bright, high contrast, widely used
    'https://www.solarsystemscope.com/textures/download/2k_moon.jpg',
    // three-globe CDN fallback
    'https://unpkg.com/three-globe/example/img/moon_surface.jpg',
    // NASA SVS (dark but accurate)
    'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg',
  ],
  bump: [
    'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_disp_2k.jpg',
    'https://unpkg.com/three-globe/example/img/moon_surface.jpg',
  ],
};

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type') ?? 'color';
  const sources = TEXTURE_SOURCES[type] ?? TEXTURE_SOURCES.color;

  for (const url of sources) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: 'Texture unavailable' }, { status: 502 });
}
