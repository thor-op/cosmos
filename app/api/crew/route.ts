import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('http://api.open-notify.org/astros.json', { 
      next: { revalidate: 3600 } 
    });
    
    if (!res.ok) {
      throw new Error(`Failed to fetch crew data: ${res.status}`);
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Crew API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch crew' }, { status: 500 });
  }
}
