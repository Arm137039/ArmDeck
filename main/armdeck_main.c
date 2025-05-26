/*
 * ArmDeck - Stream Deck 4x3 avec Matrice de Boutons
 * VERSION FIXÉE POUR CHROME WEB BLUETOOTH
 * Corrections: UUIDs advertising + ordre de création des services
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <inttypes.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_bt.h"
#include "esp_timer.h"
#include "driver/gpio.h"

#include "esp_hidd_prf_api.h"
#include "esp_bt_defs.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "esp_gatt_defs.h"
#include "esp_bt_main.h"
#include "esp_bt_device.h"
#include "hid_dev.h"

#define ARMDECK_TAG "ARMDECK_MAIN"
#define HIDD_DEVICE_NAME "ArmDeck"

/* ---------- CONFIGURATION MATRICE 4x3 ---------- */
#define MATRIX_ROWS 3
#define MATRIX_COLS 4
#define TOTAL_BUTTONS (MATRIX_ROWS * MATRIX_COLS)

// GPIO pour les lignes (sorties)
static const int row_pins[MATRIX_ROWS] = {
    GPIO_NUM_2,   // ROW1 - Boutons 1,2,3,4
    GPIO_NUM_4,   // ROW2 - Boutons 5,6,7,8
    GPIO_NUM_5    // ROW3 - Boutons 9,10,11,12
};

// GPIO pour les colonnes (entrées avec pull-up)
static const int col_pins[MATRIX_COLS] = {
    GPIO_NUM_18,  // COL1 - Boutons 1,5,9
    GPIO_NUM_19,  // COL2 - Boutons 2,6,10
    GPIO_NUM_21,  // COL3 - Boutons 3,7,11
    GPIO_NUM_22   // COL4 - Boutons 4,8,12
};

// Mapping bouton vers touche F13-F24
static const uint8_t button_to_fkey[TOTAL_BUTTONS] = {
    0x68, 0x69, 0x6A, 0x6B,  // F13, F14, F15, F16 (Row 1)
    0x6C, 0x6D, 0x6E, 0x6F,  // F17, F18, F19, F20 (Row 2)
    0x70, 0x71, 0x72, 0x73   // F21, F22, F23, F24 (Row 3)
};

// État des boutons pour débounce
static bool button_states[TOTAL_BUTTONS] = {false};
static bool button_last_states[TOTAL_BUTTONS] = {false};
static uint32_t button_last_change[TOTAL_BUTTONS] = {0};

#define DEBOUNCE_DELAY_MS 50

/* ---------- Variables BLE CORRIGÉES ---------- */
uint16_t hid_conn_id = 0;
static bool sec_conn = false;
bool ble_connected = false;
esp_timer_handle_t keep_alive_timer = NULL;
static bool all_services_ready = false;

/* ---------- GATTS variables CORRIGÉES ---------- */
static esp_gatt_if_t armdeck_gatts_if = ESP_GATT_IF_NONE;
static uint16_t device_info_svc_handle = 0;
static uint16_t armdeck_custom_svc_handle = 0;
static uint16_t manufacturer_char_handle = 0;
static uint16_t keymap_char_handle = 0;
static uint16_t command_char_handle = 0;

// 🔥 UUIDs CORRIGÉS - FORMAT STANDARD BLUETOOTH
// Service Device Information (standard) - Format correct pour advertising
static uint8_t device_info_service_uuid16[] = {0x0A, 0x18};  // 0x180A en little-endian

// Service ArmDeck personnalisé (128-bit UUID en bon ordre)
static uint8_t armdeck_service_uuid128[16] = {
    0xfb, 0x34, 0x9b, 0x5f, 0x80, 0x00, 0x00, 0x80,
    0x00, 0x10, 0x00, 0x00, 0x00, 0x10, 0x0b, 0x7a
};

// Caractéristiques ArmDeck
static uint8_t keymap_char_uuid128[16] = {
    0x7a, 0x0b, 0x10, 0x01, 0x00, 0x00, 0x10, 0x00,
    0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb
};

static uint8_t command_char_uuid128[16] = {
    0x7a, 0x0b, 0x10, 0x02, 0x00, 0x00, 0x10, 0x00,
    0x80, 0x00, 0x00, 0x80, 0x5f, 0x9b, 0x34, 0xfb
};

static uint8_t manufacturer_name_value[] = "ArmDeck Technologies";
static uint8_t keymap_default_value[32] = {0};
static uint8_t command_default_value[16] = {0};

/* ---------- ADVERTISING CORRIGÉ POUR CHROME ---------- */
static bool advertising_started = false;

// 🔥 VERSION WORKING : Sans service UUID dans l'advertising (plus compatible)
static esp_ble_adv_data_t hidd_adv_data = {
    .set_scan_rsp = false,
    .include_name = true,
    .include_txpower = false,
    .min_interval = 0x0020,
    .max_interval = 0x0040,
    .appearance = 0x03C1,      // HID Keyboard
    .manufacturer_len = 0,
    .p_manufacturer_data = NULL,
    .service_data_len = 0,
    .p_service_data = NULL,
    .service_uuid_len = 0,           // 🔥 PAS DE SERVICE UUID = plus compatible
    .p_service_uuid = NULL,
    .flag = ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT,
};

// 🔥 VERSION CHROME WEB BLUETOOTH : Device Info Service en advertising
static esp_ble_adv_data_t hidd_adv_data_chrome = {
    .set_scan_rsp = false,
    .include_name = true,
    .include_txpower = false,
    .min_interval = 0x0020,
    .max_interval = 0x0040,
    .appearance = 0x03C1,      // HID Keyboard
    .manufacturer_len = 0,
    .p_manufacturer_data = NULL,
    .service_data_len = 0,
    .p_service_data = NULL,
    .service_uuid_len = 2,     // 🔥 RÉACTIVÉ: Service Device Info pour Chrome
    .p_service_uuid = device_info_service_uuid16,
    .flag = ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT,
};

// Scan response avec le service ArmDeck personnalisé
static esp_ble_adv_data_t hidd_scan_rsp_data_chrome = {
    .set_scan_rsp = true,
    .include_name = false,
    .include_txpower = false,
    .service_uuid_len = 16,          // Service ArmDeck 128-bit
    .p_service_uuid = armdeck_service_uuid128,
    .flag = 0,
};

static esp_ble_adv_params_t hidd_adv_params = {
    .adv_int_min = 0x0020,   // 20ms - plus rapide pour Chrome
    .adv_int_max = 0x0040,   // 40ms
    .adv_type = ADV_TYPE_IND,
    .own_addr_type = BLE_ADDR_TYPE_PUBLIC,
    .channel_map = ADV_CHNL_ALL,
    .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

/* ---------- Function declarations ---------- */
void armdeck_all_services_ready_callback(void);
void force_restart_advertising(void);

/* ---------- FONCTION DE REDÉMARRAGE ADVERTISING ---------- */
void force_restart_advertising(void) {
    if (all_services_ready && !ble_connected) {
        ESP_LOGI(ARMDECK_TAG, "🔄 Force restarting advertising...");
        
        // Arrêter l'advertising actuel
        esp_ble_gap_stop_advertising();
        vTaskDelay(500 / portTICK_PERIOD_MS);
        
        // Redémarrer avec la version simple (sans service UUID)
        esp_err_t ret = esp_ble_gap_config_adv_data(&hidd_adv_data);
        ESP_LOGI(ARMDECK_TAG, "🔧 Restart simple advertising config: %s", esp_err_to_name(ret));
        
        if (ret != ESP_OK) {
            ESP_LOGW(ARMDECK_TAG, "⚠️ Retry with Chrome advertising...");
            ret = esp_ble_gap_config_adv_data(&hidd_adv_data_chrome);
            ESP_LOGI(ARMDECK_TAG, "🔧 Restart Chrome config: %s", esp_err_to_name(ret));
        }
    }
}

/* ---------- FONCTIONS MATRICE (inchangées) ---------- */

void init_button_matrix(void) {
    ESP_LOGI(ARMDECK_TAG, "🔧 Initializing 4x3 button matrix...");
    
    // Configuration des lignes (sorties, niveau haut par défaut)
    for (int i = 0; i < MATRIX_ROWS; i++) {
        gpio_reset_pin(row_pins[i]);
        gpio_set_direction(row_pins[i], GPIO_MODE_OUTPUT);
        gpio_set_level(row_pins[i], 1); // Niveau haut par défaut
        ESP_LOGI(ARMDECK_TAG, "Row %d configured on GPIO %d", i+1, row_pins[i]);
    }
    
    // Configuration des colonnes (entrées avec pull-up)
    for (int i = 0; i < MATRIX_COLS; i++) {
        gpio_reset_pin(col_pins[i]);
        gpio_set_direction(col_pins[i], GPIO_MODE_INPUT);
        gpio_set_pull_mode(col_pins[i], GPIO_PULLUP_ONLY);
        ESP_LOGI(ARMDECK_TAG, "Col %d configured on GPIO %d with pull-up", i+1, col_pins[i]);
    }
    
    ESP_LOGI(ARMDECK_TAG, "✅ Button matrix initialized (F13-F24 mapping)");
}

void send_hid_key(uint8_t key_code, bool pressed) {
    if (!ble_connected || hid_conn_id == 0) {
        ESP_LOGW(ARMDECK_TAG, "Cannot send key - not connected");
        return;
    }
    
    uint8_t key_report[8] = {0};
    if (pressed) {
        key_report[2] = key_code; // Premier key code
    }
    // Si pas pressed, le rapport reste à zéro (relâchement)
    
    esp_hidd_send_keyboard_value(hid_conn_id, 0, key_report, 8);
    ESP_LOGI(ARMDECK_TAG, "📤 Key %s: F%d (0x%02x)", 
             pressed ? "PRESS" : "RELEASE", 
             (key_code - 0x68) + 13, key_code);
}

void handle_button_action(int button_id, bool pressed) {
    if (button_id < 0 || button_id >= TOTAL_BUTTONS) {
        return;
    }
    
    if (pressed) {
        ESP_LOGI(ARMDECK_TAG, "🔘 Button %d PRESSED (Row %d, Col %d)", 
                 button_id + 1, 
                 (button_id / MATRIX_COLS) + 1, 
                 (button_id % MATRIX_COLS) + 1);
        send_hid_key(button_to_fkey[button_id], true);
    } else {
        ESP_LOGI(ARMDECK_TAG, "🔘 Button %d RELEASED", button_id + 1);
        send_hid_key(button_to_fkey[button_id], false);
    }
}

void scan_button_matrix(void) {
    uint32_t current_time = esp_timer_get_time() / 1000; // millisecondes
    
    for (int row = 0; row < MATRIX_ROWS; row++) {
        // Activer la ligne courante (niveau bas)
        gpio_set_level(row_pins[row], 0);
        
        // Petite pause pour stabilisation
        esp_rom_delay_us(10);
        
        // Lire toutes les colonnes
        for (int col = 0; col < MATRIX_COLS; col++) {
            int button_id = (row * MATRIX_COLS) + col;
            bool current_state = (gpio_get_level(col_pins[col]) == 0); // Bouton pressé = niveau bas
            
            // Débounce
            if (current_state != button_last_states[button_id]) {
                button_last_change[button_id] = current_time;
                button_last_states[button_id] = current_state;
            } else if ((current_time - button_last_change[button_id]) > DEBOUNCE_DELAY_MS) {
                // État stable depuis assez longtemps
                if (current_state != button_states[button_id]) {
                    button_states[button_id] = current_state;
                    handle_button_action(button_id, current_state);
                }
            }
        }
        
        // Désactiver la ligne courante
        gpio_set_level(row_pins[row], 1);
    }
}

void button_scan_task(void *pvParameters) {
    ESP_LOGI(ARMDECK_TAG, "🔄 Button scan task started");
    
    while (1) {
        scan_button_matrix();
        vTaskDelay(pdMS_TO_TICKS(10)); // Scan toutes les 10ms
    }
}

/* ---------- Fonctions BLE (Keep-alive inchangé) ---------- */

void send_hid_keep_alive(void) {
    if (ble_connected && hid_conn_id != 0) {
        uint8_t empty_report[8] = {0};
        esp_hidd_send_keyboard_value(hid_conn_id, 0, empty_report, 0);
        ESP_LOGI(ARMDECK_TAG, "Keep-alive sent");
    }
}

#define KEEP_ALIVE_PERIOD_US (15ULL * 1000 * 1000)

static void keep_alive_timer_callback(void *arg) {
    send_hid_keep_alive();
}

void start_keep_alive(void) {
    if (!keep_alive_timer) {
        esp_timer_create_args_t timer_args = {
            .callback = keep_alive_timer_callback,
            .name = "keep_alive_timer"
        };
        esp_timer_create(&timer_args, &keep_alive_timer);
    }
    
    esp_timer_stop(keep_alive_timer);
    esp_err_t ret = esp_timer_start_periodic(keep_alive_timer, KEEP_ALIVE_PERIOD_US);
    if (ret == ESP_OK) {
        ESP_LOGI(ARMDECK_TAG, "Keep-alive timer started (15s interval)");
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

/* ---------- GATTS Event Handler CORRIGÉ ---------- */
static void armdeck_gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param)
{
    switch (event) {
        case ESP_GATTS_REG_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_REG_EVT, status %d, app_id %d", param->reg.status, param->reg.app_id);
            if (param->reg.status == ESP_GATT_OK && param->reg.app_id == 0x55) {
                armdeck_gatts_if = gatts_if;
                
                // 🔥 CORRECTION: Créer d'abord Device Info Service (standard)
                esp_gatt_srvc_id_t device_info_service_id = {
                    .is_primary = true,
                    .id.inst_id = 0,
                    .id.uuid.len = ESP_UUID_LEN_16,
                    .id.uuid.uuid.uuid16 = 0x180A,  // Device Information Service
                };
                esp_err_t ret = esp_ble_gatts_create_service(gatts_if, &device_info_service_id, 8);
                ESP_LOGI(ARMDECK_TAG, "Creating Device Information service: %s", esp_err_to_name(ret));
            }
            break;

        case ESP_GATTS_CREATE_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_CREATE_EVT, status %d, service_handle %d", 
                     param->create.status, param->create.service_handle);
            
            if (param->create.status == ESP_GATT_OK) {
                esp_gatt_srvc_id_t *srvc_id = &param->create.service_id;
                
                if (srvc_id->id.uuid.len == ESP_UUID_LEN_16 && 
                    srvc_id->id.uuid.uuid.uuid16 == 0x180A) {
                    // Device Info Service créé
                    device_info_svc_handle = param->create.service_handle;
                    esp_ble_gatts_start_service(device_info_svc_handle);
                    ESP_LOGI(ARMDECK_TAG, "Device Info service started");
                    
                } else if (srvc_id->id.uuid.len == ESP_UUID_LEN_128) {
                    // ArmDeck Custom Service créé
                    armdeck_custom_svc_handle = param->create.service_handle;
                    esp_ble_gatts_start_service(armdeck_custom_svc_handle);
                    ESP_LOGI(ARMDECK_TAG, "ArmDeck custom service started");
                }
            }
            break;

        case ESP_GATTS_START_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_START_EVT, status %d, service_handle %d", 
                     param->start.status, param->start.service_handle);
            
            if (param->start.status == ESP_GATT_OK) {
                if (param->start.service_handle == device_info_svc_handle) {
                    // Ajouter manufacturer characteristic au Device Info
                    esp_bt_uuid_t manufacturer_uuid = {.len = ESP_UUID_LEN_16, .uuid = {.uuid16 = 0x2A29}};
                    esp_attr_value_t manufacturer_attr_val = {
                        .attr_max_len = sizeof(manufacturer_name_value),
                        .attr_len = sizeof(manufacturer_name_value) - 1,
                        .attr_value = manufacturer_name_value,
                    };
                    esp_attr_control_t attr_control = {.auto_rsp = ESP_GATT_AUTO_RSP};
                    
                    esp_ble_gatts_add_char(device_info_svc_handle, &manufacturer_uuid,
                                          ESP_GATT_PERM_READ, ESP_GATT_CHAR_PROP_BIT_READ,
                                          &manufacturer_attr_val, &attr_control);
                    
                    // Maintenant créer le service ArmDeck personnalisé
                    esp_gatt_srvc_id_t custom_service_id = {
                        .is_primary = true,
                        .id.inst_id = 1,
                        .id.uuid.len = ESP_UUID_LEN_128,
                    };
                    memcpy(custom_service_id.id.uuid.uuid.uuid128, armdeck_service_uuid128, 16);
                    esp_ble_gatts_create_service(armdeck_gatts_if, &custom_service_id, 15);
                    ESP_LOGI(ARMDECK_TAG, "Creating ArmDeck custom service...");
                    
                } else if (param->start.service_handle == armdeck_custom_svc_handle) {
                    // Ajouter keymap characteristic au service personnalisé
                    esp_bt_uuid_t keymap_uuid = {.len = ESP_UUID_LEN_128};
                    memcpy(keymap_uuid.uuid.uuid128, keymap_char_uuid128, 16);
                    esp_attr_value_t keymap_attr_val = {
                        .attr_max_len = sizeof(keymap_default_value),
                        .attr_len = sizeof(keymap_default_value),
                        .attr_value = keymap_default_value,
                    };
                    esp_attr_control_t attr_control = {.auto_rsp = ESP_GATT_AUTO_RSP};
                    
                    esp_ble_gatts_add_char(armdeck_custom_svc_handle, &keymap_uuid,
                                          ESP_GATT_PERM_READ | ESP_GATT_PERM_WRITE,
                                          ESP_GATT_CHAR_PROP_BIT_READ | ESP_GATT_CHAR_PROP_BIT_WRITE,
                                          &keymap_attr_val, &attr_control);
                    ESP_LOGI(ARMDECK_TAG, "Adding keymap characteristic...");
                }
            }
            break;

        case ESP_GATTS_ADD_CHAR_EVT:
            ESP_LOGI(ARMDECK_TAG, "ESP_GATTS_ADD_CHAR_EVT, status %d, attr_handle %d, service_handle %d",
                     param->add_char.status, param->add_char.attr_handle, param->add_char.service_handle);
            
            if (param->add_char.status == ESP_GATT_OK) {
                if (param->add_char.service_handle == device_info_svc_handle) {
                    manufacturer_char_handle = param->add_char.attr_handle;
                    ESP_LOGI(ARMDECK_TAG, "Manufacturer characteristic added");
                    
                } else if (param->add_char.service_handle == armdeck_custom_svc_handle) {
                    if (keymap_char_handle == 0) {
                        keymap_char_handle = param->add_char.attr_handle;
                        ESP_LOGI(ARMDECK_TAG, "Keymap characteristic added, adding command...");
                        
                        // Ajouter command characteristic
                        esp_bt_uuid_t command_uuid = {.len = ESP_UUID_LEN_128};
                        memcpy(command_uuid.uuid.uuid128, command_char_uuid128, 16);
                        esp_attr_value_t command_attr_val = {
                            .attr_max_len = sizeof(command_default_value),
                            .attr_len = sizeof(command_default_value),
                            .attr_value = command_default_value,
                        };
                        esp_attr_control_t attr_control = {.auto_rsp = ESP_GATT_AUTO_RSP};
                        
                        esp_ble_gatts_add_char(armdeck_custom_svc_handle, &command_uuid,
                                              ESP_GATT_PERM_WRITE, ESP_GATT_CHAR_PROP_BIT_WRITE,
                                              &command_attr_val, &attr_control);
                        
                    } else {
                        command_char_handle = param->add_char.attr_handle;
                        ESP_LOGI(ARMDECK_TAG, "Command characteristic added");
                        ESP_LOGI(ARMDECK_TAG, "🎉 ALL SERVICES READY!");
                        armdeck_all_services_ready_callback();
                    }
                }
            }
            break;

        case ESP_GATTS_WRITE_EVT:
            if (param->write.handle == command_char_handle && param->write.len > 0) {
                uint8_t cmd = param->write.value[0];
                ESP_LOGI(ARMDECK_TAG, "📝 Command received: 0x%02x", cmd);
                
                switch (cmd) {
                    case 0x01:
                        ESP_LOGI(ARMDECK_TAG, "💥 Restart command");
                        esp_restart();
                        break;
                    case 0x10:
                        ESP_LOGI(ARMDECK_TAG, "💓 Keep-alive test");
                        send_hid_keep_alive();
                        break;
                    case 0x20:
                        ESP_LOGI(ARMDECK_TAG, "📊 Status check");
                        break;
                    case 0x30:
                        ESP_LOGI(ARMDECK_TAG, "🧪 Button matrix test");
                        // Test tous les boutons
                        for (int i = 0; i < TOTAL_BUTTONS; i++) {
                            ESP_LOGI(ARMDECK_TAG, "Testing button %d -> F%d", i+1, (button_to_fkey[i] - 0x68) + 13);
                            send_hid_key(button_to_fkey[i], true);
                            vTaskDelay(pdMS_TO_TICKS(100));
                            send_hid_key(button_to_fkey[i], false);
                            vTaskDelay(pdMS_TO_TICKS(100));
                        }
                        ESP_LOGI(ARMDECK_TAG, "✅ Button test completed");
                        break;
                    default:
                        ESP_LOGI(ARMDECK_TAG, "❓ Unknown command");
                        break;
                }
            }
            
            if (param->write.need_rsp) {
                esp_ble_gatts_send_response(gatts_if, param->write.conn_id, 
                                           param->write.trans_id, ESP_GATT_OK, NULL);
            }
            break;
            
        default:
            break;
    }
}

void armdeck_all_services_ready_callback(void) {
    all_services_ready = true;
    ESP_LOGI(ARMDECK_TAG, "🎉 ALL SERVICES READY - Starting advertising!");
    
    // 🔥 COMMENCER PAR LA VERSION SIMPLE (sans service UUID)
    esp_err_t ret = esp_ble_gap_config_adv_data(&hidd_adv_data);
    ESP_LOGI(ARMDECK_TAG, "🔧 Simple advertising data config result: %s", esp_err_to_name(ret));
    
    if (ret != ESP_OK) {
        ESP_LOGW(ARMDECK_TAG, "⚠️ Simple advertising failed, trying Chrome version...");
        ret = esp_ble_gap_config_adv_data(&hidd_adv_data_chrome);
        ESP_LOGI(ARMDECK_TAG, "🔧 Chrome advertising config result: %s", esp_err_to_name(ret));
    }
}

/* ---------- HID Event Callback (inchangé) ---------- */
static void hidd_event_callback(esp_hidd_cb_event_t event, esp_hidd_cb_param_t *param)
{
    switch(event) {
        case ESP_HIDD_EVENT_REG_FINISH:
            if (param->init_finish.state == ESP_HIDD_INIT_OK) {
                ESP_LOGI(ARMDECK_TAG, "✅ HID profile initialized");
                esp_ble_gap_set_device_name(HIDD_DEVICE_NAME);
                
                // Register GATTS
                esp_ble_gatts_register_callback(armdeck_gatts_event_handler);
                esp_ble_gatts_app_register(0x55);
            }
            break;
            
        case ESP_BAT_EVENT_REG:
            ESP_LOGI(ARMDECK_TAG, "Battery service registered");
            break;
            
        case ESP_HIDD_EVENT_BLE_CONNECT:
            ESP_LOGI(ARMDECK_TAG, "🟢 HID CONNECTED");
            hid_conn_id = param->connect.conn_id;
            ble_connected = true;
            
            ESP_LOGI(ARMDECK_TAG, "🔥 DEBUG: hid_conn_id=%d, ble_connected=%s", 
                     hid_conn_id, ble_connected ? "true" : "false");
            
            // Rapport initial
            uint8_t empty_report[8] = {0};
            esp_hidd_send_keyboard_value(hid_conn_id, 0, empty_report, 0);
            
            start_keep_alive();
            ESP_LOGI(ARMDECK_TAG, "🎉 Stream Deck ready for button presses!");
            break;
            
        case ESP_HIDD_EVENT_BLE_DISCONNECT:
            ESP_LOGI(ARMDECK_TAG, "🔴 HID DISCONNECTED");
            ble_connected = false;
            hid_conn_id = 0;
            sec_conn = false;
            stop_keep_alive();
            
            // Redémarrer advertising
            vTaskDelay(3000 / portTICK_PERIOD_MS);
            if (all_services_ready) {
                esp_ble_gap_config_adv_data(&hidd_adv_data);
            }
            ESP_LOGI(ARMDECK_TAG, "🔄 Advertising restarted");
            break;
            
        case ESP_HIDD_EVENT_BLE_VENDOR_REPORT_WRITE_EVT:
            ESP_LOGI(ARMDECK_TAG, "Vendor report write");
            break;
            
        case ESP_HIDD_EVENT_BLE_LED_REPORT_WRITE_EVT:
            ESP_LOGI(ARMDECK_TAG, "LED report write");
            break;
            
        default:
            ESP_LOGI(ARMDECK_TAG, "🔧 Unhandled HID event: %d", event);
            break;
    }
}

/* ---------- GAP Event Callback CORRIGÉ ---------- */
static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param)
{
    switch (event) {
        case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
            ESP_LOGI(ARMDECK_TAG, "🔧 Advertising data set, status=%d", param->adv_data_cmpl.status);
            if (param->adv_data_cmpl.status == ESP_BT_STATUS_SUCCESS) {
                // 🔥 SIMPLIFIÉE: Démarrer directement l'advertising (sans scan response pour l'instant)
                esp_err_t ret = esp_ble_gap_start_advertising(&hidd_adv_params);
                ESP_LOGI(ARMDECK_TAG, "🔧 Start advertising result: %s", esp_err_to_name(ret));
            }
            break;
            
        case ESP_GAP_BLE_SCAN_RSP_DATA_SET_COMPLETE_EVT:
            ESP_LOGI(ARMDECK_TAG, "🔧 Scan response data set, status=%d", param->scan_rsp_data_cmpl.status);
            if (param->scan_rsp_data_cmpl.status == ESP_BT_STATUS_SUCCESS) {
                // Maintenant démarrer l'advertising
                esp_err_t ret = esp_ble_gap_start_advertising(&hidd_adv_params);
                ESP_LOGI(ARMDECK_TAG, "🔧 Start advertising result: %s", esp_err_to_name(ret));
            }
            break;
            
        case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
            ESP_LOGI(ARMDECK_TAG, "🔧 Advertising start complete, status=%d", param->adv_start_cmpl.status);
            if (param->adv_start_cmpl.status == ESP_BT_STATUS_SUCCESS) {
                advertising_started = true;
                ESP_LOGI(ARMDECK_TAG, "✅ Stream Deck advertising started!");
                ESP_LOGI(ARMDECK_TAG, "🎮 Ready to receive button presses");
                ESP_LOGI(ARMDECK_TAG, "🌐 Device should be visible as 'ArmDeck' in Bluetooth settings");
                ESP_LOGI(ARMDECK_TAG, "🌐 Chrome: Should be visible with Device Info Service (0x180A)");
                ESP_LOGI(ARMDECK_TAG, "📱 Try: Settings > Bluetooth > Add device > Everything else");
            } else {
                ESP_LOGE(ARMDECK_TAG, "❌ Advertising start failed: %d", param->adv_start_cmpl.status);
            }
            break;
            
        case ESP_GAP_BLE_SEC_REQ_EVT:
            ESP_LOGI(ARMDECK_TAG, "🔐 Security request from: %02x:%02x:%02x:%02x:%02x:%02x", 
                     param->ble_security.ble_req.bd_addr[0], param->ble_security.ble_req.bd_addr[1],
                     param->ble_security.ble_req.bd_addr[2], param->ble_security.ble_req.bd_addr[3],
                     param->ble_security.ble_req.bd_addr[4], param->ble_security.ble_req.bd_addr[5]);
            esp_ble_gap_security_rsp(param->ble_security.ble_req.bd_addr, true);
            break;
            
        case ESP_GAP_BLE_AUTH_CMPL_EVT:
            sec_conn = param->ble_security.auth_cmpl.success;
            ESP_LOGI(ARMDECK_TAG, "🔐 Authentication %s", sec_conn ? "✅ SUCCESS" : "❌ FAILED");
            break;

        case ESP_GAP_BLE_ADV_STOP_COMPLETE_EVT:
            ESP_LOGI(ARMDECK_TAG, "🛑 Advertising stopped");
            advertising_started = false;
            break;

        case ESP_GAP_BLE_UPDATE_CONN_PARAMS_EVT:
            ESP_LOGI(ARMDECK_TAG, "🔗 Connection params updated");
            break;
            
        default:
            ESP_LOGI(ARMDECK_TAG, "🔧 GAP event: %d", event);
            break;
    }
}

/* ---------- Status Task AMÉLIORÉE ---------- */
static void status_task(void *pvParameters)
{
    uint32_t count = 0;
    while(1) {
        ESP_LOGI(ARMDECK_TAG, "[%u] 🎮 StreamDeck | 🔗 Connected: %s | 📡 Advertising: %s | 🛠️ Services: %s | 💾 Heap: %u",
                 (unsigned int)count++,
                 ble_connected ? "YES" : "NO",
                 advertising_started ? "YES" : "NO",
                 all_services_ready ? "READY" : "PENDING",
                 (unsigned int)esp_get_free_heap_size());
        
        // Si on n'est pas connecté et qu'on n'advertise pas, forcer redémarrage
        if (!ble_connected && !advertising_started && all_services_ready && count > 2) {
            ESP_LOGW(ARMDECK_TAG, "⚠️ Not advertising while disconnected - forcing restart");
            force_restart_advertising();
        }
        
        // Afficher l'état des boutons toutes les 2 minutes
        if (count % 4 == 0) {
            ESP_LOGI(ARMDECK_TAG, "📊 Button Matrix Status:");
            bool any_pressed = false;
            for (int i = 0; i < TOTAL_BUTTONS; i++) {
                if (button_states[i]) {
                    ESP_LOGI(ARMDECK_TAG, "  Button %d (F%d): PRESSED", i+1, (button_to_fkey[i] - 0x68) + 13);
                    any_pressed = true;
                }
            }
            if (!any_pressed) {
                ESP_LOGI(ARMDECK_TAG, "  All buttons released");
            }
        }
        
        vTaskDelay(30000 / portTICK_PERIOD_MS);
    }
}

/* ---------- Main Application ---------- */
void app_main(void)
{
    esp_err_t ret;

    ESP_LOGI(ARMDECK_TAG, "🚀 === ArmDeck Stream Deck 4x3 - CHROME COMPATIBLE ===");
    ESP_LOGI(ARMDECK_TAG, "🎮 Features: 12 buttons mapped to F13-F24");
    ESP_LOGI(ARMDECK_TAG, "🌐 Web Bluetooth: Device Info + ArmDeck Custom services");

    // NVS
    ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // 🔥 NOUVEAU: Initialiser la matrice de boutons
    init_button_matrix();

    // BT Controller
    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));
    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_bt_controller_init(&bt_cfg));
    ESP_ERROR_CHECK(esp_bt_controller_enable(ESP_BT_MODE_BLE));

    // Bluedroid
    ESP_ERROR_CHECK(esp_bluedroid_init());
    ESP_ERROR_CHECK(esp_bluedroid_enable());

    // HID Profile
    ESP_ERROR_CHECK(esp_hidd_profile_init());

    // Callbacks
    esp_ble_gap_register_callback(gap_event_handler);
    esp_hidd_register_callbacks(hidd_event_callback);

    // Sécurité
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

    // Keep-alive timer
    const esp_timer_create_args_t timer_args = {
        .callback = keep_alive_timer_callback,
        .name = "keep_alive"
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &keep_alive_timer));

    // 🔥 NOUVEAU: Démarrer la tâche de scan des boutons
    xTaskCreate(&button_scan_task, "button_scan", 2048, NULL, 5, NULL);
    
    // Tâche de statut
    xTaskCreate(&status_task, "status_task", 3072, NULL, 3, NULL);

    ESP_LOGI(ARMDECK_TAG, "🎉 === ArmDeck Stream Deck Ready ===");
    ESP_LOGI(ARMDECK_TAG, "🔧 Button matrix: 4x3 (12 buttons)");
    ESP_LOGI(ARMDECK_TAG, "⌨️  HID mapping: F13-F24");
    ESP_LOGI(ARMDECK_TAG, "🌐 BLE services: Device Info + ArmDeck Custom");
    ESP_LOGI(ARMDECK_TAG, "📱 Connect from Chrome Web Bluetooth and start pressing buttons!");
}