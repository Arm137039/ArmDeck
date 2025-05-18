use std::sync::{Arc, Mutex};
use std::time::Duration;
use btleplug::api::{Central, Characteristic, Manager as _, Peripheral as _, ScanFilter, WriteType};
use btleplug::platform::{Adapter, Manager, Peripheral};
use futures::stream::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use log::{debug, error, info};

// Define UUIDs for the BLE service and characteristics
const SERVICE_UUID: Uuid = Uuid::from_u128(0x00000000_0000_0000_0000_000000000000); // Replace with actual UUID
const KEYMAP_CHARACTERISTIC_UUID: Uuid = Uuid::from_u128(0x00000001_0000_0000_0000_000000000000); // Replace with actual UUID
const CMD_CHARACTERISTIC_UUID: Uuid = Uuid::from_u128(0x00000002_0000_0000_0000_000000000000); // Replace with actual UUID
const FW_CHUNK_CHARACTERISTIC_UUID: Uuid = Uuid::from_u128(0x00000003_0000_0000_0000_000000000000); // Replace with actual UUID
const BATTERY_CHARACTERISTIC_UUID: Uuid = Uuid::from_u128(0x00000004_0000_0000_0000_000000000000); // Replace with actual UUID

// Define types for our BLE device state
pub struct BleState {
    adapter: Option<Adapter>,
    device: Option<Peripheral>,
    characteristics: Characteristics,
    battery_level: u8,
}

struct Characteristics {
    keymap: Option<Characteristic>,
    cmd: Option<Characteristic>,
    fw_chunk: Option<Characteristic>,
    battery: Option<Characteristic>,
}

impl BleState {
    pub fn new() -> Self {
        BleState {
            adapter: None,
            device: None,
            characteristics: Characteristics {
                keymap: None,
                cmd: None,
                fw_chunk: None,
                battery: None,
            },
            battery_level: 0,
        }
    }
}

// Define response types for our Tauri commands
#[derive(Serialize, Deserialize)]
pub struct DeviceInfo {
    id: String,
    name: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct BleStatus {
    is_connected: bool,
    battery_level: Option<u8>,
}

// Initialize the BLE adapter
pub async fn initialize_ble() -> Result<Adapter, String> {
    let manager = Manager::new().await.map_err(|e| format!("Failed to initialize BLE manager: {}", e))?;
    let adapters = manager.adapters().await.map_err(|e| format!("Failed to get adapters: {}", e))?;
    
    if adapters.is_empty() {
        return Err("No Bluetooth adapters found".to_string());
    }
    
    Ok(adapters[0].clone())
}

// Scan for BLE devices
#[tauri::command]
pub async fn scan_for_devices(state: State<'_, Arc<Mutex<BleState>>>) -> Result<Vec<DeviceInfo>, String> {
    let mut state_guard = state.lock().map_err(|_| "Failed to lock state".to_string())?;
    
    // Initialize adapter if not already done
    if state_guard.adapter.is_none() {
        state_guard.adapter = Some(initialize_ble().await?);
    }
    
    let adapter = state_guard.adapter.as_ref().unwrap();
    
    // Start scanning
    adapter.start_scan(ScanFilter::default()).await.map_err(|e| format!("Failed to start scan: {}", e))?;
    
    // Wait for devices to be discovered
    tokio::time::sleep(Duration::from_secs(5)).await;
    
    // Get discovered devices
    let peripherals = adapter.peripherals().await.map_err(|e| format!("Failed to get peripherals: {}", e))?;
    
    // Stop scanning
    adapter.stop_scan().await.map_err(|e| format!("Failed to stop scan: {}", e))?;
    
    // Convert peripherals to DeviceInfo
    let mut devices = Vec::new();
    for peripheral in peripherals {
        let properties = peripheral.properties().await.map_err(|e| format!("Failed to get properties: {}", e))?;
        let device_info = DeviceInfo {
            id: peripheral.id().to_string(),
            name: properties.and_then(|p| p.local_name),
        };
        
        // Only include devices with "StreamDeck" in the name or with our service UUID
        if let Some(name) = &device_info.name {
            if name.contains("StreamDeck") {
                devices.push(device_info);
                continue;
            }
        }
        
        // Check if device has our service
        if let Ok(services) = peripheral.services().await {
            if services.iter().any(|s| s.uuid == SERVICE_UUID) {
                devices.push(device_info);
            }
        }
    }
    
    Ok(devices)
}

// Connect to a BLE device
#[tauri::command]
pub async fn connect_to_device(device_id: String, state: State<'_, Arc<Mutex<BleState>>>) -> Result<BleStatus, String> {
    let mut state_guard = state.lock().map_err(|_| "Failed to lock state".to_string())?;
    
    // Initialize adapter if not already done
    if state_guard.adapter.is_none() {
        state_guard.adapter = Some(initialize_ble().await?);
    }
    
    let adapter = state_guard.adapter.as_ref().unwrap();
    
    // Get peripherals
    let peripherals = adapter.peripherals().await.map_err(|e| format!("Failed to get peripherals: {}", e))?;
    
    // Find the device with the matching ID
    let device = peripherals.into_iter()
        .find(|p| p.id().to_string() == device_id)
        .ok_or_else(|| "Device not found".to_string())?;
    
    // Connect to the device
    device.connect().await.map_err(|e| format!("Failed to connect: {}", e))?;
    
    // Discover services
    device.discover_services().await.map_err(|e| format!("Failed to discover services: {}", e))?;
    
    // Get the service
    let services = device.services().await.map_err(|e| format!("Failed to get services: {}", e))?;
    let service = services.iter()
        .find(|s| s.uuid == SERVICE_UUID)
        .ok_or_else(|| "Service not found".to_string())?;
    
    // Get characteristics
    let keymap_char = service.characteristics.iter()
        .find(|c| c.uuid == KEYMAP_CHARACTERISTIC_UUID)
        .cloned();
    
    let cmd_char = service.characteristics.iter()
        .find(|c| c.uuid == CMD_CHARACTERISTIC_UUID)
        .cloned();
    
    let fw_chunk_char = service.characteristics.iter()
        .find(|c| c.uuid == FW_CHUNK_CHARACTERISTIC_UUID)
        .cloned();
    
    let battery_char = service.characteristics.iter()
        .find(|c| c.uuid == BATTERY_CHARACTERISTIC_UUID)
        .cloned();
    
    // Store the device and characteristics
    state_guard.device = Some(device.clone());
    state_guard.characteristics = Characteristics {
        keymap: keymap_char,
        cmd: cmd_char,
        fw_chunk: fw_chunk_char,
        battery: battery_char,
    };
    
    // Read battery level if available
    let battery_level = if let Some(battery_char) = &state_guard.characteristics.battery {
        if let Ok(data) = device.read(battery_char).await {
            if !data.is_empty() {
                let level = data[0];
                state_guard.battery_level = level;
                Some(level)
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };
    
    Ok(BleStatus {
        is_connected: true,
        battery_level,
    })
}

// Disconnect from the BLE device
#[tauri::command]
pub async fn disconnect_device(state: State<'_, Arc<Mutex<BleState>>>) -> Result<BleStatus, String> {
    let mut state_guard = state.lock().map_err(|_| "Failed to lock state".to_string())?;
    
    if let Some(device) = &state_guard.device {
        device.disconnect().await.map_err(|e| format!("Failed to disconnect: {}", e))?;
        state_guard.device = None;
        state_guard.characteristics = Characteristics {
            keymap: None,
            cmd: None,
            fw_chunk: None,
            battery: None,
        };
        state_guard.battery_level = 0;
    }
    
    Ok(BleStatus {
        is_connected: false,
        battery_level: None,
    })
}

// Send keymap to the device
#[tauri::command]
pub async fn send_keymap(keymap: String, state: State<'_, Arc<Mutex<BleState>>>) -> Result<(), String> {
    let state_guard = state.lock().map_err(|_| "Failed to lock state".to_string())?;
    
    let device = state_guard.device.as_ref().ok_or_else(|| "Device not connected".to_string())?;
    let keymap_char = state_guard.characteristics.keymap.as_ref().ok_or_else(|| "Keymap characteristic not available".to_string())?;
    
    device.write(keymap_char, keymap.as_bytes(), WriteType::WithResponse)
        .await
        .map_err(|e| format!("Failed to send keymap: {}", e))?;
    
    Ok(())
}

// Send command to the device
#[tauri::command]
pub async fn send_command(command: String, state: State<'_, Arc<Mutex<BleState>>>) -> Result<(), String> {
    let state_guard = state.lock().map_err(|_| "Failed to lock state".to_string())?;
    
    let device = state_guard.device.as_ref().ok_or_else(|| "Device not connected".to_string())?;
    let cmd_char = state_guard.characteristics.cmd.as_ref().ok_or_else(|| "Command characteristic not available".to_string())?;
    
    device.write(cmd_char, command.as_bytes(), WriteType::WithResponse)
        .await
        .map_err(|e| format!("Failed to send command: {}", e))?;
    
    Ok(())
}

// Send firmware chunk to the device
#[tauri::command]
pub async fn send_firmware_chunk(chunk: Vec<u8>, state: State<'_, Arc<Mutex<BleState>>>, window: tauri::Window) -> Result<(), String> {
    let state_guard = state.lock().map_err(|_| "Failed to lock state".to_string())?;
    
    let device = state_guard.device.as_ref().ok_or_else(|| "Device not connected".to_string())?;
    let fw_chunk_char = state_guard.characteristics.fw_chunk.as_ref().ok_or_else(|| "Firmware chunk characteristic not available".to_string())?;
    
    // Assuming we're sending chunks of 20 bytes as specified in the requirements
    const CHUNK_SIZE: usize = 20;
    let total_chunks = (chunk.len() + CHUNK_SIZE - 1) / CHUNK_SIZE; // Ceiling division
    
    for i in 0..total_chunks {
        let start = i * CHUNK_SIZE;
        let end = std::cmp::min(start + CHUNK_SIZE, chunk.len());
        let chunk_part = &chunk[start..end];
        
        device.write(fw_chunk_char, chunk_part, WriteType::WithResponse)
            .await
            .map_err(|e| format!("Failed to send firmware chunk: {}", e))?;
        
        // Update progress
        let percent = ((i + 1) * 100) / total_chunks;
        window.emit("ota-progress", percent).map_err(|e| format!("Failed to emit progress: {}", e))?;
        
        // Small delay to prevent overwhelming the device
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    
    Ok(())
}

// Read battery level from the device
#[tauri::command]
pub async fn read_battery_level(state: State<'_, Arc<Mutex<BleState>>>) -> Result<Option<u8>, String> {
    let mut state_guard = state.lock().map_err(|_| "Failed to lock state".to_string())?;
    
    if let (Some(device), Some(battery_char)) = (&state_guard.device, &state_guard.characteristics.battery) {
        let data = device.read(battery_char).await.map_err(|e| format!("Failed to read battery level: {}", e))?;
        
        if !data.is_empty() {
            let level = data[0];
            state_guard.battery_level = level;
            Ok(Some(level))
        } else {
            Ok(None)
        }
    } else {
        Ok(None)
    }
}

// Get current BLE status
#[tauri::command]
pub fn get_ble_status(state: State<'_, Arc<Mutex<BleState>>>) -> Result<BleStatus, String> {
    let state_guard = state.lock().map_err(|_| "Failed to lock state".to_string())?;
    
    Ok(BleStatus {
        is_connected: state_guard.device.is_some(),
        battery_level: if state_guard.device.is_some() { Some(state_guard.battery_level) } else { None },
    })
}