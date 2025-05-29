#ifndef ARMDECK_BLE_H
#define ARMDECK_BLE_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"

#define ARMDECK_DEVICE_NAME "ArmDeck"

/* BLE advertising state */
typedef enum {
    BLE_ADV_STOPPED,
    BLE_ADV_STARTING,
    BLE_ADV_STARTED,
} ble_adv_state_t;

/* Initialize BLE stack */
esp_err_t armdeck_ble_init(void);

/* Start advertising */
esp_err_t armdeck_ble_start_advertising(void);

/* Stop advertising */
esp_err_t armdeck_ble_stop_advertising(void);

/* Get advertising state */
ble_adv_state_t armdeck_ble_get_adv_state(void);

/* Register GAP callback */
void armdeck_ble_register_gap_callback(esp_gap_ble_cb_t callback);

/* Register GATTS callback */
void armdeck_ble_register_gatts_callback(esp_gatts_cb_t callback);

#endif /* ARMDECK_BLE_H */