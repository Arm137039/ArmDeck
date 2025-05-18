#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod ble;

use std::sync::{Arc, Mutex};
use ble::BleState;

fn main() {
    // Initialize logging
    env_logger::init();

    // Create BLE state
    let ble_state = Arc::new(Mutex::new(BleState::new()));

    tauri::Builder::default()
        .manage(ble_state)
        .invoke_handler(tauri::generate_handler![
            ble::scan_for_devices,
            ble::connect_to_device,
            ble::disconnect_device,
            ble::send_keymap,
            ble::send_command,
            ble::send_firmware_chunk,
            ble::read_battery_level,
            ble::get_ble_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
