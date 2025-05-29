#ifndef ARMDECK_SERVICE_H
#define ARMDECK_SERVICE_H

#include "esp_gatts_api.h"
#include "esp_gatt_defs.h"
#include "esp_gap_ble_api.h"
#include <stdint.h>
#include <stdbool.h>

/* Custom ArmDeck Service UUIDs - Little-endian format for ESP32 internal use */
// Service UUID: 7a0b1000-0000-1000-8000-00805f9b34fb
#define ARMDECK_CUSTOM_SERVICE_UUID128 {0xfb, 0x34, 0x9b, 0x5f, 0x80, 0x00, 0x00, 0x80, 0x00, 0x10, 0x00, 0x00, 0x00, 0x10, 0x0b, 0x7a}

// Command characteristic: fb349b5f-8000-0080-0010-000002100b7a (little-endian)
#define ARMDECK_COMMAND_CHAR_UUID128 {0x7a, 0x0b, 0x10, 0x02, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb}

// Keymap characteristic: fb349b5f-8000-0080-0010-000001100b7a (little-endian)
#define ARMDECK_KEYMAP_CHAR_UUID128 {0x7a, 0x0b, 0x10, 0x01, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb}

/* Initialize the ArmDeck BLE service */
esp_err_t armdeck_service_init(void);

/* GATTS event handler - must be called from main GATTS callback */
void armdeck_service_gatts_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if,
                                   esp_ble_gatts_cb_param_t *param);

/* Check if service is ready */
bool armdeck_service_is_ready(void);

/* Send notification on command characteristic */
esp_err_t armdeck_service_send_notification(const uint8_t* data, uint16_t len);

/* Get current connection ID */
uint16_t armdeck_service_get_conn_id(void);

/* Get GATTS interface */
esp_gatt_if_t armdeck_service_get_gatts_if(void);

#endif /* ARMDECK_SERVICE_H */