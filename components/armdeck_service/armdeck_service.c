// armdeck_service.c - Version ultra-minimale pour Chrome Web Bluetooth
// SEULEMENT Device Information Service pour être visible dans Chrome

#include <string.h>
#include "esp_log.h"
#include "esp_bt.h"
#include "esp_bt_main.h"
#include "esp_gatts_api.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "armdeck_service.h"
#include "armdeck_common.h"

#define ARMDECK_TAG "ARMDECK_SVC"

// Variables pour le service Device Information seulement
static uint16_t device_info_svc_handle = 0;
static uint16_t manufacturer_char_handle = 0;
static esp_gatt_if_t armdeck_gatts_if = ESP_GATT_IF_NONE;
static uint16_t armdeck_conn_id = 0xFFFF;

// Variables externes
extern bool ble_connected;
extern void stop_keep_alive(void);

// Valeurs du Device Information Service
static uint8_t manufacturer_name_value[] = "ArmDeck Technologies";
// Note: model_number_value et firmware_revision_value supprimés car non utilisés dans cette version minimale

// État simple - juste Device Info
typedef enum {
    SERVICE_CREATION_NONE,
    SERVICE_CREATION_DEVICE_INFO,
    SERVICE_CREATION_COMPLETE
} service_creation_state_t;

static service_creation_state_t creation_state = SERVICE_CREATION_NONE;

// Déclaration anticipée
static void armdeck_gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param);

// Initialiser SEULEMENT le service Device Information (minimum pour Chrome)
esp_err_t armdeck_init_service(void)
{
    esp_err_t status;
    
    ESP_LOGI(ARMDECK_TAG, "Starting MINIMAL ArmDeck service (Device Info only for Chrome)");
    
    // Enregistrer le callback
    status = esp_ble_gatts_register_callback(armdeck_gatts_event_handler);
    if (status != ESP_OK) {
        ESP_LOGE(ARMDECK_TAG, "GATTS register error: %s", esp_err_to_name(status));
        return status;
    }
    
    // Enregistrer le profil d'application
    status = esp_ble_gatts_app_register(0x55);
    if (status != ESP_OK) {
        ESP_LOGE(ARMDECK_TAG, "GATTS app register error: %s", esp_err_to_name(status));
        return status;
    }
    
    ESP_LOGI(ARMDECK_TAG, "Minimal ArmDeck service registration started");
    return ESP_OK;
}

// Gestionnaire d'événements ultra-simple
static void armdeck_gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param)
{
    switch (event) {
        case ESP_GATTS_REG_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_REG_EVT, status %d, app_id %d", param->reg.status, param->reg.app_id);
            if (param->reg.status == ESP_GATT_OK && param->reg.app_id == 0x55) {
                armdeck_gatts_if = gatts_if;
                creation_state = SERVICE_CREATION_DEVICE_INFO;
                
                // Créer SEULEMENT le Device Information Service (0x180A)
                esp_gatt_srvc_id_t service_id = {0};
                service_id.is_primary = true;
                service_id.id.inst_id = 0;
                service_id.id.uuid.len = ESP_UUID_LEN_16;
                service_id.id.uuid.uuid.uuid16 = 0x180A;  // Device Information Service
                
                esp_err_t ret = esp_ble_gatts_create_service(gatts_if, &service_id, 6);
                ESP_LOGI(ARMDECK_TAG, "Creating Device Information service: %s", esp_err_to_name(ret));
            }
            break;

        case ESP_GATTS_CREATE_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_CREATE_EVT, status %d, service_handle %d", 
                     param->create.status, param->create.service_handle);
            
            if (param->create.status == ESP_GATT_OK && creation_state == SERVICE_CREATION_DEVICE_INFO) {
                device_info_svc_handle = param->create.service_handle;
                
                // Démarrer le service
                esp_err_t ret = esp_ble_gatts_start_service(device_info_svc_handle);
                ESP_LOGI(ARMDECK_TAG, "Device Info service start: %s", esp_err_to_name(ret));
                
                // Ajouter SEULEMENT la caractéristique Manufacturer Name (minimum requis)
                esp_bt_uuid_t manufacturer_uuid = {
                    .len = ESP_UUID_LEN_16,
                    .uuid = {.uuid16 = 0x2A29}  // Manufacturer Name String
                };
                
                esp_attr_value_t manufacturer_attr_val = {
                    .attr_max_len = sizeof(manufacturer_name_value),
                    .attr_len = sizeof(manufacturer_name_value) - 1,
                    .attr_value = manufacturer_name_value,
                };
                
                ret = esp_ble_gatts_add_char(device_info_svc_handle, &manufacturer_uuid,
                                      ESP_GATT_PERM_READ,
                                      ESP_GATT_CHAR_PROP_BIT_READ,
                                      &manufacturer_attr_val, NULL);
                ESP_LOGI(ARMDECK_TAG, "Add manufacturer char: %s", esp_err_to_name(ret));
            }
            break;

        case ESP_GATTS_ADD_CHAR_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_ADD_CHAR_EVT, status %d, attr_handle %d",
                     param->add_char.status, param->add_char.attr_handle);
            
            if (param->add_char.status == ESP_GATT_OK) {
                manufacturer_char_handle = param->add_char.attr_handle;
                creation_state = SERVICE_CREATION_COMPLETE;
                ESP_LOGI(ARMDECK_TAG, "✅ MINIMAL SERVICE COMPLETE - Chrome should see this device now!");
            }
            break;

        case ESP_GATTS_READ_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_READ_EVT, handle %d", param->read.handle);
            
            // Répondre aux lectures du Manufacturer Name
            if (param->read.handle == manufacturer_char_handle) {
                esp_gatt_rsp_t rsp = {0};
                rsp.attr_value.handle = param->read.handle;
                rsp.attr_value.len = sizeof(manufacturer_name_value) - 1;
                memcpy(rsp.attr_value.value, manufacturer_name_value, rsp.attr_value.len);
                
                esp_err_t ret = esp_ble_gatts_send_response(gatts_if, param->read.conn_id, 
                                                            param->read.trans_id, ESP_GATT_OK, &rsp);
                ESP_LOGI(ARMDECK_TAG, "Manufacturer name read response: %s", esp_err_to_name(ret));
            }
            break;
            
        case ESP_GATTS_WRITE_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_WRITE_EVT, handle %d, value len %d", 
                     param->write.handle, param->write.len);
            
            // Juste répondre OK à toutes les écritures (ne devrait pas arriver sur Device Info)
            if (param->write.need_rsp) {
                esp_ble_gatts_send_response(gatts_if, param->write.conn_id, 
                                           param->write.trans_id, ESP_GATT_OK, NULL);
            }
            break;
            
        case ESP_GATTS_CONNECT_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_CONNECT_EVT, conn_id %d", param->connect.conn_id);
            if (gatts_if == armdeck_gatts_if) {
                armdeck_conn_id = param->connect.conn_id;
                ESP_LOGI(ARMDECK_TAG, "Device Info service connected");
            }
            break;

        case ESP_GATTS_DISCONNECT_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_DISCONNECT_EVT");
            armdeck_conn_id = 0xFFFF;
            creation_state = SERVICE_CREATION_NONE;  // Reset pour la prochaine connexion
            
            // Cleanup si nécessaire
            if (ble_connected) {
                ESP_LOGW(ARMDECK_TAG, "Device Info service detected disconnect");
                ble_connected = false;
                stop_keep_alive();
            }
            break;
            
        default:
            // On log plus tous les événements pour éviter le spam
            break;
    }
}

// Fonctions stubées pour compatibilité
void armdeck_on_connect(uint16_t conn_id) {
    ESP_LOGI(ARMDECK_TAG, "Device Info service notified of connection, HID conn_id %d", conn_id);
}

void armdeck_on_disconnect(void) {
    armdeck_conn_id = 0xFFFF;
    ESP_LOGI(ARMDECK_TAG, "Device Info service notified of disconnection");
}

void armdeck_update_battery_level(uint8_t level) {
    // Pas de service batterie dans cette version minimale
    ESP_LOGI(ARMDECK_TAG, "Battery level update ignored (minimal version): %d%%", level);
}

void armdeck_update_device_info(const char* new_info) {
    ESP_LOGI(ARMDECK_TAG, "Device info update ignored (static values): %s", new_info);
}

void armdeck_send_button_event(uint8_t button_id, bool pressed) {
    // Pas de service custom dans cette version
    ESP_LOGI(ARMDECK_TAG, "Button event ignored (minimal version): button=%d, pressed=%d", button_id, pressed);
}

esp_err_t armdeck_apply_keymap(keymap_config_t *config) {
    ESP_LOGI(ARMDECK_TAG, "Keymap apply ignored (minimal version)");
    return ESP_OK;
}

esp_err_t armdeck_execute_command(uint8_t *command_data, uint16_t length) {
    if (command_data == NULL || length == 0) {
        return ESP_ERR_INVALID_ARG;
    }
    
    uint8_t cmd_code = command_data[0];
    ESP_LOGI(ARMDECK_TAG, "Command received (minimal handling): 0x%02x", cmd_code);
    
    switch (cmd_code) {
        case 0x01: // Redémarrer
            ESP_LOGI(ARMDECK_TAG, "Restart command");
            vTaskDelay(100 / portTICK_PERIOD_MS);
            esp_restart();
            break;
            
        case 0x10: // Test keep-alive
            ESP_LOGI(ARMDECK_TAG, "Keep-alive test command");
            // La fonction send_hid_keep_alive est dans armdeck_main.c
            extern void send_hid_keep_alive(void);
            send_hid_keep_alive();
            break;
            
        default:
            ESP_LOGI(ARMDECK_TAG, "Command ignored in minimal version: 0x%02x", cmd_code);
            break;
    }
    
    return ESP_OK;
}