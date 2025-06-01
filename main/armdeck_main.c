/*
 * ArmDeck - Stream Deck 4x3 with Button Matrix
 * Main application file
 */

#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_bt.h"
#include "esp_bt_main.h"
#include "esp_timer.h"

/* ArmDeck modules */
#include "armdeck_common.h"
#include "armdeck_config.h"
#include "armdeck_ble.h"
#include "armdeck_hid.h"
#include "armdeck_service.h"
#include "button_matrix.h"
#include "armdeck_protocol.h"

static const char* TAG = "ARMDECK_MAIN";

/* Global variables */
bool ble_connected = false;
uint16_t hid_conn_id = 0;
esp_timer_handle_t keep_alive_timer = NULL;

/* Keep-alive timer period (15 seconds) */
#define KEEP_ALIVE_PERIOD_US (15ULL * 1000 * 1000)

/* Keep-alive implementation */
void send_hid_keep_alive(void) {
    if (armdeck_hid_is_connected()) {
        armdeck_hid_send_empty();
        ESP_LOGD(TAG, "Keep-alive sent");
    }
}

static void keep_alive_timer_callback(void *arg) {
    send_hid_keep_alive();
}

void start_keep_alive(void) {
    if (!keep_alive_timer) {
        esp_timer_create_args_t timer_args = {
            .callback = keep_alive_timer_callback,
            .name = "keep_alive"
        };
        esp_timer_create(&timer_args, &keep_alive_timer);
    }
    
    esp_timer_stop(keep_alive_timer);
    esp_timer_start_periodic(keep_alive_timer, KEEP_ALIVE_PERIOD_US);
    ESP_LOGI(TAG, "Keep-alive timer started");
}

void stop_keep_alive(void) {
    if (keep_alive_timer) {
        esp_timer_stop(keep_alive_timer);
        ESP_LOGI(TAG, "Keep-alive timer stopped");
    }
}

/* Update global connection state for monitoring */
void armdeck_main_set_connected(bool connected, uint16_t conn_id) {
    ble_connected = connected;
    hid_conn_id = conn_id;
    
    if (connected) {
        start_keep_alive();
        ESP_LOGI(TAG, "Global connection state updated: CONNECTED (conn_id=%d)", conn_id);
    } else {
        stop_keep_alive();
        ESP_LOGI(TAG, "Global connection state updated: DISCONNECTED");
    }
}

/* Button event handler */
static void handle_button_event(uint8_t button_id, bool pressed) {
    const armdeck_button_t* button = armdeck_protocol_get_button_config(button_id);
    if (!button) {
        ESP_LOGE(TAG, "Invalid button ID: %d", button_id);
        return;
    }
    
    ESP_LOGI(TAG, "Button %d (%s) %s", 
             button_id + 1, button->label, pressed ? "pressed" : "released");
    
    if (!armdeck_hid_is_connected()) {
        ESP_LOGW(TAG, "HID not connected, ignoring button event");
        return;
    }
      /* Send HID report based on action type */
    switch (button->action_type) {
        case ACTION_NONE:
            ESP_LOGI(TAG, "Button disabled (ACTION_NONE), ignoring");
            break;
            
        case ACTION_KEY:
            armdeck_hid_send_key(button->key_code, button->modifier, pressed);
            break;
            
        case ACTION_MEDIA:
            armdeck_hid_send_consumer(button->key_code, pressed);
            break;
            
        case ACTION_MACRO:
            /* TODO: Implement macro support */
            ESP_LOGW(TAG, "Macro not implemented yet");
            break;
            
        default:
            ESP_LOGW(TAG, "Unknown action type: %d", button->action_type);
            break;
    }
}

/* HID event handler */
static void hid_event_handler(esp_hidd_cb_event_t event, esp_hidd_cb_param_t *param) {
    switch(event) {
        case ESP_HIDD_EVENT_BLE_CONNECT:
            armdeck_main_set_connected(true, param->connect.conn_id);
            ESP_LOGI(TAG, "Device connected and ready!");
            break;
            
        case ESP_HIDD_EVENT_BLE_DISCONNECT:
            armdeck_main_set_connected(false, 0);
            ESP_LOGI(TAG, "Device disconnected");
            
            /* Restart advertising after delay */
            vTaskDelay(pdMS_TO_TICKS(1000));
            armdeck_ble_start_advertising();
            break;
            
        default:
            break;
    }
}

/* GATTS event handler for custom service */
static void gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, 
                               esp_ble_gatts_cb_param_t *param) {
    static uint16_t command_handle = 0;
    
    switch (event) {
        case ESP_GATTS_WRITE_EVT:
            if (param->write.handle == command_handle && param->write.len > 0) {
                ESP_LOGI(TAG, "Command received (%d bytes)", param->write.len);
                
                uint8_t response[256];
                uint16_t response_len = 0;
                
                /* Handle command using protocol module */
                esp_err_t ret = armdeck_protocol_handle_command(
                    param->write.value, param->write.len,
                    response, &response_len
                );
                
                if (ret == ESP_OK && response_len > 0) {
                    /* Send response via notification */
                    esp_ble_gatts_send_indicate(gatts_if, param->write.conn_id, 
                                               command_handle, response_len, 
                                               response, false);
                }
            }
            
            if (param->write.need_rsp) {
                esp_ble_gatts_send_response(gatts_if, param->write.conn_id, 
                                           param->write.trans_id, ESP_GATT_OK, NULL);
            }
            break;
            
        case ESP_GATTS_ADD_CHAR_EVT:
            /* Store command characteristic handle */
            if (param->add_char.char_uuid.len == ESP_UUID_LEN_128) {
                uint8_t command_uuid[16] = ARMDECK_COMMAND_CHAR_UUID128;
                if (memcmp(param->add_char.char_uuid.uuid.uuid128, command_uuid, 16) == 0) {
                    command_handle = param->add_char.attr_handle;
                    ESP_LOGI(TAG, "Command characteristic handle: %d", command_handle);
                }
            }
            break;
            
        default:
            break;
    }
}

/* GAP event handler */
static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param) {
    switch (event) {
        case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
            if (param->adv_start_cmpl.status == ESP_BT_STATUS_SUCCESS) {
                ESP_LOGI(TAG, "Advertising started - device visible as '%s'", ARMDECK_DEVICE_NAME);
            } else {
                ESP_LOGE(TAG, "Advertising start failed: %d", param->adv_start_cmpl.status);
            }
            break;
            
        case ESP_GAP_BLE_SEC_REQ_EVT:
            /* Accept pairing request */
            esp_ble_gap_security_rsp(param->ble_security.ble_req.bd_addr, true);
            break;        case ESP_GAP_BLE_AUTH_CMPL_EVT:
            ESP_LOGI(TAG, "Authentication %s", 
                     param->ble_security.auth_cmpl.success ? "success" : "failed");
            break;
            
        default:
            break;
    }
}

/* Status monitoring task */
static void status_task(void *pvParameters) {
    uint32_t count = 0;
    
    while(1) {
        ESP_LOGI(TAG, "[%lu] Connected: %s | Advertising: %s | Heap: %lu KB",
                 count++,
                 ble_connected ? "YES" : "NO",
                 armdeck_ble_get_adv_state() == BLE_ADV_STARTED ? "YES" : "NO",
                 esp_get_free_heap_size() / 1024);
        
        vTaskDelay(pdMS_TO_TICKS(30000)); /* Every 30 seconds */
    }
}

void app_main(void) {
    esp_err_t ret;
      ESP_LOGI(TAG, "=== ArmDeck Stream Deck Starting ===");
    ESP_LOGI(TAG, "Version: 1.2.0");
    ESP_LOGI(TAG, "Buttons: 5x3 matrix (15 total)");
    
    /* Initialize NVS */
    ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    
    /* Initialize Bluetooth */
    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));
    
    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_bt_controller_init(&bt_cfg));
    ESP_ERROR_CHECK(esp_bt_controller_enable(ESP_BT_MODE_BLE));
    ESP_ERROR_CHECK(esp_bluedroid_init());
    ESP_ERROR_CHECK(esp_bluedroid_enable());
    
    /* Set device name */
    esp_ble_gap_set_device_name(ARMDECK_DEVICE_NAME);
    
    /* Configure security */
    esp_ble_auth_req_t auth_req = ESP_LE_AUTH_BOND;
    esp_ble_io_cap_t iocap = ESP_IO_CAP_NONE;
    uint8_t key_size = 16;
    uint8_t init_key = ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK;
    uint8_t rsp_key = ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK;
    
    esp_ble_gap_set_security_param(ESP_BLE_SM_AUTHEN_REQ_MODE, &auth_req, sizeof(uint8_t));
    esp_ble_gap_set_security_param(ESP_BLE_SM_IOCAP_MODE, &iocap, sizeof(uint8_t));
    esp_ble_gap_set_security_param(ESP_BLE_SM_MAX_KEY_SIZE, &key_size, sizeof(uint8_t));
    esp_ble_gap_set_security_param(ESP_BLE_SM_SET_INIT_KEY, &init_key, sizeof(uint8_t));
    esp_ble_gap_set_security_param(ESP_BLE_SM_SET_RSP_KEY, &rsp_key, sizeof(uint8_t));
      /* Initialize modules */
    ESP_ERROR_CHECK(armdeck_config_init());
    ESP_ERROR_CHECK(armdeck_matrix_init());
    ESP_ERROR_CHECK(armdeck_hid_init());
    ESP_ERROR_CHECK(armdeck_ble_init());
    
    /* Register callbacks */
    armdeck_matrix_set_callback(handle_button_event);
    armdeck_hid_register_callback(hid_event_handler);
    armdeck_ble_register_gap_callback(gap_event_handler);
    armdeck_ble_register_gatts_callback(gatts_event_handler);
    
    /* Start services */
    ESP_ERROR_CHECK(armdeck_matrix_start());
    ESP_ERROR_CHECK(armdeck_ble_start_advertising());
    
    /* Create status monitoring task */
    xTaskCreate(status_task, "status", 2048, NULL, 1, NULL);
    
    ESP_LOGI(TAG, "=== ArmDeck Ready ===");
    ESP_LOGI(TAG, "Connect via Bluetooth to start using");
}