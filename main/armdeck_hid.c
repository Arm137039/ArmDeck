#include "armdeck_hid.h"
#include "esp_log.h"
#include "hid_dev.h"
#include <string.h>

static const char* TAG = "ARMDECK_HID";

/* HID connection state */
static uint16_t hid_conn_id = 0;
static bool hid_connected = false;

/* Callback */
static esp_hidd_event_cb_t user_callback = NULL;

/* Internal callback wrapper */
static void hid_event_handler(esp_hidd_cb_event_t event, esp_hidd_cb_param_t *param) {
    switch(event) {
        case ESP_HIDD_EVENT_REG_FINISH:
            if (param->init_finish.state == ESP_HIDD_INIT_OK) {
                ESP_LOGI(TAG, "HID profile initialized successfully");
            } else {
                ESP_LOGE(TAG, "HID profile init failed");
            }
            break;
            
        case ESP_HIDD_EVENT_BLE_CONNECT:
            hid_conn_id = param->connect.conn_id;
            hid_connected = true;
            ESP_LOGI(TAG, "HID connected, conn_id=%d", hid_conn_id);
            
            /* Send initial empty report */
            armdeck_hid_send_empty();
            break;
            
        case ESP_HIDD_EVENT_BLE_DISCONNECT:
            ESP_LOGI(TAG, "HID disconnected");
            hid_connected = false;
            hid_conn_id = 0;
            break;
            
        default:
            break;
    }
    
    /* Forward to user callback if registered */
    if (user_callback) {
        user_callback(event, param);
    }
}

esp_err_t armdeck_hid_init(void) {
    ESP_LOGI(TAG, "Initializing HID profile...");
    
    esp_err_t ret = esp_hidd_profile_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to init HID profile: %s", esp_err_to_name(ret));
        return ret;
    }
    
    /* Register our internal callback */
    esp_hidd_register_callbacks(hid_event_handler);
    
    return ESP_OK;
}

esp_err_t armdeck_hid_send_key(uint8_t key_code, uint8_t modifiers, bool pressed) {
    if (!hid_connected || hid_conn_id == 0) {
        ESP_LOGW(TAG, "Cannot send key - not connected");
        return ESP_ERR_INVALID_STATE;
    }
    
    uint8_t key_report[8] = {0};
    
    if (pressed) {
        key_report[0] = modifiers;  /* Modifier keys */
        key_report[2] = key_code;   /* First key code */
    }
    /* If not pressed, report stays zero (key release) */
      esp_hidd_send_keyboard_value(hid_conn_id, 0, key_report, sizeof(key_report));
    
    ESP_LOGD(TAG, "Key %s: 0x%02x (mod:0x%02x)", 
            pressed ? "press" : "release", key_code, modifiers);
    
    return ESP_OK;
}

esp_err_t armdeck_hid_send_consumer(uint16_t usage_code, bool pressed) {
    if (!hid_connected || hid_conn_id == 0) {
        ESP_LOGW(TAG, "Cannot send consumer - not connected");
        return ESP_ERR_INVALID_STATE;
    }
    
    esp_hidd_send_consumer_value(hid_conn_id, (uint8_t)(usage_code & 0xFF), pressed);
    
    ESP_LOGD(TAG, "Consumer %s: 0x%04x", 
            pressed ? "press" : "release", usage_code);
    
    return ESP_OK;
}

esp_err_t armdeck_hid_send_empty(void) {
    if (!hid_connected || hid_conn_id == 0) {
        return ESP_ERR_INVALID_STATE;
    }
    
    uint8_t empty_report[8] = {0};
    esp_hidd_send_keyboard_value(hid_conn_id, 0, empty_report, sizeof(empty_report));
    return ESP_OK;
}

bool armdeck_hid_is_connected(void) {
    return hid_connected;
}

uint16_t armdeck_hid_get_conn_id(void) {
    return hid_conn_id;
}

void armdeck_hid_register_callback(esp_hidd_event_cb_t callback) {
    user_callback = callback;
}