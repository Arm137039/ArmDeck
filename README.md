# StreamDeck-BLE

A configuration tool for the StreamDeck-BLE, a 12-key controller based on ESP32-S3.

## Project Structure

```
streamdeck-web/
├── pwa/               # Vite + React + TypeScript + Sass frontend
│   ├── src/
│   │   ├── components/KeyGrid.tsx
│   │   ├── hooks/useBle.ts
│   │   └── styles/
│   │       └── main.scss
│   └── vite.config.ts
├── tauri/             # Desktop wrapper (Tauri)
└── README.md
```

## Features

- **KeyGrid**: 12-key grid (4x3) with drag-and-drop functionality for remapping keys
- **Web Bluetooth**: Connect to StreamDeck BLE device, read battery level, send commands
- **OTA Updates**: Send firmware updates in 20-byte chunks with progress tracking
- **Import/Export**: Save and load keymap configurations as JSON

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/) (v9 or later)
- [Rust](https://www.rust-lang.org/) (for Tauri desktop builds)
- [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

## Setup

### PWA (Progressive Web App)

1. Install dependencies:

```bash
cd pwa
npm install
```

2. Start development server:

```bash
npm run dev
```

3. Build for production:

```bash
npm run build
```

The built PWA will be available in the `pwa/dist` directory.

### Tauri (Desktop App)

1. Install dependencies:

```bash
cd tauri
npm install
```

2. Start development:

```bash
npm run dev
```

This will build the PWA and launch the Tauri development window.

3. Build for production:

```bash
npm run build
```

The built desktop app will be available in the `tauri/src-tauri/target/release` directory.

## Deployment

### PWA Deployment

To deploy the PWA to a web server:

1. Build the PWA:

```bash
cd pwa
npm run build
```

2. Upload the contents of the `pwa/dist` directory to your web server.

3. Ensure your web server is configured to serve the `index.html` file for all routes.

### Desktop App Distribution

To create a distributable package for the desktop app:

1. Build the Tauri app:

```bash
cd tauri
npm run build
```

2. The installer will be available in:
   - Windows: `tauri/src-tauri/target/release/bundle/msi/`
   - macOS: `tauri/src-tauri/target/release/bundle/dmg/`
   - Linux: `tauri/src-tauri/target/release/bundle/deb/` or `tauri/src-tauri/target/release/bundle/appimage/`

## Development

### Adding Icons

Replace the placeholder icons in `tauri/src-tauri/icons/` with your own icons:

- `32x32.png` (32x32 pixels)
- `128x128.png` (128x128 pixels)
- `128x128@2x.png` (256x256 pixels)
- `icon.icns` (macOS icon)
- `icon.ico` (Windows icon)

### Customizing BLE UUIDs

Update the UUIDs in `pwa/src/hooks/useBle.ts` with your device's actual UUIDs:

```typescript
const SERVICE_UUID = '00000000-0000-0000-0000-000000000000'; // Replace with actual UUID
const KEYMAP_CHARACTERISTIC_UUID = '00000001-0000-0000-0000-000000000000'; // Replace with actual UUID
const CMD_CHARACTERISTIC_UUID = '00000002-0000-0000-0000-000000000000'; // Replace with actual UUID
const FW_CHUNK_CHARACTERISTIC_UUID = '00000003-0000-0000-0000-000000000000'; // Replace with actual UUID
const BATTERY_CHARACTERISTIC_UUID = '00000004-0000-0000-0000-000000000000'; // Replace with actual UUID
```

## License

[MIT](LICENSE)