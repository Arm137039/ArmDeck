#include "armdeck_config.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include <string.h>

static const char* TAG = "ARMDECK_CONFIG";

/* Current configuration in memory */
static armdeck_config_t current_config;
static bool config_initialized = false;

/* Default button configuration */
static const armdeck_button_t default_buttons[15] = {
    {0,  ACTION_MEDIA, 0xCD, 0, 0x4C, 0xAF, 0x50, 0, "Play"},    // Play/Pause - Green
    {1,  ACTION_MEDIA, 0xB5, 0, 0x21, 0x96, 0xF3, 0, "Next"},    // Next - Blue
    {2,  ACTION_MEDIA, 0xB6, 0, 0x21, 0x96, 0xF3, 0, "Prev"},    // Previous - Blue
    {3,  ACTION_MEDIA, 0xE9, 0, 0xFF, 0x98, 0x00, 0, "Vol+"},    // Volume Up - Orange
    {4,  ACTION_MEDIA, 0xEA, 0, 0xFF, 0x98, 0x00, 0, "Vol-"},    // Volume Down - Orange
    {5,  ACTION_MEDIA, 0xE2, 0, 0xF4, 0x43, 0x36, 0, "Mute"},    // Mute - Red
    {6,  ACTION_MEDIA, 0xB7, 0, 0x9C, 0x27, 0xB0, 0, "Stop"},    // Stop - Purple
    {7,  ACTION_KEY,   0x6F, 0, 0x60, 0x7D, 0x8B, 0, "F20"},     // F20 - Blue Grey
    {8,  ACTION_KEY,   0x70, 0, 0x60, 0x7D, 0x8B, 0, "F21"},     // F21
    {9,  ACTION_KEY,   0x71, 0, 0x60, 0x7D, 0x8B, 0, "F22"},     // F22
    {10, ACTION_KEY,   0x72, 0, 0x60, 0x7D, 0x8B, 0, "F23"},     // F23
    {11, ACTION_KEY,   0x73, 0, 0x60, 0x7D, 0x8B, 0, "F24"},     // F24
    {12, ACTION_KEY,   0x74, 0, 0x3F, 0x51, 0xB5, 0, "F13"},     // F13 - Indigo
    {13, ACTION_KEY,   0x75, 0, 0x3F, 0x51, 0xB5, 0, "F14"},     // F14 - Indigo
    {14, ACTION_KEY,   0x76, 0, 0x3F, 0x51, 0xB5, 0, "F15"},     // F15 - Indigo
};

esp_err_t armdeck_config_init(void) {
    ESP_LOGI(TAG, "Initializing configuration system");
      /* Initialize with defaults */
    current_config.version = ARMDECK_PROTOCOL_VERSION;
    current_config.num_buttons = 15;
    current_config.reserved = 0;
    memcpy(current_config.buttons, default_buttons, sizeof(default_buttons));
    
    config_initialized = true;
    
    /* Try to load from NVS */
    esp_err_t ret = armdeck_config_load();
    if (ret == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "No saved configuration found, using defaults");
        /* Save defaults to NVS */
        ret = armdeck_config_save();
    }
    
    return ESP_OK;
}

esp_err_t armdeck_config_load(void) {
    nvs_handle_t handle;
    esp_err_t ret;
    
    ESP_LOGI(TAG, "Attempting to load configuration from NVS");
    
    ret = nvs_open(ARMDECK_NVS_NAMESPACE, NVS_READONLY, &handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS: %s", esp_err_to_name(ret));
        return ret;
    }
    
    size_t size = sizeof(armdeck_config_t);
    ESP_LOGI(TAG, "Looking for blob of size %d bytes", size);
    
    ret = nvs_get_blob(handle, ARMDECK_NVS_KEY_CONFIG, &current_config, &size);
    
    nvs_close(handle);
    
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Successfully read %d bytes from NVS", size);
        ESP_LOGI(TAG, "Loaded config version: %d, num_buttons: %d", 
                 current_config.version, current_config.num_buttons);
        
        // Log first few buttons for verification
        for (int i = 0; i < 3 && i < 15; i++) {
            ESP_LOGI(TAG, "Button %d: action_type=%d, key_code=0x%02X, label='%s'", 
                     i, current_config.buttons[i].action_type, 
                     current_config.buttons[i].key_code, current_config.buttons[i].label);
        }
        
        /* Validate loaded configuration */
        if (!armdeck_config_validate(&current_config)) {
            ESP_LOGE(TAG, "Loaded configuration is invalid, keeping defaults");
            return ESP_ERR_INVALID_STATE;
        }
        ESP_LOGI(TAG, "Configuration loaded from NVS and validated successfully");
    } else if (ret == ESP_ERR_NVS_NOT_FOUND) {
        ESP_LOGI(TAG, "No configuration found in NVS, using defaults");
        ret = ESP_OK;
    } else {
        ESP_LOGE(TAG, "Failed to load configuration: %s", esp_err_to_name(ret));
    }
    
    return ret;
}

esp_err_t armdeck_config_save(void) {
    nvs_handle_t handle;
    esp_err_t ret;
    
    ret = nvs_open(ARMDECK_NVS_NAMESPACE, NVS_READWRITE, &handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ret = nvs_set_blob(handle, ARMDECK_NVS_KEY_CONFIG, &current_config, sizeof(current_config));
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to save configuration: %s", esp_err_to_name(ret));
        nvs_close(handle);
        return ret;
    }
    
    ret = nvs_commit(handle);
    nvs_close(handle);
    
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Configuration saved to NVS");
    }
    
    return ret;
}

esp_err_t armdeck_config_reset(void) {
    ESP_LOGI(TAG, "Resetting configuration to factory defaults");
      /* Reset to defaults */
    current_config.version = ARMDECK_PROTOCOL_VERSION;
    current_config.num_buttons = 15;
    current_config.reserved = 0;
    memcpy(current_config.buttons, default_buttons, sizeof(default_buttons));
    
    /* Save to NVS */
    return armdeck_config_save();
}

const armdeck_config_t* armdeck_config_get(void) {
    if (!config_initialized) {
        return NULL;
    }
    return &current_config;
}

esp_err_t armdeck_config_set(const armdeck_config_t* config) {
    if (!config || !config_initialized) {
        return ESP_ERR_INVALID_ARG;
    }
    
    if (!armdeck_config_validate(config)) {
        return ESP_ERR_INVALID_ARG;
    }
    
    memcpy(&current_config, config, sizeof(current_config));
    return armdeck_config_save();
}

const armdeck_button_t* armdeck_config_get_button(uint8_t button_id) {
    if (!config_initialized || button_id >= 15) {
        return NULL;
    }
    return &current_config.buttons[button_id];
}

esp_err_t armdeck_config_set_button(uint8_t button_id, const armdeck_button_t* button) {
    if (!config_initialized || !button || button_id >= 15) {
        return ESP_ERR_INVALID_ARG;
    }
    
    memcpy(&current_config.buttons[button_id], button, sizeof(armdeck_button_t));
    return armdeck_config_save();
}

bool armdeck_config_validate(const armdeck_config_t* config) {
    if (!config) {
        return false;
    }
    
    /* Check version */
    if (config->version != ARMDECK_PROTOCOL_VERSION) {
        ESP_LOGW(TAG, "Version mismatch: %d != %d", config->version, ARMDECK_PROTOCOL_VERSION);
        return false;
    }
      /* Check number of buttons */
    if (config->num_buttons != 15) {
        ESP_LOGW(TAG, "Invalid number of buttons: %d", config->num_buttons);
        return false;
    }
    
    /* Validate each button */
    for (int i = 0; i < 15; i++) {
        const armdeck_button_t* btn = &config->buttons[i];
        
        /* Check button ID */
        if (btn->button_id != i) {
            ESP_LOGW(TAG, "Button %d has wrong ID: %d", i, btn->button_id);
            return false;
        }
          /* Check action type */
        if (btn->action_type < ACTION_NONE || btn->action_type > ACTION_CUSTOM) {
            ESP_LOGW(TAG, "Button %d has invalid action type: %d", i, btn->action_type);
            return false;
        }
        
        /* Check label is null terminated */
        bool null_found = false;
        for (int j = 0; j < 8; j++) {
            if (btn->label[j] == '\0') {
                null_found = true;
                break;
            }
        }
        if (!null_found) {
            ESP_LOGW(TAG, "Button %d label not null terminated", i);
            return false;
        }
    }
    
    return true;
}