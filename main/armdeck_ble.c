#include "armdeck_ble.h"
#include "armdeck_service.h"
#include "esp_log.h"
#include "esp_bt_device.h"
#include <string.h>

static const char* TAG = "ARMDECK_BLE";

/* Advertising state */
static ble_adv_state_t adv_state = BLE_ADV_STOPPED;

/* Callbacks */
static esp_gap_ble_cb_t user_gap_callback = NULL;
static esp_gatts_cb_t user_gatts_callback = NULL;

/* GATTS interface */
static esp_gatt_if_t gatts_if = ESP_GATT_IF_NONE;

/* Service UUIDs for advertising - Big-endian format matching service definition */
static uint8_t armdeck_service_uuid[16] = {0x7a, 0x0b, 0x10, 0x00, 0x00, 0x00, 0x10, 0x00,
                                           0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb};

/* Advertising data - minimal for size compliance */
static esp_ble_adv_data_t adv_data = {
    .set_scan_rsp = false,
    .include_name = true,
    .include_txpower = false,
    .min_interval = 0x0020,  // 20ms
    .max_interval = 0x0040,  // 40ms
    .appearance = 0x03C1,    // HID Keyboard
    .manufacturer_len = 0,
    .p_manufacturer_data = NULL,
    .service_data_len = 0,
    .p_service_data = NULL,
    .service_uuid_len = 0,   // Remove UUID from main adv to save space
    .p_service_uuid = NULL,
    .flag = (ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT),
};

/* Scan response data - include service UUID here */
static esp_ble_adv_data_t scan_rsp_data = {
    .set_scan_rsp = true,
    .include_name = false,
    .include_txpower = false,
    .service_uuid_len = 16,
    .p_service_uuid = armdeck_service_uuid,
    .manufacturer_len = 0,
    .p_manufacturer_data = NULL,
    .service_data_len = 0,
    .p_service_data = NULL,
};

/* Advertising parameters */
static esp_ble_adv_params_t adv_params = {
    .adv_int_min = 0x0020,
    .adv_int_max = 0x0040,
    .adv_type = ADV_TYPE_IND,
    .own_addr_type = BLE_ADDR_TYPE_PUBLIC,
    .channel_map = ADV_CHNL_ALL,
    .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

/* State for configuration sequence */
static bool adv_data_configured = false;
static bool scan_rsp_configured = false;

/* GAP event handler */
static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param) {
    switch (event) {
        case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
            if (param->adv_data_cmpl.status == ESP_BT_STATUS_SUCCESS) {
                ESP_LOGI(TAG, "Advertising data set");
                adv_data_configured = true;
                
                /* Start advertising only when both are configured */
                if (adv_data_configured && scan_rsp_configured) {
                    esp_err_t ret = esp_ble_gap_start_advertising(&adv_params);
                    if (ret == ESP_OK) {
                        adv_state = BLE_ADV_STARTING;
                    } else {
                        ESP_LOGE(TAG, "Failed to start advertising: %s", esp_err_to_name(ret));
                        adv_state = BLE_ADV_STOPPED;
                    }
                }
            }
            break;
            
        case ESP_GAP_BLE_SCAN_RSP_DATA_SET_COMPLETE_EVT:
            if (param->scan_rsp_data_cmpl.status == ESP_BT_STATUS_SUCCESS) {
                ESP_LOGI(TAG, "Scan response data set");
                scan_rsp_configured = true;
                
                /* Start advertising only when both are configured */
                if (adv_data_configured && scan_rsp_configured) {
                    esp_err_t ret = esp_ble_gap_start_advertising(&adv_params);
                    if (ret == ESP_OK) {
                        adv_state = BLE_ADV_STARTING;
                    } else {
                        ESP_LOGE(TAG, "Failed to start advertising: %s", esp_err_to_name(ret));
                        adv_state = BLE_ADV_STOPPED;
                    }
                }
            }
            break;
            
        case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
            if (param->adv_start_cmpl.status == ESP_BT_STATUS_SUCCESS) {
                adv_state = BLE_ADV_STARTED;
                ESP_LOGI(TAG, "Advertising started successfully");
            } else {
                adv_state = BLE_ADV_STOPPED;
                ESP_LOGE(TAG, "Advertising failed to start");
            }
            break;
            
        case ESP_GAP_BLE_ADV_STOP_COMPLETE_EVT:
            adv_state = BLE_ADV_STOPPED;
            ESP_LOGI(TAG, "Advertising stopped");
            break;
            
        default:
            break;
    }
    
    /* Forward to user callback */
    if (user_gap_callback) {
        user_gap_callback(event, param);
    }
}

/* GATTS event handler */
static void gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if_param,
                                esp_ble_gatts_cb_param_t *param) {
    /* Store interface ID */
    if (event == ESP_GATTS_REG_EVT && param->reg.status == ESP_GATT_OK) {
        gatts_if = gatts_if_param;
    }
    
    /* Forward to service handler */
    armdeck_service_gatts_handler(event, gatts_if_param, param);
    
    /* Forward to user callback */
    if (user_gatts_callback) {
        user_gatts_callback(event, gatts_if_param, param);
    }
}

esp_err_t armdeck_ble_init(void) {
    ESP_LOGI(TAG, "Initializing BLE");
    
    /* Register callbacks */
    esp_err_t ret = esp_ble_gap_register_callback(gap_event_handler);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to register GAP callback: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ret = esp_ble_gatts_register_callback(gatts_event_handler);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to register GATTS callback: %s", esp_err_to_name(ret));
        return ret;
    }
    
    /* Initialize custom service */
    ret = armdeck_service_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize service: %s", esp_err_to_name(ret));
        return ret;
    }
    
    /* Register GATTS application for custom service */
    ret = esp_ble_gatts_app_register(0x55);  // App ID for ArmDeck service
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to register GATTS app: %s", esp_err_to_name(ret));
        return ret;
    }
    
    return ESP_OK;
}

esp_err_t armdeck_ble_start_advertising(void) {
    if (adv_state != BLE_ADV_STOPPED) {
        ESP_LOGW(TAG, "Advertising already active");
        return ESP_ERR_INVALID_STATE;
    }
    
    ESP_LOGI(TAG, "Starting advertising");
    
    /* Reset configuration flags */
    adv_data_configured = false;
    scan_rsp_configured = false;
    
    /* Configure advertising data first */
    esp_err_t ret = esp_ble_gap_config_adv_data(&adv_data);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure adv data: %s", esp_err_to_name(ret));
        return ret;
    }
    
    /* Configure scan response data */
    ret = esp_ble_gap_config_adv_data(&scan_rsp_data);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure scan rsp data: %s", esp_err_to_name(ret));
        return ret;
    }
    
    adv_state = BLE_ADV_STARTING;
    return ESP_OK;
}

esp_err_t armdeck_ble_stop_advertising(void) {
    if (adv_state != BLE_ADV_STARTED) {
        ESP_LOGW(TAG, "Advertising not active");
        return ESP_ERR_INVALID_STATE;
    }
    
    ESP_LOGI(TAG, "Stopping advertising");
    
    esp_err_t ret = esp_ble_gap_stop_advertising();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to stop advertising: %s", esp_err_to_name(ret));
        return ret;
    }
    
    return ESP_OK;
}

ble_adv_state_t armdeck_ble_get_adv_state(void) {
    return adv_state;
}

void armdeck_ble_register_gap_callback(esp_gap_ble_cb_t callback) {
    user_gap_callback = callback;
}

void armdeck_ble_register_gatts_callback(esp_gatts_cb_t callback) {
    user_gatts_callback = callback;
}