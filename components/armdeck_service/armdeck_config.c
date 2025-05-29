#include "armdeck_config.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "esp_crc.h"
#include "cJSON.h"
#include <string.h>

/* Static variables */
static armdeck_config_t current_config;
static bool config_initialized = false;

/* Action to HID Code mapping table */
static const action_mapping_t action_map[] = {
    {"MEDIA_PLAY_PAUSE", 0xCD, true},   // Consumer Control
    {"MEDIA_NEXT", 0xB5, true},         // Consumer Control
    {"MEDIA_PREV", 0xB6, true},         // Consumer Control
    {"VOLUME_UP", 0xE9, true},          // Consumer Control
    {"VOLUME_DOWN", 0xEA, true},        // Consumer Control
    {"VOLUME_MUTE", 0xE2, true},        // Consumer Control
    {"MEDIA_STOP", 0xB7, true},         // Consumer Control
    {"KEY_F20", 0x6F, false},           // Keyboard
    {"KEY_F21", 0x70, false},           // Keyboard
    {"KEY_F22", 0x71, false},           // Keyboard
    {"KEY_F23", 0x72, false},           // Keyboard
    {"KEY_F24", 0x73, false},           // Keyboard
};

/* Default configuration */
static const button_config_t default_buttons[ARMDECK_MAX_BUTTONS] = {
    {0, "Play/Pause", "MEDIA_PLAY_PAUSE", "#4CAF50"},
    {1, "Next", "MEDIA_NEXT", "#2196F3"},
    {2, "Previous", "MEDIA_PREV", "#2196F3"},
    {3, "Volume +", "VOLUME_UP", "#FF9800"},
    {4, "Volume -", "VOLUME_DOWN", "#FF9800"},
    {5, "Mute", "VOLUME_MUTE", "#F44336"},
    {6, "Stop", "MEDIA_STOP", "#9C27B0"},
    {7, "F20", "KEY_F20", "#607D8B"},
    {8, "F21", "KEY_F21", "#607D8B"},
    {9, "F22", "KEY_F22", "#607D8B"},
    {10, "F23", "KEY_F23", "#607D8B"},
    {11, "F24", "KEY_F24", "#607D8B"}
};

esp_err_t armdeck_config_init(void)
{
    ESP_LOGI(ARMDECK_CONFIG_TAG, "🔧 Initializing configuration system...");
    
    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(ARMDECK_CONFIG_TAG, "⚠️ NVS partition corrupted, erasing...");
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    
    if (ret != ESP_OK) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to initialize NVS: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Try to load existing configuration
    ret = armdeck_config_load_from_nvs(&current_config);
    if (ret == ESP_ERR_NOT_FOUND) {
        ESP_LOGI(ARMDECK_CONFIG_TAG, "📝 No existing configuration found, creating default...");
        ret = armdeck_config_reset_to_default(&current_config);
        if (ret == ESP_OK) {
            ret = armdeck_config_save_to_nvs(&current_config);
            if (ret == ESP_OK) {
                ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ Default configuration saved to NVS");
            }
        }
    } else if (ret == ESP_OK) {
        ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ Configuration loaded from NVS");
    } else {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to load configuration: %s", esp_err_to_name(ret));
        return ret;
    }
    
    config_initialized = true;
    ESP_LOGI(ARMDECK_CONFIG_TAG, "🎉 Configuration system initialized successfully");
    return ESP_OK;
}

esp_err_t armdeck_config_load_from_nvs(armdeck_config_t* config)
{
    if (!config) {
        return ESP_ERR_INVALID_ARG;
    }
    
    nvs_handle_t nvs_handle;
    esp_err_t ret = nvs_open(ARMDECK_NVS_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to open NVS namespace: %s", esp_err_to_name(ret));
        return ret;
    }
    
    size_t required_size = sizeof(armdeck_config_t);
    ret = nvs_get_blob(nvs_handle, ARMDECK_NVS_KEY_BUTTONS, config, &required_size);
    nvs_close(nvs_handle);
    
    if (ret == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGW(ARMDECK_CONFIG_TAG, "⚠️ Configuration not found in NVS");
        return ESP_ERR_NOT_FOUND;
    } else if (ret != ESP_OK) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to read configuration from NVS: %s", esp_err_to_name(ret));
        return ret;
    }
    
    // Validate configuration
    if (!armdeck_config_validate(config)) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Configuration validation failed, data corrupted");
        return ESP_ERR_INVALID_STATE;
    }
    
    ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ Configuration loaded and validated (version %d)", config->version);
    return ESP_OK;
}

esp_err_t armdeck_config_save_to_nvs(const armdeck_config_t* config)
{
    if (!config) {
        return ESP_ERR_INVALID_ARG;
    }
    
    // Validate before saving
    if (!armdeck_config_validate(config)) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Cannot save invalid configuration");
        return ESP_ERR_INVALID_ARG;
    }
    
    nvs_handle_t nvs_handle;
    esp_err_t ret = nvs_open(ARMDECK_NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to open NVS namespace for write: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ret = nvs_set_blob(nvs_handle, ARMDECK_NVS_KEY_BUTTONS, config, sizeof(armdeck_config_t));
    if (ret != ESP_OK) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to write configuration to NVS: %s", esp_err_to_name(ret));
        nvs_close(nvs_handle);
        return ret;
    }
    
    ret = nvs_commit(nvs_handle);
    nvs_close(nvs_handle);
    
    if (ret != ESP_OK) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to commit NVS changes: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ Configuration saved to NVS successfully");
    return ESP_OK;
}

esp_err_t armdeck_config_reset_to_default(armdeck_config_t* config)
{
    if (!config) {
        return ESP_ERR_INVALID_ARG;
    }
    
    ESP_LOGI(ARMDECK_CONFIG_TAG, "🔄 Resetting configuration to default values...");
    
    memset(config, 0, sizeof(armdeck_config_t));
    config->version = ARMDECK_CONFIG_VERSION;
    
    // Copy default button configurations
    for (int i = 0; i < ARMDECK_MAX_BUTTONS; i++) {
        memcpy(&config->buttons[i], &default_buttons[i], sizeof(button_config_t));
    }
    
    // Calculate and set checksum
    config->checksum = armdeck_config_calculate_checksum(config);
    
    ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ Configuration reset to default values");
    return ESP_OK;
}

uint32_t armdeck_config_calculate_checksum(const armdeck_config_t* config)
{
    if (!config) {
        return 0;
    }
    
    // Calculate CRC32 of everything except the checksum field
    size_t data_size = sizeof(armdeck_config_t) - sizeof(config->checksum);
    return esp_crc32_le(0, (const uint8_t*)config, data_size);
}

bool armdeck_config_validate(const armdeck_config_t* config)
{
    if (!config) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Config pointer is NULL");
        return false;
    }
    
    // Check version
    if (config->version != ARMDECK_CONFIG_VERSION) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Invalid config version: %d (expected %d)", 
                 config->version, ARMDECK_CONFIG_VERSION);
        return false;
    }
    
    // Validate checksum
    uint32_t calculated_checksum = armdeck_config_calculate_checksum(config);
    if (config->checksum != calculated_checksum) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Checksum mismatch: stored=0x%08X, calculated=0x%08X",
                 (unsigned int)config->checksum, (unsigned int)calculated_checksum);
        return false;
    }
    
    // Validate button configurations
    for (int i = 0; i < ARMDECK_MAX_BUTTONS; i++) {
        const button_config_t* btn = &config->buttons[i];
        
        // Check button ID
        if (btn->id != i) {
            ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Button %d has invalid ID: %d", i, btn->id);
            return false;
        }
        
        // Check strings are null-terminated
        if (strnlen(btn->label, ARMDECK_LABEL_MAX_LEN) >= ARMDECK_LABEL_MAX_LEN) {
            ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Button %d label not null-terminated", i);
            return false;
        }
        
        if (strnlen(btn->action, ARMDECK_ACTION_MAX_LEN) >= ARMDECK_ACTION_MAX_LEN) {
            ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Button %d action not null-terminated", i);
            return false;
        }
        
        if (strnlen(btn->color, ARMDECK_COLOR_MAX_LEN) >= ARMDECK_COLOR_MAX_LEN) {
            ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Button %d color not null-terminated", i);
            return false;
        }
        
        // Validate color format (#RRGGBB)
        if (btn->color[0] != '#' || strlen(btn->color) != 7) {
            ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Button %d invalid color format: %s", i, btn->color);
            return false;
        }
    }
    
    return true;
}

esp_err_t armdeck_config_get_hid_code(const char* action, uint8_t* hid_code, bool* is_consumer)
{
    if (!action || !hid_code || !is_consumer) {
        return ESP_ERR_INVALID_ARG;
    }
    
    for (size_t i = 0; i < sizeof(action_map) / sizeof(action_mapping_t); i++) {
        if (strcmp(action, action_map[i].action) == 0) {
            *hid_code = action_map[i].hid_code;
            *is_consumer = action_map[i].is_consumer;
            return ESP_OK;
        }
    }
    
    ESP_LOGW(ARMDECK_CONFIG_TAG, "⚠️ Unknown action: %s", action);
    return ESP_ERR_NOT_FOUND;
}

void armdeck_config_get_device_info(device_info_t* device_info)
{
    if (!device_info) {
        return;
    }
    
    strcpy(device_info->name, "ArmDeck");
    strcpy(device_info->firmware, ARMDECK_FIRMWARE_VERSION);
    device_info->uptime = esp_timer_get_time() / 1000000; // Convert to seconds
    device_info->heap = esp_get_free_heap_size();
}

esp_err_t armdeck_config_generate_json_response(const armdeck_config_t* config,
                                                const device_info_t* device_info,
                                                char* json_output,
                                                size_t max_size)
{
    if (!config || !device_info || !json_output) {
        return ESP_ERR_INVALID_ARG;
    }
    
    cJSON* root = cJSON_CreateObject();
    if (!root) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to create JSON root object");
        return ESP_ERR_NO_MEM;
    }
    
    // Add command and status
    cJSON_AddStringToObject(root, "cmd", "0x50");
    cJSON_AddStringToObject(root, "status", "ok");
    
    // Create data object
    cJSON* data = cJSON_CreateObject();
    cJSON_AddItemToObject(root, "data", data);
    
    // Add version
    cJSON_AddNumberToObject(data, "version", config->version);
    
    // Create buttons array
    cJSON* buttons_array = cJSON_CreateArray();
    cJSON_AddItemToObject(data, "buttons", buttons_array);
    
    for (int i = 0; i < ARMDECK_MAX_BUTTONS; i++) {
        cJSON* button = cJSON_CreateObject();
        cJSON_AddNumberToObject(button, "id", config->buttons[i].id);
        cJSON_AddStringToObject(button, "label", config->buttons[i].label);
        cJSON_AddStringToObject(button, "action", config->buttons[i].action);
        cJSON_AddStringToObject(button, "color", config->buttons[i].color);
        cJSON_AddItemToArray(buttons_array, button);
    }
    
    // Create device object
    cJSON* device = cJSON_CreateObject();
    cJSON_AddItemToObject(data, "device", device);
    cJSON_AddStringToObject(device, "name", device_info->name);
    cJSON_AddStringToObject(device, "firmware", device_info->firmware);
    cJSON_AddNumberToObject(device, "uptime", device_info->uptime);
    cJSON_AddNumberToObject(device, "heap", device_info->heap);
    
    // Convert to string
    char* json_string = cJSON_Print(root);
    cJSON_Delete(root);
    
    if (!json_string) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to generate JSON string");
        return ESP_ERR_NO_MEM;
    }
    
    size_t json_len = strlen(json_string);
    if (json_len >= max_size) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ JSON response too large: %zu bytes (max %zu)", json_len, max_size - 1);
        free(json_string);
        return ESP_ERR_INVALID_SIZE;
    }
    
    strcpy(json_output, json_string);
    free(json_string);
    
    ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ JSON response generated (%zu bytes)", json_len);
    return ESP_OK;
}

esp_err_t armdeck_config_parse_json_input(const char* json_input, armdeck_config_t* config)
{
    if (!json_input || !config) {
        return ESP_ERR_INVALID_ARG;
    }
    
    ESP_LOGI(ARMDECK_CONFIG_TAG, "📝 Parsing JSON configuration...");
    
    cJSON* root = cJSON_Parse(json_input);
    if (!root) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Failed to parse JSON");
        return ESP_ERR_INVALID_ARG;
    }
    
    // Initialize config structure
    memset(config, 0, sizeof(armdeck_config_t));
    
    // Parse version
    cJSON* version = cJSON_GetObjectItem(root, "version");
    if (cJSON_IsNumber(version)) {
        config->version = (uint8_t)version->valueint;
    } else {
        config->version = ARMDECK_CONFIG_VERSION;
    }
    
    // Parse buttons array
    cJSON* buttons = cJSON_GetObjectItem(root, "buttons");
    if (!cJSON_IsArray(buttons)) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ No buttons array found in JSON");
        cJSON_Delete(root);
        return ESP_ERR_INVALID_ARG;
    }
    
    int button_count = cJSON_GetArraySize(buttons);
    if (button_count != ARMDECK_MAX_BUTTONS) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Invalid button count: %d (expected %d)", button_count, ARMDECK_MAX_BUTTONS);
        cJSON_Delete(root);
        return ESP_ERR_INVALID_ARG;
    }
    
    for (int i = 0; i < ARMDECK_MAX_BUTTONS; i++) {
        cJSON* button = cJSON_GetArrayItem(buttons, i);
        if (!cJSON_IsObject(button)) {
            ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Button %d is not an object", i);
            cJSON_Delete(root);
            return ESP_ERR_INVALID_ARG;
        }
        
        button_config_t* btn_cfg = &config->buttons[i];
        
        // Parse ID
        cJSON* id = cJSON_GetObjectItem(button, "id");
        if (cJSON_IsNumber(id)) {
            btn_cfg->id = (uint8_t)id->valueint;
        } else {
            btn_cfg->id = i;
        }
        
        // Parse label
        cJSON* label = cJSON_GetObjectItem(button, "label");
        if (cJSON_IsString(label)) {
            strncpy(btn_cfg->label, label->valuestring, ARMDECK_LABEL_MAX_LEN - 1);
            btn_cfg->label[ARMDECK_LABEL_MAX_LEN - 1] = '\0';
        } else {
            snprintf(btn_cfg->label, ARMDECK_LABEL_MAX_LEN, "Button %d", i + 1);
        }
        
        // Parse action
        cJSON* action = cJSON_GetObjectItem(button, "action");
        if (cJSON_IsString(action)) {
            strncpy(btn_cfg->action, action->valuestring, ARMDECK_ACTION_MAX_LEN - 1);
            btn_cfg->action[ARMDECK_ACTION_MAX_LEN - 1] = '\0';
        } else {
            strcpy(btn_cfg->action, "KEY_F20");
        }
        
        // Parse color
        cJSON* color = cJSON_GetObjectItem(button, "color");
        if (cJSON_IsString(color)) {
            strncpy(btn_cfg->color, color->valuestring, ARMDECK_COLOR_MAX_LEN - 1);
            btn_cfg->color[ARMDECK_COLOR_MAX_LEN - 1] = '\0';
        } else {
            strcpy(btn_cfg->color, "#607D8B");
        }
        
        // Validate action exists in mapping
        uint8_t hid_code;
        bool is_consumer;
        if (armdeck_config_get_hid_code(btn_cfg->action, &hid_code, &is_consumer) != ESP_OK) {
            ESP_LOGW(ARMDECK_CONFIG_TAG, "⚠️ Unknown action '%s' for button %d, using default", btn_cfg->action, i);
            strcpy(btn_cfg->action, "KEY_F20");
        }
    }
    
    cJSON_Delete(root);
    
    // Calculate and set checksum
    config->checksum = armdeck_config_calculate_checksum(config);
    
    // Validate parsed configuration
    if (!armdeck_config_validate(config)) {
        ESP_LOGE(ARMDECK_CONFIG_TAG, "❌ Parsed configuration failed validation");
        return ESP_ERR_INVALID_ARG;
    }
    
    ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ JSON configuration parsed successfully");
    return ESP_OK;
}

esp_err_t armdeck_config_handle_ble_command(uint8_t command,
                                            const uint8_t* data,
                                            uint16_t data_len,
                                            uint8_t* response,
                                            uint16_t response_max_len,
                                            uint16_t* response_len)
{
    if (!response || !response_len) {
        return ESP_ERR_INVALID_ARG;
    }
    
    esp_err_t ret = ESP_OK;
    char* json_response = NULL;
    
    switch (command) {
        case ARMDECK_CMD_READ_CONFIG: {
            ESP_LOGI(ARMDECK_CONFIG_TAG, "📖 Handling READ_CONFIG command (0x50)");
            
            if (!config_initialized) {
                ret = armdeck_config_init();
                if (ret != ESP_OK) {
                    strcpy((char*)response, "{\"cmd\":\"0x50\",\"status\":\"error\",\"error\":\"Config not initialized\"}");
                    *response_len = strlen((char*)response);
                    return ESP_OK;
                }
            }
            
            device_info_t device_info;
            armdeck_config_get_device_info(&device_info);
            
            json_response = malloc(ARMDECK_JSON_MAX_SIZE);
            if (!json_response) {
                strcpy((char*)response, "{\"cmd\":\"0x50\",\"status\":\"error\",\"error\":\"Out of memory\"}");
                *response_len = strlen((char*)response);
                return ESP_OK;
            }
            
            ret = armdeck_config_generate_json_response(&current_config, &device_info, json_response, ARMDECK_JSON_MAX_SIZE);
            if (ret != ESP_OK) {
                strcpy((char*)response, "{\"cmd\":\"0x50\",\"status\":\"error\",\"error\":\"JSON generation failed\"}");
                *response_len = strlen((char*)response);
                free(json_response);
                return ESP_OK;
            }
            
            size_t json_len = strlen(json_response);
            if (json_len >= response_max_len) {
                strcpy((char*)response, "{\"cmd\":\"0x50\",\"status\":\"error\",\"error\":\"Response too large\"}");
                *response_len = strlen((char*)response);
                free(json_response);
                return ESP_OK;
            }
            
            memcpy(response, json_response, json_len);
            *response_len = json_len;
            free(json_response);
            
            ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ READ_CONFIG response sent (%d bytes)", *response_len);
            break;
        }
        
        case ARMDECK_CMD_WRITE_CONFIG: {
            ESP_LOGI(ARMDECK_CONFIG_TAG, "✏️ Handling WRITE_CONFIG command (0x51)");
            
            if (!data || data_len == 0) {
                strcpy((char*)response, "{\"cmd\":\"0x51\",\"status\":\"error\",\"error\":\"No data provided\"}");
                *response_len = strlen((char*)response);
                return ESP_OK;
            }
            
            // Ensure data is null-terminated
            char* json_input = malloc(data_len + 1);
            if (!json_input) {
                strcpy((char*)response, "{\"cmd\":\"0x51\",\"status\":\"error\",\"error\":\"Out of memory\"}");
                *response_len = strlen((char*)response);
                return ESP_OK;
            }
            
            memcpy(json_input, data, data_len);
            json_input[data_len] = '\0';
            
            armdeck_config_t new_config;
            ret = armdeck_config_parse_json_input(json_input, &new_config);
            free(json_input);
            
            if (ret != ESP_OK) {
                strcpy((char*)response, "{\"cmd\":\"0x51\",\"status\":\"error\",\"error\":\"JSON parsing failed\"}");
                *response_len = strlen((char*)response);
                return ESP_OK;
            }
            
            ret = armdeck_config_save_to_nvs(&new_config);
            if (ret != ESP_OK) {
                strcpy((char*)response, "{\"cmd\":\"0x51\",\"status\":\"error\",\"error\":\"NVS write failed\"}");
                *response_len = strlen((char*)response);
                return ESP_OK;
            }
            
            // Update current config
            memcpy(&current_config, &new_config, sizeof(armdeck_config_t));
            
            strcpy((char*)response, "{\"cmd\":\"0x51\",\"status\":\"ok\",\"message\":\"Config saved to NVS\"}");
            *response_len = strlen((char*)response);
            
            ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ WRITE_CONFIG completed successfully");
            break;
        }
        
        case ARMDECK_CMD_RESET_CONFIG: {
            ESP_LOGI(ARMDECK_CONFIG_TAG, "🔄 Handling RESET_CONFIG command (0x52)");
            
            ret = armdeck_config_reset_to_default(&current_config);
            if (ret != ESP_OK) {
                strcpy((char*)response, "{\"cmd\":\"0x52\",\"status\":\"error\",\"error\":\"Reset failed\"}");
                *response_len = strlen((char*)response);
                return ESP_OK;
            }
            
            ret = armdeck_config_save_to_nvs(&current_config);
            if (ret != ESP_OK) {
                strcpy((char*)response, "{\"cmd\":\"0x52\",\"status\":\"error\",\"error\":\"NVS save failed\"}");
                *response_len = strlen((char*)response);
                return ESP_OK;
            }
            
            strcpy((char*)response, "{\"cmd\":\"0x52\",\"status\":\"ok\",\"message\":\"Config reset to default\"}");
            *response_len = strlen((char*)response);
            
            ESP_LOGI(ARMDECK_CONFIG_TAG, "✅ RESET_CONFIG completed successfully");
            break;
        }
        
        default:
            ESP_LOGW(ARMDECK_CONFIG_TAG, "⚠️ Unknown command: 0x%02X", command);
            snprintf((char*)response, response_max_len, 
                     "{\"cmd\":\"0x%02X\",\"status\":\"error\",\"error\":\"Unknown command\"}", command);
            *response_len = strlen((char*)response);
            break;
    }
    
    return ESP_OK;
}

// Function to get current configuration (for use by main application)
const armdeck_config_t* armdeck_config_get_current(void)
{
    if (!config_initialized) {
        return NULL;
    }
    return &current_config;
}
