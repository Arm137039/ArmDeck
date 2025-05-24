/*
 * ArmDeck – Version STABLE qui marche + Device Info pour Chrome
 * Retour à la base fonctionnelle avec ajout progressif
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_bt.h"
#include "esp_timer.h"

#include "esp_hidd_prf_api.h"
#include "esp_bt_defs.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "esp_gatt_defs.h"
#include "esp_bt_main.h"
#include "esp_bt_device.h"
#include "hid_dev.h"

#include "armdeck_service.h"
#include "armdeck_common.h"

#define ARMDECK_TAG "ARMDECK_MAIN"
#define HIDD_DEVICE_NAME "ArmDeck"

/* ---------- Global state ---------- */
uint16_t hid_conn_id = 0;
static bool sec_conn = false;
bool ble_connected = false;
esp_timer_handle_t keep_alive_timer = NULL;
static bool device_info_service_initialized = false;

/* ---------- Forward declarations ---------- */
static void delayed_device_info_task(void *param);

/* ---------- Tâche d'initialisation différée ---------- */
static void delayed_device_info_task(void *param) {
    ESP_LOGI(ARMDECK_TAG, "Waiting 30 seconds for stable HID connection...");
    vTaskDelay(30000 / portTICK_PERIOD_MS);  // 30 secondes pour être sûr
    
    if (ble_connected) {
        ESP_LOGI(ARMDECK_TAG, "HID stable, adding Device Info service for Chrome...");
        esp_err_t ret = armdeck_init_service();
        if (ret == ESP_OK) {
            device_info_service_initialized = true;
            ESP_LOGI(ARMDECK_TAG, "✅ Device Info service added - Chrome should see this now!");
        } else {
            ESP_LOGE(ARMDECK_TAG, "❌ Device Info service failed: %s", esp_err_to_name(ret));
        }
    } else {
        ESP_LOGW(ARMDECK_TAG, "HID disconnected before Device Info init");
    }
    
    vTaskDelete(NULL);
}

/* ---------- HID Keep-alive ---------- */
void send_hid_keep_alive(void) {
    if (ble_connected && hid_conn_id != 0) {
        uint8_t empty_report[8] = {0};
        esp_hidd_send_keyboard_value(hid_conn_id, 0, empty_report, 0);
        ESP_LOGI(ARMDECK_TAG, "Keep-alive sent");
    } else {
        ESP_LOGW(ARMDECK_TAG, "Keep-alive skipped: connected=%d, conn_id=%d", ble_connected, hid_conn_id);
        stop_keep_alive();
    }
}

/* ---------- Advertising SIMPLE et STABLE ---------- */
static esp_ble_adv_data_t hidd_adv_data = {
    .set_scan_rsp = false,
    .include_name = true,
    .include_txpower = false,
    .min_interval = 0x0020,     // 20ms
    .max_interval = 0x0040,     // 40ms
    .appearance = 0x03c0,       // HID Generic
    .manufacturer_len = 0,
    .p_manufacturer_data = NULL,
    .service_data_len = 0,
    .p_service_data = NULL,
    .service_uuid_len = 0,      // PAS d'UUIDs pour garder la stabilité
    .p_service_uuid = NULL,
    .flag = 0x6,
};

static esp_ble_adv_params_t hidd_adv_params = {
    .adv_int_min        = 0x0020,   // 20ms
    .adv_int_max        = 0x0040,   // 40ms
    .adv_type           = ADV_TYPE_IND,
    .own_addr_type      = BLE_ADDR_TYPE_PUBLIC,
    .channel_map        = ADV_CHNL_ALL,
    .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

/* ---------- Keep-alive timer stable ---------- */
#define KEEP_ALIVE_PERIOD_US (2ULL * 1000 * 1000) // 2 secondes comme avant

static void keep_alive_timer_callback(void *arg) {
    send_hid_keep_alive();
}

void start_keep_alive(void) {
    if (!keep_alive_timer) {
        esp_timer_create_args_t timer_args = {
            .callback = keep_alive_timer_callback,
            .name = "keep_alive_timer"
        };
        esp_err_t ret = esp_timer_create(&timer_args, &keep_alive_timer);
        if (ret != ESP_OK) {
            ESP_LOGE(ARMDECK_TAG, "Failed to create keep-alive timer: %s", esp_err_to_name(ret));
            return;
        }
    }
    
    esp_timer_stop(keep_alive_timer);
    esp_err_t ret = esp_timer_start_periodic(keep_alive_timer, KEEP_ALIVE_PERIOD_US);
    if (ret == ESP_OK) {
        ESP_LOGI(ARMDECK_TAG, "Keep-alive timer started (2s interval)");
    } else {
        ESP_LOGE(ARMDECK_TAG, "Failed to start keep-alive timer: %s", esp_err_to_name(ret));
    }
}

void stop_keep_alive(void) {
    if (keep_alive_timer) {
        esp_timer_stop(keep_alive_timer);
        esp_timer_delete(keep_alive_timer);
        keep_alive_timer = NULL;
        ESP_LOGI(ARMDECK_TAG, "Keep-alive timer stopped");
    }
}

/* ---------- HID Event Callback STABLE ---------- */
static void hidd_event_callback(esp_hidd_cb_event_t event, esp_hidd_cb_param_t *param)
{
    switch(event) {
        case ESP_HIDD_EVENT_REG_FINISH: {
            if (param->init_finish.state == ESP_HIDD_INIT_OK) {
                ESP_LOGI(ARMDECK_TAG, "HID profile initialized");
                
                esp_err_t name_ret = esp_ble_gap_set_device_name(HIDD_DEVICE_NAME);
                ESP_LOGI(ARMDECK_TAG, "Device name set: %s", esp_err_to_name(name_ret));
                
                esp_err_t adv_ret = esp_ble_gap_config_adv_data(&hidd_adv_data);
                ESP_LOGI(ARMDECK_TAG, "Advertising configured: %s", esp_err_to_name(adv_ret));
            }
            break;
        }
        
        case ESP_BAT_EVENT_REG: {
            ESP_LOGI(ARMDECK_TAG, "Battery service registered");
            break;
        }
        
        case ESP_HIDD_EVENT_BLE_CONNECT: {
            ESP_LOGI(ARMDECK_TAG, "🟢 HID CONNECTED");
            hid_conn_id = param->connect.conn_id;
            ble_connected = true;
            
            // Rapport initial
            uint8_t empty_report[8] = {0};
            esp_hidd_send_keyboard_value(hid_conn_id, 0, empty_report, 0);
            ESP_LOGI(ARMDECK_TAG, "Initial HID report sent");
            
            // Keep-alive après délai
            vTaskDelay(1000 / portTICK_PERIOD_MS);
            start_keep_alive();
            
            // Device Info service SEULEMENT après 30 secondes de stabilité HID
            if (!device_info_service_initialized) {
                ESP_LOGI(ARMDECK_TAG, "Scheduling Device Info service (30s delay for stability)");
                xTaskCreate(delayed_device_info_task, "delayed_device_info", 3072, NULL, 3, NULL);
            }
            
            ESP_LOGI(ARMDECK_TAG, "🎉 HID connected! Device Info will be added after 30s");
            
            break;
        }
        
        case ESP_HIDD_EVENT_BLE_DISCONNECT: {
            ESP_LOGI(ARMDECK_TAG, "🔴 HID DISCONNECTED");
            
            // Nettoyage complet
            sec_conn = false;
            ble_connected = false;
            hid_conn_id = 0;
            device_info_service_initialized = false;  // Reset pour permettre re-init
            
            stop_keep_alive();
            armdeck_on_disconnect();
            
            // Redémarrer advertising
            vTaskDelay(1000 / portTICK_PERIOD_MS);
            esp_ble_gap_start_advertising(&hidd_adv_params);
            ESP_LOGI(ARMDECK_TAG, "🔄 Advertising restarted");
            break;
        }
        
        case ESP_HIDD_EVENT_BLE_VENDOR_REPORT_WRITE_EVT: {
            ESP_LOGI(ARMDECK_TAG, "Vendor report write");
            break;
        }
        
        case ESP_HIDD_EVENT_BLE_LED_REPORT_WRITE_EVT: {
            ESP_LOGI(ARMDECK_TAG, "LED report write");
            break;
        }
        
        default:
            break;
    }
}

/* ---------- GAP Event Callback STABLE ---------- */
static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param)
{
    switch (event) {
    case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
        ESP_LOGI(ARMDECK_TAG, "Advertising data set, status=%d", param->adv_data_cmpl.status);
        if (param->adv_data_cmpl.status == ESP_BT_STATUS_SUCCESS) {
            esp_err_t ret = esp_ble_gap_start_advertising(&hidd_adv_params);
            ESP_LOGI(ARMDECK_TAG, "Start advertising: %s", esp_err_to_name(ret));
        }
        break;
        
    case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
        if (param->adv_start_cmpl.status == ESP_BT_STATUS_SUCCESS) {
            ESP_LOGI(ARMDECK_TAG, "✅ Advertising started - ArmDeck discoverable");
        } else {
            ESP_LOGE(ARMDECK_TAG, "❌ Advertising failed");
        }
        break;
        
    case ESP_GAP_BLE_SEC_REQ_EVT:
        ESP_LOGI(ARMDECK_TAG, "Security request");
        esp_ble_gap_security_rsp(param->ble_security.ble_req.bd_addr, true);
        break;
        
    case ESP_GAP_BLE_AUTH_CMPL_EVT:
        sec_conn = param->ble_security.auth_cmpl.success;
        ESP_LOGI(ARMDECK_TAG, "Authentication %s", sec_conn ? "✅ SUCCESS" : "❌ FAILED");
        if (!sec_conn) {
            ESP_LOGE(ARMDECK_TAG, "Auth failure reason: 0x%x", param->ble_security.auth_cmpl.fail_reason);
        }
        break;
        
    case ESP_GAP_BLE_UPDATE_CONN_PARAMS_EVT:
        ESP_LOGI(ARMDECK_TAG, "Connection params: min=%d, max=%d, latency=%d, timeout=%d", 
                 param->update_conn_params.min_int,
                 param->update_conn_params.max_int,
                 param->update_conn_params.latency,
                 param->update_conn_params.timeout);
        break;
        
    default:
        break;
    }
}

/* ---------- Status Task ---------- */
static void status_task(void *pvParameters)
{
    uint32_t count = 0;
    while(1) {
        ESP_LOGI(ARMDECK_TAG, "[%u] 🔗 HID: %s | 🔐 Secure: %s | 📱 Device Info: %s | 💾 Heap: %u",
                 (unsigned int)count++,
                 ble_connected ? "CONNECTED" : "DISCONNECTED",
                 sec_conn ? "YES" : "NO",
                 device_info_service_initialized ? "READY" : "PENDING",
                 (unsigned int)esp_get_free_heap_size());
        
        vTaskDelay(30000 / portTICK_PERIOD_MS);
    }
}

/* ---------- Main Application ---------- */
void app_main(void)
{
    esp_err_t ret;

    ESP_LOGI(ARMDECK_TAG, "🚀 === ArmDeck STABLE + Chrome Compatible ===");
    ESP_LOGI(ARMDECK_TAG, "🎯 Strategy: HID first (stable), then Device Info after 30s");

    // NVS
    ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // BT Controller
    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));
    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_bt_controller_init(&bt_cfg));
    ESP_ERROR_CHECK(esp_bt_controller_enable(ESP_BT_MODE_BLE));

    // Bluedroid
    ESP_ERROR_CHECK(esp_bluedroid_init());
    ESP_ERROR_CHECK(esp_bluedroid_enable());

    // HID Profile (priorité absolue)
    ESP_ERROR_CHECK(esp_hidd_profile_init());
    ESP_LOGI(ARMDECK_TAG, "✅ HID profile initialized");

    // Callbacks
    esp_ble_gap_register_callback(gap_event_handler);
    esp_hidd_register_callbacks(hidd_event_callback);

    // Sécurité conservative
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

    // Timer keep-alive
    const esp_timer_create_args_t timer_args = {
        .callback = keep_alive_timer_callback,
        .name = "keep_alive"
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &keep_alive_timer));

    // Tâche de statut
    xTaskCreate(&status_task, "status_task", 3072, NULL, 3, NULL);

    ESP_LOGI(ARMDECK_TAG, "🎉 === ArmDeck Ready ===");
    ESP_LOGI(ARMDECK_TAG, "📱 HID will work normally");
    ESP_LOGI(ARMDECK_TAG, "🌐 Device Info service will be added after stable connection");
    ESP_LOGI(ARMDECK_TAG, "⏰ Chrome visibility after 30s of stable HID connection");
}