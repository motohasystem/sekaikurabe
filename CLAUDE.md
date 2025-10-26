# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**セカイクラベ (Sekai Kurabe)** - "世界比べ - 国の大きさ、感じてみたい？"

A web application that overlays country and Japanese island coastline shapes on OpenStreetMap at user-selected pin locations. Users can click anywhere on the map to place a pin, then input country or island names (in Japanese or English) via text or voice input. The application displays the actual coastline boundary centered on the pinned location for intuitive size comparison.

## Development Setup

No build process required - pure HTML/CSS/JavaScript application.

**Running locally:**
```bash
# Option 1: Using npx
npx serve .

# Option 2: Using Python
python -m http.server 8000
```

Open `http://localhost:8000` or simply open `index.html` directly in a browser.

**Requirements:**
- Modern browser with Web Speech API support (Chrome, Edge, Safari)
- HTTPS or localhost for voice input functionality
- Internet connection for OpenStreetMap tiles and Nominatim API

## Key Features

1. **Pin Placement**: Click anywhere on map to place a red pin marker
2. **Coastline Overlay**: Displays GeoJSON coastline data centered on the pin location
3. **Mainland Extraction**: For countries, extracts and displays only the largest landmass (excluding islands)
4. **Bilingual Support**: Accepts both Japanese and English names (50+ countries, 17+ Japanese islands mapped)
5. **Voice Input**: Integrated VoiceInputWidget with automatic submission after voice recognition
6. **Tutorial Widget**: First-time visitor tutorial using modal dialogs
7. **Pin Persistence**: Pin stays in place when overlaying multiple countries/islands

## Architecture

### File Structure

```
dev/
├── index.html              # Main HTML structure
├── app.js                  # Core application logic
├── voice-input-widget.js   # Voice recognition component
├── voice-input-widget.css  # Voice widget styles
├── tutorial-widget.js      # Tutorial modal component
├── tutorial-widget.css     # Tutorial modal styles
├── tutorial-config.json    # Tutorial page configuration
└── pages/                  # Tutorial content
    ├── page1.html         # Welcome page
    ├── page2.html         # Usage instructions
    └── page3.html         # Getting started
```

### Core Application Flow (app.js)

**Map Interaction:**
1. User clicks map → `placePin()` creates red marker at clicked location (app.js:380-401)
2. Pin's `centerMarker` variable persists between operations
3. Map click event listener at app.js:404-406

**Country/Island Display:**
1. User inputs name → `showCoastline()` called (app.js:226-330)
2. `translateName()` converts Japanese → English, determines type (island/country/unknown) (app.js:113-117)
3. If `centerMarker` exists, uses its position; else uses map center and creates pin (app.js:236-256)
4. Fetches GeoJSON from Nominatim API with rate limiting (1 second minimum between requests)
5. For countries: `extractMainlandFromGeoJSON()` filters to largest polygon using area calculation (app.js:141-168)
6. `centerGeoJSON()` transforms all coordinates to center on pin location (app.js:201-226)
7. Leaflet renders GeoJSON overlay with blue stroke

### Critical Implementation Details

**Pin Behavior (IMPORTANT):**
- When pin exists: MUST use `centerMarker.getLatLng()` for center coordinates
- When no pin: Create new pin at map center
- NEVER delete and recreate pin during `showCoastline()` - this causes unwanted movement
- Pin only moves when user clicks a new map location

**Coordinate Transformation:**
- GeoJSON uses `[lng, lat]` order (GeoJSON spec)
- Leaflet uses `{lat, lng}` object format
- `centerGeoJSON()` recursively shifts all nested coordinate arrays
- Simple offset transformation (no latitude-based longitude scaling - accepted trade-off)

**Name Translation Maps:**
- Islands: `islandNameMap` (app.js:26-44) - 17 Japanese islands, appends " Japan" to search query
- Countries: `countryNameMap` (app.js:47-110) - 50+ countries including small nations (Vatican, Monaco, San Marino, etc.)

**Nominatim API Integration:**
- Direct fetch to `https://nominatim.openstreetmap.org/search`
- Parameters: `q=${name}&format=json&polygon_geojson=1&limit=5`
- Returns up to 5 results, filters by `type`, `class`, `place_rank` for country-level results (app.js:309-325)
- Rate limiting: `MIN_REQUEST_INTERVAL = 1000ms` enforced with timestamp tracking
- **CORS Note**: Works from localhost/127.0.0.1, may fail from remote hosting without proxy

**Mainland Extraction Algorithm:**
- Uses Shoelace formula for polygon area calculation (app.js:120-138)
- Compares all polygons in MultiPolygon, selects largest by area
- Converts MultiPolygon → Polygon type for display
- Only applied to countries and unknown types, NOT islands

### Widget Integration

**VoiceInputWidget** (app.js:405-418):
- Hover-to-record trigger (fixed position, bottom-right)
- `onWordExtracted` callback auto-clicks display button after 100ms delay
- `extractNoun: false` - no Kuromoji.js noun extraction for short country names
- Requires HTTPS or localhost for Web Speech API

**TutorialWidget** (app.js:420-429):
- Initializes on `DOMContentLoaded` event
- LocalStorage key: `sekai-kurabe-tutorial-dismissed`
- Fetches tutorial pages from `tutorial-config.json`
- Three-page tutorial: Welcome → Usage → Getting Started
- Reset via: `TutorialWidget.reset('sekai-kurabe-tutorial-dismissed')`

## Event Handlers

Located at app.js:403-425:
- Map click: Place pin at clicked coordinates
- Show button: Trigger `showCoastline()` with input value
- Clear button: Remove all overlays, clear input, remove pin marker
- Location button: Use geolocation API to pan to user's current location
- Enter key on input: Trigger show button click

## Debug Logging

Extensive console.log statements track data flow (can be removed for production):
- Nominatim API responses and result selection (app.js:307-337)
- Mainland extraction process (app.js:352-354)
- Coordinate transformation (app.js:370-375)
- Pin position usage (app.js:240, 255)

## Known Limitations

1. **Latitude Distortion**: Simple offset doesn't account for latitude-based longitude scaling (intentional)
2. **CORS on Remote Hosting**: Direct Nominatim API calls may fail from non-localhost origins
3. **Single Landmass**: MultiPolygon countries only show largest continuous landmass
4. **Small Countries**: Very small nations (Vatican, Monaco) may appear as tiny dots at large zoom levels
5. **Rate Limiting**: 1-second delay enforced between API requests

## Modifying Tutorial Content

Tutorial pages are HTML fragments (NOT full HTML documents) in `pages/`:
- Edit `pages/page1.html`, `pages/page2.html`, `pages/page3.html` directly
- Can include inline styles, images (use relative paths like `pages/img/screenshot.png`)
- Changes take effect on next page load (after clearing LocalStorage)

## Testing Pin Functionality

Critical test case: Ensure pin doesn't move when displaying countries
1. Click map to place pin
2. Input country name
3. Click display
4. **Verify**: Pin stays at original clicked location, country overlays at that position
5. Input different country name
6. **Verify**: Pin still hasn't moved, new country overlays at same center

If pin moves, check that `showCoastline()` uses `centerMarker.getLatLng()` when marker exists.
