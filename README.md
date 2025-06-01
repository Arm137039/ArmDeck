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

# BLE Communication Protocol

## Overview

The ArmDeck Configuration Tool implements a custom binary protocol over Bluetooth Low Energy (BLE) using GATT characteristics for reliable communication with ESP32-based hardware. The protocol ensures data integrity through checksum validation and provides efficient configuration management for macro keyboard functionality.

## Protocol Architecture

### GATT Service Structure

The communication utilizes a dedicated GATT service with the following characteristics:

**Primary Service UUID**: `7a0b1000-0000-1000-8000-00805f9b34fb`

**Command Characteristic**: `fb349b5f-8000-0080-0010-000002100b7a`
- Properties: Read, Write
- Used for bidirectional command/response communication
- Maximum payload size: 255 bytes

### Packet Format

All communication follows a standardized binary packet structure:

```
┌─────────────┬─────────┬────────┬─────────────┬──────────┐
│ Magic Bytes │ Command │ Length │   Payload   │ Checksum │
│   (2 bytes) │ (1 byte)│(1 byte)│  (0-255)    │ (1 byte) │
├─────────────┼─────────┼────────┼─────────────┼──────────┤
│   0xAD 0xDC │  0x30   │  0x01  │ [button_id] │   XOR    │
└─────────────┴─────────┴────────┴─────────────┴──────────┘
```

**Field Descriptions:**
- **Magic Bytes**: Protocol identifier (0xAD, 0xDC)
- **Command**: Operation code defining the requested action
- **Length**: Payload size in bytes (0-255)
- **Payload**: Command-specific data
- **Checksum**: XOR checksum of all preceding bytes

### Command Set

| Command | Code | Description | Payload Structure | Response |
|---------|------|-------------|-------------------|----------|
| `GET_INFO` | 0x10 | Retrieve device information | None | Device metadata (22 bytes) |
| `GET_CONFIG` | 0x20 | Get global configuration | None | Configuration data |
| `SET_CONFIG` | 0x21 | Update global settings | Configuration structure | Status response |
| `GET_BUTTON` | 0x30 | Read button configuration | Button ID (1 byte) | Button data (16 bytes) |
| `SET_BUTTON` | 0x31 | Write button configuration | Button structure (16 bytes) | Status response |
| `TEST_BUTTON` | 0x32 | Trigger button test | Button ID (1 byte) | Status response |
| `RESET_CONFIG` | 0x52 | Factory reset | None | Status response |
| `RESTART` | 0xFF | Device restart | None | None |

### Data Structures

#### Device Information Response (22 bytes)
```c
struct device_info {
    uint8_t  protocol_version;    // Protocol version (1)
    uint8_t  firmware_major;      // Major version number
    uint8_t  firmware_minor;      // Minor version number  
    uint8_t  firmware_patch;      // Patch version number
    uint8_t  num_buttons;         // Number of available buttons (15)
    uint8_t  battery_level;       // Battery percentage (0-100)
    uint32_t uptime_seconds;      // Device uptime in seconds (little-endian)
    uint32_t free_heap;           // Available heap memory in bytes (little-endian)
    char     device_name[16];     // Device name (null-terminated)
};
```

#### Button Configuration Structure (16 bytes)
```c
struct button_config {
    uint8_t  button_id;     // Button index (0-14)
    uint8_t  action_type;   // Action category
    uint8_t  key_code;      // HID usage code or media control code
    uint8_t  modifier;      // Key modifier flags
    uint8_t  color_r;       // LED red component (0-255)
    uint8_t  color_g;       // LED green component (0-255)
    uint8_t  color_b;       // LED blue component (0-255)
    uint8_t  reserved;      // Reserved for future use
    char     label[8];      // Button display label (null-terminated)
};
```

#### Action Type Enumeration
```c
typedef enum {
    ACTION_NONE   = 0x00,    // Disabled button
    ACTION_KEY    = 0x01,    // Standard keyboard key
    ACTION_MEDIA  = 0x02,    // Media control (volume, brightness)
    ACTION_MACRO  = 0x03,    // Multi-key sequence
    ACTION_CUSTOM = 0x04     // User-defined action
} action_type_t;
```

## Communication Flow

### Connection Establishment
1. **Service Discovery**: Scan for ArmDeck GATT service
2. **Characteristic Access**: Connect to command characteristic
3. **Protocol Handshake**: Send GET_INFO command to verify compatibility
4. **Configuration Sync**: Retrieve current button configurations

### Command Execution Pattern
```
Client                                    Device
  |                                         |
  |------- Write Command Packet ----------->|
  |                                         |
  |<------ Process (450ms delay) -----------|
  |                                         |
  |------- Read Response Packet ----------->|
  |<------ Return Response Data ------------|
```

### Error Handling
- **Checksum Validation**: All packets verified using XOR checksum
- **Retry Logic**: Failed commands automatically retried with backoff
- **Timeout Management**: Commands timeout after 5 seconds
- **Connection Recovery**: Automatic reconnection on BLE disconnection

### Performance Optimizations
- **Timing Parameters**: Optimized delays for ESP32 processing requirements
- **Sequential Processing**: Button configurations loaded sequentially to prevent ESP32 overflow
- **Efficient Encoding**: Binary protocol minimizes bandwidth usage
- **State Caching**: Reduce redundant commands through intelligent caching

## Implementation Details

### JavaScript/TypeScript Integration
The protocol is implemented using the Web Bluetooth API with the following key components:

**Command Construction**:
```typescript
const buildCommand = (command: number, payload?: Uint8Array): Uint8Array => {
    const payloadLen = payload?.length || 0;
    const packet = new Uint8Array(4 + payloadLen + 1);
    
    packet[0] = 0xAD;                    // Magic byte 1
    packet[1] = 0xDC;                    // Magic byte 2
    packet[2] = command;                 // Command code
    packet[3] = payloadLen;              // Payload length
    
    if (payload) packet.set(payload, 4); // Payload data
    
    // XOR checksum of all preceding bytes
    packet[packet.length - 1] = packet.slice(0, -1).reduce((sum, byte) => sum ^ byte, 0);
    
    return packet;
};
```

**Response Parsing**:
```typescript
const parseResponse = (data: Uint8Array): ParsedResponse | null => {
    if (data.length < 5) return null;
    
    // Validate magic bytes
    if (data[0] !== 0xAD || data[1] !== 0xDC) return null;
    
    const command = data[2];
    const length = data[3];
    const payload = data.slice(4, 4 + length);
    const checksum = data[4 + length];
    
    // Verify checksum
    const calculatedChecksum = data.slice(0, 4 + length).reduce((sum, byte) => sum ^ byte, 0);
    if (checksum !== calculatedChecksum) return null;
    
    return { command, payload };
};
```

### Timing Configuration
Critical timing parameters for reliable communication:

```typescript
const BLE_TIMING = {
    ESP32_PROCESSING_DELAY: 300,    // ESP32 command processing time
    RETRY_DELAY: 100,               // Delay between retry attempts
    CONNECTION_WAIT: 2000,          // Initial connection stabilization
    BUTTON_LOAD_DELAY: 50,          // Delay between button queries
};
```

## Security Considerations

- **Encrypted Transport**: All communication occurs over encrypted BLE channels
- **Device Pairing**: Explicit user consent required for device access
- **Origin Restriction**: Web Bluetooth API restricted to HTTPS origins
- **Input Validation**: All received data validated before processing
- **Memory Safety**: Fixed-size buffers prevent overflow attacks

## License

[MIT](LICENSE)