# COSMOS EXPLORER

```
  ██████╗ ██████╗ ███████╗███╗   ███╗ ██████╗ ███████╗
 ██╔════╝██╔═══██╗██╔════╝████╗ ████║██╔═══██╗██╔════╝
 ██║     ██║   ██║███████╗██╔████╔██║██║   ██║███████╗
 ██║     ██║   ██║╚════██║██║╚██╔╝██║██║   ██║╚════██║
 ╚██████╗╚██████╔╝███████║██║ ╚═╝ ██║╚██████╔╝███████║
  ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝
```

> A brutalist real-time space data terminal. Live telemetry from NASA, ESA, and open-source APIs — rendered in the browser.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-white.svg?style=flat-square&labelColor=000)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Three.js](https://img.shields.io/badge/Three.js-black?style=flat-square&logo=three.js)](https://threejs.org)

---

## PREVIEW

| MARS WEATHER | NEO TRACKER |
|:---:|:---:|
| ![Mars Weather](public/mws.png) | ![NEO Tracker](public/neo.png) |

| ISS LIVE | APOD |
|:---:|:---:|
| ![ISS Tracker](public/iss.png) | ![APOD](public/apod.png) |

---

## MODULES

```
01 / MARS    — Atmospheric telemetry from NASA InSight at Elysium Planitia
               vs. your local Earth weather in real time.

02 / NEO     — 7-day asteroid feed from NASA NeoWs. 3D orbital simulation,
               danger scoring, hazard filtering.

03 / ISS     — Live ISS position polled every 5s on a 3D Earth globe with
               cloud layer, orbital trails, crew manifest, and live HDTV.

04 / APOD    — Full-viewport Astronomy Picture of the Day. Date picker
               spanning the entire archive: Jun 16 1995 → today.
```

---

## STACK

```
Framework   Next.js 15 (App Router)
3D          Three.js · React Three Fiber · Drei
Animation   Motion (Framer Motion)
Styling     Tailwind CSS v4
Language    TypeScript (strict)
```

---

## DATA SOURCES

```
NASA InSight API        api.nasa.gov/insight_weather     Mars atmospheric data
NASA NeoWs              api.nasa.gov/neo/rest/v1         Near Earth Objects
NASA APOD               api.nasa.gov/planetary/apod      Astronomy Picture of the Day
WhereTheISS.at          api.wheretheiss.at/v1            ISS real-time position
Open-Notify             api.open-notify.org/astros       ISS crew manifest
Open-Meteo              api.open-meteo.com/v1/forecast   Local Earth weather
Nominatim / OSM         nominatim.openstreetmap.org      ISS reverse geocoding
```

All APIs are free and open. No backend required beyond Next.js API routes.

---

## GETTING STARTED

**Prerequisites:** Node.js 18+

**1. Clone**
```bash
git clone https://github.com/thor-op/cosmos.git
cd cosmos
```

**2. Install**
```bash
npm install
```

**3. Configure**
```bash
cp .env.example .env.local
```
Edit `.env.local` and set your NASA API key.
Get a free key at [api.nasa.gov](https://api.nasa.gov) — takes 30 seconds.

```env
NEXT_PUBLIC_NASA_API_KEY="your_key_here"
```

> `DEMO_KEY` works but is rate-limited to 30 req/hour per IP.

**4. Run**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## PROJECT STRUCTURE

```
cosmos/
├── app/
│   ├── api/crew/route.ts     # ISS crew proxy (server-side, 1h cache)
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── About.tsx             # About / credits page
│   ├── Apod.tsx              # Astronomy Picture of the Day
│   ├── CountUp.tsx           # Animated number component
│   ├── IssTracker.tsx        # ISS live tracker + 3D globe
│   ├── MarsWeather.tsx       # Mars vs Earth weather
│   ├── NeoTracker.tsx        # Near Earth Object tracker
│   └── Sidebar.tsx           # Navigation
├── public/
│   └── earth-clouds.png      # Cloud texture (local, avoids CORS)
└── .env.example
```

---

## LICENSE

```
COSMOS EXPLORER
Copyright (C) 2026  THORXOP (github.com/thor-op)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.
```

Full license text: [LICENSE](LICENSE)

---

<sub>Built by [THORXOP](https://github.com/thor-op) · Data provided by NASA Open APIs · OSM · Open-Meteo</sub>
