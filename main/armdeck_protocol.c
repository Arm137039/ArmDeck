#include "armdeck_protocol.h"
#include "armdeck_config.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>

static const char* TAG = "ARMDECK_PROTOCOL";

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

/* Current configuration in memory */
static armdeck_config_t current_config = {
    .version = ARMDECK_PROTOCOL_VERSION,
    .num_buttons = 15,
    .reserved = 0
};

static bool config_initialized = false;

uint8_t armdeck_protocol_checksum(const uint8_t* data, uint16_t len) {
    uint8_t checksum = 0;
    for (uint16_t i = 0; i < len; i++) {
        checksum ^= data[i];
    }
    return checksum;
}

esp_err_t armdeck_protocol_parse(const uint8_t* data, uint16_t len, 
                                 armdeck_header_t* header, uint8_t** payload) {
    if (len < sizeof(armdeck_header_t) + 1) {  // Header + checksum
        ESP_LOGE(TAG, "Packet too short: %d bytes", len);
        return ESP_ERR_INVALID_SIZE;
    }
    
    // Check magic bytes
    if (data[0] != ARMDECK_MAGIC_BYTE1 || data[1] != ARMDECK_MAGIC_BYTE2) {
        ESP_LOGE(TAG, "Invalid magic bytes: 0x%02X 0x%02X", data[0], data[1]);
        return ESP_ERR_INVALID_ARG;
    }
    
    // Copy header
    memcpy(header, data, sizeof(armdeck_header_t));
    
    // Verify length
    if (len != sizeof(armdeck_header_t) + header->length + 1) {
        ESP_LOGE(TAG, "Length mismatch: expected %d, got %d", 
                 sizeof(armdeck_header_t) + header->length + 1, len);
        return ESP_ERR_INVALID_SIZE;
    }
    
    // Verify checksum
    uint8_t calc_checksum = armdeck_protocol_checksum(data, len - 1);
    uint8_t recv_checksum = data[len - 1];
    
    if (calc_checksum != recv_checksum) {
        ESP_LOGE(TAG, "Checksum error: calc=0x%02X, recv=0x%02X", 
                 calc_checksum, recv_checksum);
        return ESP_ERR_INVALID_CRC;
    }
    
    // Set payload pointer
    if (header->length > 0) {
        *payload = (uint8_t*)(data + sizeof(armdeck_header_t));
    } else {
        *payload = NULL;
    }
    
    return ESP_OK;
}

uint16_t armdeck_protocol_build_response(uint8_t cmd, uint8_t error, 
                                         const void* payload, uint8_t payload_len,
                                         uint8_t* output, uint16_t max_len) {
    uint16_t total_len = sizeof(armdeck_header_t) + 1 + payload_len + 1;  // +1 for error, +1 for checksum
    
    if (total_len > max_len) {
        ESP_LOGE(TAG, "Response too large: %d > %d", total_len, max_len);
        return 0;
    }
    
    // Build header
    armdeck_header_t header = {
        .magic1 = ARMDECK_MAGIC_BYTE1,
        .magic2 = ARMDECK_MAGIC_BYTE2,
        .command = cmd,
        .length = 1 + payload_len  // Error code + payload
    };
    
    // Copy to output
    uint16_t pos = 0;
    memcpy(output + pos, &header, sizeof(header));
    pos += sizeof(header);
    
    // Add error code
    output[pos++] = error;
    
    // Add payload
    if (payload_len > 0 && payload != NULL) {
        memcpy(output + pos, payload, payload_len);
        pos += payload_len;
    }
    
    // Calculate and add checksum
    uint8_t checksum = armdeck_protocol_checksum(output, pos);
    output[pos++] = checksum;
    
    return pos;
}

static void load_config_from_nvs(void) {
    // Initialize with defaults
    memcpy(current_config.buttons, default_buttons, sizeof(default_buttons));
    
    // TODO: Load from NVS if exists
    // For now, just use defaults
    
    config_initialized = true;
    ESP_LOGI(TAG, "Configuration loaded (using defaults for now)");
}

static esp_err_t handle_get_info(uint8_t* output, uint16_t* output_len) {
    armdeck_device_info_t info = {
        .protocol_version = ARMDECK_PROTOCOL_VERSION,
        .firmware_major = 1,
        .firmware_minor = 2,        .firmware_patch = 0,
        .num_buttons = 15,
        .battery_level = 100,  // TODO: Read actual battery
        .uptime_seconds = esp_timer_get_time() / 1000000,
        .free_heap = esp_get_free_heap_size()
    };
    
    strncpy(info.device_name, "ArmDeck", sizeof(info.device_name) - 1);
    
    *output_len = armdeck_protocol_build_response(CMD_GET_INFO, ERR_NONE, 
                                                  &info, sizeof(info), 
                                                  output, 256);
    return ESP_OK;
}

static esp_err_t handle_get_config(uint8_t* output, uint16_t* output_len) {
    // Use the proper configuration system instead of local config
    const armdeck_config_t* config = armdeck_config_get();
    if (!config) {
        ESP_LOGE(TAG, "Failed to get configuration from main config system");
        *output_len = armdeck_protocol_build_response(CMD_GET_CONFIG, ERR_MEMORY,
                                                      NULL, 0, output, 256);
        return ESP_ERR_INVALID_STATE;
    }
    
    *output_len = armdeck_protocol_build_response(CMD_GET_CONFIG, ERR_NONE,
                                                  config, sizeof(armdeck_config_t),
                                                  output, 256);
    return ESP_OK;
}

static esp_err_t handle_set_config(const uint8_t* payload, uint8_t payload_len,
                                  uint8_t* output, uint16_t* output_len) {
    if (payload_len != sizeof(armdeck_config_t)) {
        *output_len = armdeck_protocol_build_response(CMD_SET_CONFIG, ERR_INVALID_PARAM,
                                                      NULL, 0, output, 256);
        return ESP_ERR_INVALID_SIZE;
    }
    
    // Copy new configuration
    memcpy(&current_config, payload, sizeof(current_config));
    
    // TODO: Save to NVS
    
    ESP_LOGI(TAG, "Configuration updated");
    
    *output_len = armdeck_protocol_build_response(CMD_SET_CONFIG, ERR_NONE,
                                                  NULL, 0, output, 256);
    return ESP_OK;
}

static esp_err_t handle_get_button(const uint8_t* payload, uint8_t payload_len,
                                  uint8_t* output, uint16_t* output_len) {
    ESP_LOGI(TAG, "handle_get_button: payload_len=%d", payload_len);
    
    // Le payload contient directement l'ID du bouton (pas d'error code ici)
    if (payload_len != 1) {
        ESP_LOGE(TAG, "Invalid payload length: %d, expected: 1", payload_len);
        *output_len = armdeck_protocol_build_response(CMD_GET_BUTTON, ERR_INVALID_PARAM,
                                                      NULL, 0, output, 256);
        return ESP_ERR_INVALID_SIZE;
    }
    
    // L'ID du bouton est directement dans payload[0]
    uint8_t button_id = payload[0];
    
    if (button_id >= 15) {
        ESP_LOGE(TAG, "Invalid button ID: %d", button_id);
        *output_len = armdeck_protocol_build_response(CMD_GET_BUTTON, ERR_INVALID_PARAM,
                                                      NULL, 0, output, 256);
        return ESP_ERR_INVALID_ARG;
    }
      // Use the proper configuration system instead of local config
    const armdeck_button_t* button = armdeck_config_get_button(button_id);
    if (!button) {
        ESP_LOGE(TAG, "Failed to get button %d config from main config system", button_id);
        *output_len = armdeck_protocol_build_response(CMD_GET_BUTTON, ERR_MEMORY,
                                                      NULL, 0, output, 256);
        return ESP_ERR_INVALID_STATE;
    }
    
    ESP_LOGI(TAG, "Sending button %d config: %s (action=%d, key=0x%02X)", 
             button_id, button->label, button->action_type, button->key_code);
    
    *output_len = armdeck_protocol_build_response(CMD_GET_BUTTON, ERR_NONE,
                                                  button, sizeof(armdeck_button_t),
                                                  output, 256);
    return ESP_OK;
}

static esp_err_t handle_set_button(const uint8_t* payload, uint8_t payload_len,
                                  uint8_t* output, uint16_t* output_len) {
    if (payload_len != sizeof(armdeck_button_t)) {
        *output_len = armdeck_protocol_build_response(CMD_SET_BUTTON, ERR_INVALID_PARAM,
                                                      NULL, 0, output, 256);
        return ESP_ERR_INVALID_SIZE;
    }
    
    // Debug: Print raw payload bytes
    ESP_LOGI(TAG, "Raw payload bytes (%d bytes):", payload_len);
    ESP_LOG_BUFFER_HEX(TAG, payload, payload_len);
    
    armdeck_button_t* button = (armdeck_button_t*)payload;
    
    // Debug: Print parsed button structure fields
    ESP_LOGI(TAG, "Parsed button: id=%d, action_type=%d, key_code=0x%02X, modifier=%d", 
             button->button_id, button->action_type, button->key_code, button->modifier);
    ESP_LOGI(TAG, "Button colors: R=%d, G=%d, B=%d, reserved=%d", 
             button->color_r, button->color_g, button->color_b, button->reserved);
    ESP_LOGI(TAG, "Button label: '%s'", button->label);
    
      if (button->button_id >= 15) {
        *output_len = armdeck_protocol_build_response(CMD_SET_BUTTON, ERR_INVALID_PARAM,
                                                      NULL, 0, output, 256);
        return ESP_ERR_INVALID_ARG;
    }
    
    // Update button configuration in both internal config and proper config system
    memcpy(&current_config.buttons[button->button_id], button, sizeof(armdeck_button_t));
    
    // Save using the proper configuration system
    esp_err_t ret = armdeck_config_set_button(button->button_id, button);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to save button configuration: %s", esp_err_to_name(ret));
        *output_len = armdeck_protocol_build_response(CMD_SET_BUTTON, ERR_MEMORY,
                                                      NULL, 0, output, 256);
        return ret;
    }
    
    ESP_LOGI(TAG, "Button %d updated and saved: %s (action_type=%d)", 
             button->button_id, button->label, button->action_type);
    
    *output_len = armdeck_protocol_build_response(CMD_SET_BUTTON, ERR_NONE,
                                                  NULL, 0, output, 256);
    return ESP_OK;
}

static esp_err_t handle_test_button(const uint8_t* payload, uint8_t payload_len,
                                   uint8_t* output, uint16_t* output_len) {
    if (payload_len != 1) {
        *output_len = armdeck_protocol_build_response(CMD_TEST_BUTTON, ERR_INVALID_PARAM,
                                                      NULL, 0, output, 256);
        return ESP_ERR_INVALID_SIZE;
    }
      uint8_t button_id = payload[0];
    if (button_id >= 15) {
        *output_len = armdeck_protocol_build_response(CMD_TEST_BUTTON, ERR_INVALID_PARAM,
                                                      NULL, 0, output, 256);
        return ESP_ERR_INVALID_ARG;
    }
    
    // TODO: Trigger button press simulation
    ESP_LOGI(TAG, "Test button %d", button_id);
    
    *output_len = armdeck_protocol_build_response(CMD_TEST_BUTTON, ERR_NONE,
                                                  NULL, 0, output, 256);
    return ESP_OK;
}

esp_err_t armdeck_protocol_handle_command(const uint8_t* input, uint16_t input_len,
                                          uint8_t* output, uint16_t* output_len) {
    
    ESP_LOGI(TAG, "=== PROTOCOL HANDLER CALLED ===");
    ESP_LOGI(TAG, "Input length: %d", input_len);
    ESP_LOGI(TAG, "Input data:");
    ESP_LOG_BUFFER_HEX(TAG, input, input_len);
    
    armdeck_header_t header;
    uint8_t* payload = NULL;
    
    ESP_LOGI(TAG, "Received command packet: len=%d, data=[0x%02X 0x%02X 0x%02X 0x%02X...]", 
             input_len, 
             input_len > 0 ? input[0] : 0,
             input_len > 1 ? input[1] : 0, 
             input_len > 2 ? input[2] : 0,
             input_len > 3 ? input[3] : 0);
    
    // Parse input packet
    esp_err_t ret = armdeck_protocol_parse(input, input_len, &header, &payload);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to parse packet: %s", esp_err_to_name(ret));
        *output_len = armdeck_protocol_build_response(CMD_NACK, ERR_CHECKSUM,
                                                      NULL, 0, output, 256);
        return ret;
    }
    
    ESP_LOGI(TAG, "Parsed command: 0x%02X, payload_len: %d", header.command, header.length);
    
    // Handle command
    switch (header.command) {
        case CMD_GET_INFO:
            ESP_LOGI(TAG, "Handling CMD_GET_INFO");
            return handle_get_info(output, output_len);
            
        case CMD_GET_CONFIG:
            ESP_LOGI(TAG, "Handling CMD_GET_CONFIG");
            return handle_get_config(output, output_len);
            
        case CMD_SET_CONFIG:
            ESP_LOGI(TAG, "Handling CMD_SET_CONFIG");
            return handle_set_config(payload, header.length, output, output_len);
            
        case CMD_GET_BUTTON:
            ESP_LOGI(TAG, "Handling CMD_GET_BUTTON");
            return handle_get_button(payload, header.length, output, output_len);
            
        case CMD_SET_BUTTON:
            ESP_LOGI(TAG, "Handling CMD_SET_BUTTON");
            return handle_set_button(payload, header.length, output, output_len);
            
        case CMD_TEST_BUTTON:
            ESP_LOGI(TAG, "Handling CMD_TEST_BUTTON");
            return handle_test_button(payload, header.length, output, output_len);
            
        case CMD_RESET_CONFIG:
            ESP_LOGI(TAG, "Handling CMD_RESET_CONFIG");
            memcpy(current_config.buttons, default_buttons, sizeof(default_buttons));
            ESP_LOGI(TAG, "Configuration reset to defaults");
            *output_len = armdeck_protocol_build_response(CMD_RESET_CONFIG, ERR_NONE,
                                                          NULL, 0, output, 256);
            return ESP_OK;
            
        case CMD_RESTART:
            ESP_LOGI(TAG, "Handling CMD_RESTART");
            *output_len = armdeck_protocol_build_response(CMD_RESTART, ERR_NONE,
                                                          NULL, 0, output, 256);
            vTaskDelay(100 / portTICK_PERIOD_MS);
            esp_restart();
            return ESP_OK;
            
        default:
            ESP_LOGW(TAG, "Unknown command: 0x%02X", header.command);
            *output_len = armdeck_protocol_build_response(CMD_NACK, ERR_INVALID_CMD,
                                                          NULL, 0, output, 256);
            return ESP_ERR_NOT_FOUND;
    }
}

const armdeck_button_t* armdeck_protocol_get_button_config(uint8_t button_id) {
    if (button_id >= 15) {
        return NULL;
    }
    
    // Use the proper configuration system
    return armdeck_config_get_button(button_id);
}

const armdeck_config_t* armdeck_protocol_get_config(void) {
    // Use the proper configuration system
    return armdeck_config_get();
}