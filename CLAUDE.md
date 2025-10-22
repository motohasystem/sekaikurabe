# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**セカイクラベ (Sekai Kurabe)** - "世界比べ - 国の大きさ、感じてみたい？"

A web application that overlays country and Japanese island coastline shapes on OpenStreetMap at the current map view center. Users can input country or island names (in Japanese or English) via text or voice input, and the application displays the actual coastline boundary centered on the current map position for size comparison.

## Key Features

1. **Coastline Overlay**: Displays GeoJSON coastline data from Nominatim API centered on current map view
2. **Mainland Extraction**: For countries, extracts and displays only the largest landmass (excluding islands)
3. **Bilingual Support**: Accepts both Japanese and English names (50+ countries, 17+ Japanese islands mapped)
4. **Voice Input**: Integrated VoiceInputWidget with automatic submission after voice recognition
5. **Center Pin Marker**: Red pin marks the center point where overlays are positioned

## Architecture

### Core Components

**index.html**
- Single-page application structure
- Leaflet.js map integration (CDN)
- VoiceInputWidget UI integration
- Control panel with input field and action buttons

**app.js** - Main application logic with key functions:

1. **Name Translation** (`translateName()` at line 106)
   - Maps Japanese → English names
   - Determines type: 'island', 'country', or 'unknown'

2. **Mainland Extraction** (`extractMainlandFromGeoJSON()` at line 141)
   - Calculates polygon areas using Shoelace formula
   - Extracts largest polygon from MultiPolygon for countries
   - Returns single Polygon GeoJSON

3. **Coordinate Transformation** (`centerGeoJSON()` at line 201)
   - Calculates current GeoJSON center
   - Computes offset to target center
   - Recursively shifts all coordinates

4. **API Integration** (`showCoastline()` at line 229)
   - Rate limiting: 1 second minimum between requests
   - Fetches from Nominatim API with GeoJSON polygon data
   - Processes based on type (island = full shape, country = mainland only)
   - Centers on current map view
   - Adds red center pin marker

**voice-input-widget.js**
- Standalone component for Web Speech API integration
- Hover-to-record interface
- Optional Kuromoji.js noun extraction (disabled for this app)
- Callback support for auto-submission

### Data Flow

1. User inputs country/island name (text or voice)
2. `translateName()` converts to English and determines type
3. `showCoastline()` fetches GeoJSON from Nominatim API
4. For countries: `extractMainlandFromGeoJSON()` filters to largest polygon
5. `centerGeoJSON()` transforms coordinates to current map center
6. Leaflet renders GeoJSON as overlay with blue stroke

### Name Mapping

**Islands** (line 26-44): Maps 17 Japanese islands to English names, search includes "Japan" suffix
**Countries** (line 47-103): Maps 50+ country names from Japanese to English

## API Usage

**Nominatim API**
- Endpoint: `https://nominatim.openstreetmap.org/search`
- Parameters: `q=${name}&format=json&polygon_geojson=1&limit=1`
- Rate limit: 1 second between requests (enforced in code)
- Returns: Array with `geojson` field containing Polygon or MultiPolygon

**CORS Handling**
- Currently using direct fetch to Nominatim API (app.js:277)
- Works from local development server (127.0.0.1)
- May encounter CORS issues on GitHub Pages or remote hosting
- Previous attempts with CORS proxies (allorigins.win, corsproxy.io) failed with 403 errors

## Known Limitations

1. **Latitude Distortion**: Simple offset transformation doesn't account for latitude-based longitude scaling (intentional trade-off)
2. **CORS Restrictions**: Direct API access may fail from remote hosting environments
3. **Single Landmass**: MultiPolygon countries only show largest continuous landmass
4. **Rate Limiting**: 1 second delay between requests to respect Nominatim usage policy

## Development Notes

- No build process required - pure HTML/CSS/JavaScript
- Open `index.html` in browser or use local development server
- VoiceInputWidget requires HTTPS or localhost for Web Speech API
- Test voice input with Japanese country/island names for best results
- Kuromoji.js referenced but not loaded (extractNoun: false in widget config)

## Code Patterns

**Coordinate Handling**: All GeoJSON uses `[lng, lat]` order (GeoJSON spec)
**Polygon Area Calculation**: Uses simplified Shoelace formula (sufficient for comparison)
**Error Display**: `showStatus(message, isError)` updates status div with appropriate styling
**Layer Management**: `coastlineLayers[]` array stores all overlays for bulk clearing
