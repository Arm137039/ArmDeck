# Tauri Implementation for StreamDeck BLE

This document describes the implementation of Tauri functionality for the StreamDeck BLE application, allowing it to run as a desktop application with native BLE capabilities.

## Overview

The StreamDeck BLE application has been enhanced to work in two environments:
1. As a Progressive Web App (PWA) using Web Bluetooth API
2. As a desktop application using Tauri with native BLE capabilities

The implementation uses a unified approach that automatically selects the appropriate BLE implementation based on the runtime environment.

## Changes Made

### Tauri Configuration

1. Updated `tauri.conf.json` to enable dialog functionality for file operations
2. Added BLE-related dependencies to `Cargo.toml`
3. Created a Rust BLE module with Tauri commands

### React Application

1. Created a Tauri-specific BLE hook (`useTauriBle.ts`)
2. Created a unified BLE hook (`useBle.ts`) that selects the appropriate implementation
3. Updated the main App component to use the unified BLE hook
4. Added Tauri dependencies to `package.json`
5. Added Tauri-specific scripts to `package.json`

## Implementation Details

### Rust BLE Module

The Rust BLE module (`ble.rs`) implements the following functionality:
- Scanning for BLE devices
- Connecting to a device
- Disconnecting from a device
- Sending keymap data
- Sending commands
- Sending firmware chunks for updates
- Reading battery level

These functions are exposed as Tauri commands that can be called from the JavaScript code.

### React Hooks

#### useTauriBle

This hook provides BLE functionality through Tauri's API when running in a desktop environment. It:
- Checks if the app is running in a Tauri environment
- Provides functions for all BLE operations
- Manages state for connection status, battery level, etc.

#### useUnifiedBle

This hook provides a unified interface for BLE operations regardless of the environment. It:
- Detects whether the app is running in a Tauri environment
- Uses the appropriate implementation (Web Bluetooth or Tauri)
- Provides a consistent interface for the rest of the application

## Usage

### Development

To run the application in development mode:
- As a PWA: `npm run dev`
- As a Tauri app: `npm run tauri:dev`

### Building

To build the application for production:
- As a PWA: `npm run build`
- As a Tauri app: `npm run tauri:build`

## UUIDs

The application uses the following UUIDs for BLE communication:
- Service UUID: `00000000-0000-0000-0000-000000000000` (placeholder)
- Keymap Characteristic UUID: `00000001-0000-0000-0000-000000000000` (placeholder)
- Command Characteristic UUID: `00000002-0000-0000-0000-000000000000` (placeholder)
- Firmware Chunk Characteristic UUID: `00000003-0000-0000-0000-000000000000` (placeholder)
- Battery Characteristic UUID: `00000004-0000-0000-0000-000000000000` (placeholder)

**Note:** These UUIDs are placeholders and should be replaced with the actual UUIDs used by the StreamDeck BLE device.

## Future Improvements

1. Add error handling and retry mechanisms for BLE operations
2. Implement device selection UI when multiple devices are found
3. Add logging for debugging BLE issues
4. Add tests for BLE functionality
5. Optimize firmware update process