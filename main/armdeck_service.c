#include "armdeck_service.h"
#include "armdeck_protocol.h"
#include "armdeck_hid.h"
#include "esp_log.h"
#include <string.h>

static const char* TAG = "ARMDECK_SERVICE";

/* Service handles */
static uint16_t service_handle = 0;
static uint16_t command_char_handle = 0;
static uint16_t command_char_val_handle = 0;
static uint16_t keymap_char_handle = 0;
static uint16_t keymap_char_val_handle = 0;

/* Connection info */
static uint16_t conn_id = 0xFFFF;
static esp_gatt_if_t gatts_if = ESP_GATT_IF_NONE;

/* Service creation state */
typedef enum {
    SERVICE_STATE_IDLE,
    SERVICE_STATE_CREATING,
    SERVICE_STATE_STARTING,
    SERVICE_STATE_READY
} service_state_t;

static service_state_t service_state = SERVICE_STATE_IDLE;

/* UUIDs */
static uint8_t service_uuid[16] = ARMDECK_CUSTOM_SERVICE_UUID128;
static uint8_t command_uuid[16] = ARMDECK_COMMAND_CHAR_UUID128;
static uint8_t keymap_uuid[16] = ARMDECK_KEYMAP_CHAR_UUID128;

/* Characteristic properties */
static const uint16_t primary_service_uuid = ESP_GATT_UUID_PRI_SERVICE;
static const uint16_t character_declaration_uuid = ESP_GATT_UUID_CHAR_DECLARE;
static const uint8_t char_prop_read_write_notify = ESP_GATT_CHAR_PROP_BIT_READ | 
                                                   ESP_GATT_CHAR_PROP_BIT_WRITE |
                                                   ESP_GATT_CHAR_PROP_BIT_NOTIFY;

/* Attribute values */
static const uint8_t command_ccc[2] = {0x00, 0x00};
static uint8_t command_value[256] = {0};
static uint8_t keymap_value[256] = {0};

esp_err_t armdeck_service_init(void) {
    ESP_LOGI(TAG, "Initializing ArmDeck service");
    service_state = SERVICE_STATE_IDLE;
    return ESP_OK;
}

static void create_service(esp_gatt_if_t gatts_if_param) {
    ESP_LOGI(TAG, "Creating ArmDeck custom service");
    
    /* Log the service UUID being used */
    ESP_LOGI(TAG, "Service UUID: %02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
             service_uuid[15], service_uuid[14], service_uuid[13], service_uuid[12],
             service_uuid[11], service_uuid[10], service_uuid[9], service_uuid[8],
             service_uuid[7], service_uuid[6], service_uuid[5], service_uuid[4],
             service_uuid[3], service_uuid[2], service_uuid[1], service_uuid[0]);
    
    gatts_if = gatts_if_param;
    service_state = SERVICE_STATE_CREATING;
    
    esp_gatt_srvc_id_t service_id = {
        .is_primary = true,
        .id = {
            .inst_id = 0,
            .uuid = {
                .len = ESP_UUID_LEN_128,
                .uuid = {.uuid128 = {0}}
            }
        }
    };
    
    memcpy(service_id.id.uuid.uuid.uuid128, service_uuid, 16);
    
    esp_err_t ret = esp_ble_gatts_create_service(gatts_if, &service_id, 16);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to create service: %s", esp_err_to_name(ret));
        service_state = SERVICE_STATE_IDLE;
    }
}

static void add_characteristics(void) {
    ESP_LOGI(TAG, "Adding characteristics");
    
    /* Add command characteristic */
    esp_bt_uuid_t command_char_uuid = {
        .len = ESP_UUID_LEN_128,
        .uuid = {.uuid128 = {0}}
    };
    memcpy(command_char_uuid.uuid.uuid128, command_uuid, 16);
    
    /* Log the UUID being used */
    ESP_LOGI(TAG, "Command characteristic UUID: %02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
             command_uuid[15], command_uuid[14], command_uuid[13], command_uuid[12],
             command_uuid[11], command_uuid[10], command_uuid[9], command_uuid[8],
             command_uuid[7], command_uuid[6], command_uuid[5], command_uuid[4],
             command_uuid[3], command_uuid[2], command_uuid[1], command_uuid[0]);
    
    esp_err_t ret = esp_ble_gatts_add_char(
        service_handle,
        &command_char_uuid,
        ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE,
        ESP_GATT_CHAR_PROP_BIT_READ | ESP_GATT_CHAR_PROP_BIT_WRITE | ESP_GATT_CHAR_PROP_BIT_NOTIFY,
        NULL,
        NULL
    );
    
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to add command characteristic: %s", esp_err_to_name(ret));
    }
}

void armdeck_service_gatts_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if_param,
                                   esp_ble_gatts_cb_param_t *param) {
    switch (event) {
        case ESP_GATTS_REG_EVT:
            if (param->reg.status == ESP_GATT_OK) {
                ESP_LOGI(TAG, "GATTS registered, creating service");
                create_service(gatts_if_param);
            }
            break;
            
        case ESP_GATTS_CREATE_EVT:
            if (param->create.status == ESP_GATT_OK) {
                service_handle = param->create.service_handle;
                ESP_LOGI(TAG, "Service created, handle: %d", service_handle);
                service_state = SERVICE_STATE_STARTING;
                esp_ble_gatts_start_service(service_handle);
            }
            break;
            
        case ESP_GATTS_START_EVT:
            if (param->start.status == ESP_GATT_OK) {
                ESP_LOGI(TAG, "Service started");
                add_characteristics();
            }
            break;        
        case ESP_GATTS_ADD_CHAR_EVT:
            if (param->add_char.status == ESP_GATT_OK) {
                if (command_char_handle == 0) {
                    command_char_handle = param->add_char.attr_handle;
                    command_char_val_handle = command_char_handle + 1;
                    ESP_LOGI(TAG, "Command characteristic added: %d", command_char_handle);
                      /* Add keymap characteristic */
                    esp_bt_uuid_t keymap_char_uuid = {
                        .len = ESP_UUID_LEN_128,
                        .uuid = {.uuid128 = {0}}
                    };
                    memcpy(keymap_char_uuid.uuid.uuid128, keymap_uuid, 16);
                    
                    esp_ble_gatts_add_char(
                        service_handle,
                        &keymap_char_uuid,
                        ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE,
                        ESP_GATT_CHAR_PROP_BIT_READ | ESP_GATT_CHAR_PROP_BIT_WRITE,
                        NULL,
                        NULL
                    );
                } else {
                    keymap_char_handle = param->add_char.attr_handle;
                    keymap_char_val_handle = keymap_char_handle + 1;
                    ESP_LOGI(TAG, "Keymap characteristic added: %d", keymap_char_handle);
                    service_state = SERVICE_STATE_READY;
                    ESP_LOGI(TAG, "ArmDeck service ready!");
                }
            }
            break;
            
        case ESP_GATTS_WRITE_EVT:
            ESP_LOGI(TAG, "Write event: handle=%d, len=%d", param->write.handle, param->write.len);
            
            if (param->write.handle == command_char_val_handle) {
                /* Handle command */
                uint8_t response[256];
                uint16_t response_len = 0;
                
                esp_err_t ret = armdeck_protocol_handle_command(
                    param->write.value,
                    param->write.len,
                    response,
                    &response_len
                );
                
                if (ret == ESP_OK && response_len > 0) {
                    /* Send response as notification */
                    esp_ble_gatts_send_indicate(
                        gatts_if,
                        param->write.conn_id,
                        command_char_val_handle,
                        response_len,
                        response,
                        false  /* notification, not indication */
                    );
                }
            } else if (param->write.handle == keymap_char_val_handle) {
                /* Handle keymap write */
                ESP_LOGI(TAG, "Keymap write received");
                if (param->write.len <= sizeof(keymap_value)) {
                    memcpy(keymap_value, param->write.value, param->write.len);
                } else {
                    ESP_LOGE(TAG, "Keymap write too large: %d", param->write.len);
                }
            }
              /* Always send response if needed */
            if (param->write.need_rsp) {
                esp_err_t ret = esp_ble_gatts_send_response(gatts_if, param->write.conn_id,
                                           param->write.trans_id, ESP_GATT_OK, NULL);
                if (ret != ESP_OK) {
                    ESP_LOGE(TAG, "Failed to send write response: %s", esp_err_to_name(ret));
                } else {
                    ESP_LOGI(TAG, "✅ Write response sent successfully");
                }            }break;
        case ESP_GATTS_READ_EVT:
            ESP_LOGI(TAG, "Read event: handle=%d", param->read.handle);
            
            esp_gatt_rsp_t rsp = {0};
            rsp.attr_value.handle = param->read.handle;
            
            if (param->read.handle == command_char_val_handle) {
                rsp.attr_value.len = sizeof(command_value);
                memcpy(rsp.attr_value.value, command_value, rsp.attr_value.len);
            } else if (param->read.handle == keymap_char_val_handle) {
                rsp.attr_value.len = sizeof(keymap_value);
                memcpy(rsp.attr_value.value, keymap_value, rsp.attr_value.len);
            }
            
            esp_ble_gatts_send_response(gatts_if, param->read.conn_id, param->read.trans_id, ESP_GATT_OK, &rsp);
            break;        case ESP_GATTS_CONNECT_EVT:
            conn_id = param->connect.conn_id;
            ESP_LOGI(TAG, "Device connected: conn_id=%d", conn_id);
            
            /* Force HID connection since Windows connects to custom service but not HID service */
            armdeck_hid_force_connected(conn_id);
            break;
            
        case ESP_GATTS_DISCONNECT_EVT:
            conn_id = 0xFFFF;
            ESP_LOGI(TAG, "Device disconnected");
            break;
            
        default:
            break;
    }
}

bool armdeck_service_is_ready(void) {
    return service_state == SERVICE_STATE_READY;
}

esp_err_t armdeck_service_send_notification(const uint8_t* data, uint16_t len) {
    if (conn_id == 0xFFFF || gatts_if == ESP_GATT_IF_NONE) {
        return ESP_ERR_INVALID_STATE;
    }
    
    return esp_ble_gatts_send_indicate(
        gatts_if,
        conn_id,
        command_char_val_handle,
        len,
        (uint8_t*)data,
        false  /* notification, not indication */
    );
}

uint16_t armdeck_service_get_conn_id(void) {
    return conn_id;
}

esp_gatt_if_t armdeck_service_get_gatts_if(void) {
    return gatts_if;
}