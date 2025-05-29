#ifndef ARMDECK_HID_H
#define ARMDECK_HID_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"
#include "esp_hidd_prf_api.h"

/* HID report types */
typedef enum {
    HID_REPORT_KEYBOARD,
    HID_REPORT_CONSUMER,
} hid_report_type_t;

/* Initialize HID profile */
esp_err_t armdeck_hid_init(void);

/* Send keyboard key */
esp_err_t armdeck_hid_send_key(uint8_t key_code, uint8_t modifiers, bool pressed);

/* Send consumer control (media keys) */
esp_err_t armdeck_hid_send_consumer(uint16_t usage_code, bool pressed);

/* Send empty report (for keep-alive) */
esp_err_t armdeck_hid_send_empty(void);

/* Get connection status */
bool armdeck_hid_is_connected(void);

/* Get connection ID */
uint16_t armdeck_hid_get_conn_id(void);

/* HID event callback */
void armdeck_hid_register_callback(esp_hidd_event_cb_t callback);

#endif /* ARMDECK_HID_H */