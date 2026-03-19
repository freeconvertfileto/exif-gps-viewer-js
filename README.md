# EXIF GPS Viewer

Parse EXIF metadata and GPS coordinates from JPEG images using a custom binary parser, entirely in the browser.

**Live Demo:** https://file-converter-free.com/en/image-tools/exif-gps-viewer-online

## How It Works

The tool reads the file as an `ArrayBuffer` and manually walks the JPEG binary structure. It locates the APP1 marker (`0xFFE1`), reads the TIFF header to determine byte order (little-endian `II` or big-endian `MM`), then iterates through IFD (Image File Directory) entries by tag ID. Tag `0x8825` points to the GPS Sub-IFD containing latitude, longitude, altitude, and timestamp. Tag `0x8769` points to the Exif Sub-IFD with camera settings. Rational values (type 5 and 10) are decoded by dividing numerator by denominator. GPS DMS (degrees/minutes/seconds) coordinates in rational format are converted to decimal degrees via `deg + min/60 + sec/3600`. A Google Maps link is generated from the decimal coordinates.

## Features

- Custom binary EXIF parser — no external library required
- Reads GPS Sub-IFD (tag 0x8825): latitude, longitude, altitude, timestamp
- Reads Exif Sub-IFD (tag 0x8769): camera make, model, focal length, ISO, shutter speed, aperture
- Handles both little-endian and big-endian TIFF byte orders
- GPS DMS rational to decimal degree conversion
- Generates Google Maps link from GPS coordinates

## Browser APIs Used

- FileReader API (`readAsArrayBuffer`)
- DataView for byte-order-aware multi-byte reads

## Code Structure

| File | Description |
|------|-------------|
| `exif-gps-viewer.js` | IIFE — JPEG APP1/TIFF binary walker, IFD tag parsing, rational decoding, GPS DMS conversion |

## Usage

| Element ID | Purpose |
|------------|---------|
| `dropZone` | Drag-and-drop target for JPEG image |
| `fileInput` | File picker input |
| `gpsLat` | Decoded GPS latitude in decimal degrees |
| `gpsLon` | Decoded GPS longitude in decimal degrees |
| `gpsAlt` | Decoded GPS altitude |
| `mapsLink` | Generated Google Maps link for the GPS location |
| `exifTable` | Table of all decoded EXIF fields |

## License

MIT
