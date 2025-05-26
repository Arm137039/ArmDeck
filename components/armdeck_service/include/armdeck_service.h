#ifndef ARMDECK_SERVICE_H
#define ARMDECK_SERVICE_H

#include "esp_gatts_api.h"
#include "esp_gatt_defs.h"
#include "esp_gap_ble_api.h"

/* 🔥 UUIDS CORRIGÉS POUR CHROME WEB BLUETOOTH */

// Device Information Service - Web Bluetooth compatible
// Using standard Bluetooth UUIDs for maximum compatibility
#define DEVICE_INFO_SERVICE_UUID    0x180A  // Device Information Service
#define MANUFACTURER_NAME_CHAR_UUID 0x2A29  // Manufacturer Name String
#define MODEL_NUMBER_CHAR_UUID      0x2A24  // Model Number String
#define FIRMWARE_REV_CHAR_UUID      0x2A26  // Firmware Revision String

// Custom ArmDeck Service - Format UUID correct pour Chrome
// Service UUID: 7a0b1000-0000-1000-8000-00805f9b34fb
#define ARMDECK_CUSTOM_SERVICE_UUID128 {0x7a, 0x0b, 0x10, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb}

// Caractéristiques ArmDeck - UUIDs corrigés
// Keymap: 7a0b1001-0000-1000-8000-00805f9b34fb
#define ARMDECK_KEYMAP_CHAR_UUID128 {0x7a, 0x0b, 0x10, 0x01, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb}

// Command: 7a0b1002-0000-1000-8000-00805f9b34fb
#define ARMDECK_COMMAND_CHAR_UUID128 {0x7a, 0x0b, 0x10, 0x02, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb}

// Firmware (futur OTA): 7a0b1003-0000-1000-8000-00805f9b34fb
#define ARMDECK_FIRMWARE_CHAR_UUID128 {0x7a, 0x0b, 0x10, 0x03, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb}

// Battery: 7a0b1004-0000-1000-8000-00805f9b34fb
#define ARMDECK_BATTERY_CHAR_UUID128 {0x7a, 0x0b, 0x10, 0x04, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb}

// Aliases pour compatibilité avec ancien code
#define ARMDECK_BUTTON_CHAR_UUID128 ARMDECK_KEYMAP_CHAR_UUID128  
#define ARMDECK_CONFIG_CHAR_UUID128 ARMDECK_COMMAND_CHAR_UUID128  

// Configuration structures
#define MAX_KEYMAP_SIZE          512
#define MAX_COMMAND_SIZE         64
#define MAX_FIRMWARE_CHUNK_SIZE  256

// Structure for button configuration
typedef struct {
    uint8_t button_id;         // Unique button ID
    uint8_t action_type;       // Action type (keys, media, macro, etc.)
    uint8_t key_code[8];       // Key codes or other parameters
    char label[16];            // Display text
    uint32_t color;            // RGB color for button
} button_config_t;

// Structure for complete configuration
typedef struct {
    uint8_t version;                // Configuration version
    uint8_t num_buttons;            // Number of configured buttons
    button_config_t buttons[16];    // Configuration for each button (max 16)
} keymap_config_t;

// Initialize the ArmDeck BLE service
esp_err_t armdeck_init_service(void);

// Callback functions to handle connection events
void armdeck_on_connect(uint16_t conn_id);
void armdeck_on_disconnect(void);

// Update device information
void armdeck_update_device_info(const char* new_info);

// Send button event to client
void armdeck_send_button_event(uint8_t button_id, bool pressed);

// Update battery level and send notification
void armdeck_update_battery_level(uint8_t level);

// Apply new configuration received
esp_err_t armdeck_apply_keymap(keymap_config_t *config);

// Execute received command
esp_err_t armdeck_execute_command(uint8_t *command_data, uint16_t length);

#endif /* ARMDECK_SERVICE_H */