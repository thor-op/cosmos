import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-static';

export function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'star-map', 'data', 'stars_all.json');
    const data = readFileSync(filePath, 'utf-8');
    return new NextResponse(data, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Star data not found' }, { status: 404 });
  }
}
