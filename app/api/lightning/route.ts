import { NextResponse } from 'next/server';
import { WebSocket } from 'ws';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// LZW decode — same algorithm as client-side
function lzwDecode(compressed: string): string {
  const dict: Record<number, string> = {};
  const data = compressed.split('');
  let currChar = data[0];
  let oldPhrase = currChar;
  const out = [currChar];
  let code = 256;
  let phrase: string;
  for (let i = 1; i < data.length; i++) {
    const currCode = data[i].charCodeAt(0);
    if (currCode < 256) {
      phrase = data[i];
    } else {
      phrase = dict[currCode] !== undefined ? dict[currCode] : oldPhrase + currChar;
    }
    out.push(phrase);
    currChar = phrase[0];
    dict[code] = oldPhrase + currChar;
    code++;
    oldPhrase = phrase;
  }
  return out.join('');
}

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const servers = Array.from({ length: 8 }, (_, i) => `wss://ws${i + 1}.blitzortung.org`);
      let wsConn: WebSocket | null = null;
      let closed = false;
      let retryIdx = 0;

      // Deduplicate strikes: same lat+lon within a 2s wall-clock window
      const seen = new Map<string, number>();
      function isDuplicate(lat: number, lon: number): boolean {
        const key = `${lat.toFixed(3)}-${lon.toFixed(3)}`;
        const now = Date.now();
        // Purge old entries
        for (const [k, t] of seen) if (now - t > 2000) seen.delete(k);
        if (seen.has(key)) return true;
        seen.set(key, now);
        return false;
      }

      function send(data: string) {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {}
      }

      function safeClose(ws: WebSocket) {
        try { ws.terminate(); } catch {}
      }

      function tryConnect() {
        if (closed) return;
        const url = servers[retryIdx % servers.length];
        retryIdx++;

        let ws: WebSocket;
        try {
          ws = new WebSocket(url, {
            headers: {
              'Origin': 'https://www.blitzortung.org',
              'User-Agent': 'Mozilla/5.0',
            },
          });
        } catch {
          setTimeout(tryConnect, 3000);
          return;
        }

        wsConn = ws;

        let retrying = false;
        const scheduleRetry = (delay: number) => {
          if (!closed && !retrying) { retrying = true; setTimeout(tryConnect, delay); }
        };

        // Must attach error handler immediately to prevent uncaughtException
        ws.on('error', () => scheduleRetry(3000));

        ws.on('open', () => {
          send(JSON.stringify({ type: 'status', connected: true, server: url }));
          try { ws.send(JSON.stringify({ a: 111 })); } catch {}
        });

        ws.on('message', (raw: Buffer | string) => {
          try {
            let str = typeof raw === 'string' ? raw : raw.toString('utf8');

            // Try direct JSON first
            let parsed: any;
            try {
              parsed = JSON.parse(str);
            } catch {
              // Try LZW decode
              try {
                str = lzwDecode(str);
                parsed = JSON.parse(str);
              } catch {
                return;
              }
            }

            // Normalise to array of strikes
            const items: Array<{ lat: number; lon: number; time: number }> = [];
            if (Array.isArray(parsed.strikes)) {
              items.push(...parsed.strikes);
            } else if (typeof parsed.lat === 'number') {
              items.push(parsed);
            } else if (typeof parsed.lat === 'string') {
              items.push({ lat: parseFloat(parsed.lat), lon: parseFloat(parsed.lon), time: parsed.time ?? Date.now() });
            }

            items.forEach(item => {
              if (!isFinite(item.lat) || !isFinite(item.lon)) return;
              if (isDuplicate(item.lat, item.lon)) return;
              send(JSON.stringify({
                type: 'strike',
                lat: item.lat,
                lon: item.lon,
                time: item.time ?? Date.now(),
              }));
            });
          } catch {}
        });

        ws.on('close', () => scheduleRetry(2000));
      }

      tryConnect();

      // Heartbeat so the SSE connection stays alive
      const hb = setInterval(() => {
        try { controller.enqueue(encoder.encode(': ping\n\n')); } catch {}
      }, 15000);

      // Cleanup when client disconnects
      return () => {
        closed = true;
        clearInterval(hb);
        if (wsConn) safeClose(wsConn);
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
