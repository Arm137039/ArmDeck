#ifndef ARMDECK_CONFIG_H
#define ARMDECK_CONFIG_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"
#include "cJSON.h"

/* Configuration Constants */
#define ARMDECK_CONFIG_VERSION      1
#define ARMDECK_MAX_BUTTONS         12
#define ARMDECK_LABEL_MAX_LEN       16
#define ARMDECK_ACTION_MAX_LEN      32
#define ARMDECK_COLOR_MAX_LEN       8
#define ARMDECK_JSON_MAX_SIZE       1500
#define ARMDECK_FIRMWARE_VERSION    "1.2.0"

/* NVS Configuration */
#define ARMDECK_NVS_NAMESPACE       "armdeck_cfg"
#define ARMDECK_NVS_KEY_BUTTONS     "buttons"
#define ARMDECK_CONFIG_TAG          "ARMDECK_CONFIG"

/* BLE Command Codes */
#define ARMDECK_CMD_READ_CONFIG     0x50
#define ARMDECK_CMD_WRITE_CONFIG    0x51
#define ARMDECK_CMD_RESET_CONFIG    0x52

/* Button Configuration Structure */
typedef struct {
    uint8_t id;                             // Button ID (0-11)
    char label[ARMDECK_LABEL_MAX_LEN];      // Display label
    char action[ARMDECK_ACTION_MAX_LEN];    // Action type
    char color[ARMDECK_COLOR_MAX_LEN];      // Color code (#RRGGBB)
} button_config_t;

/* Complete Device Configuration */
typedef struct {
    uint8_t version;                        // Configuration version
    button_config_t buttons[ARMDECK_MAX_BUTTONS];
    uint32_t checksum;                      // CRC32 for validation
} armdeck_config_t;

/* Device Information Structure */
typedef struct {
    char name[32];
    char firmware[16];
    uint32_t uptime;
    uint32_t heap;
} device_info_t;

/* Action to HID Code Mapping */
typedef struct {
    const char* action;
    uint8_t hid_code;
    bool is_consumer;  // true for consumer control, false for keyboard
} action_mapping_t;

/* Function Declarations */

/**
 * @brief Initialize configuration system
 * @return ESP_OK on success, error code on failure
 */
esp_err_t armdeck_config_init(void);

/**
 * @brief Load configuration from NVS Flash
 * @param config Pointer to configuration structure
 * @return ESP_OK on success, ESP_ERR_NOT_FOUND if no config exists
 */
esp_err_t armdeck_config_load_from_nvs(armdeck_config_t* config);

/**
 * @brief Save configuration to NVS Flash
 * @param config Pointer to configuration structure
 * @return ESP_OK on success, error code on failure
 */
esp_err_t armdeck_config_save_to_nvs(const armdeck_config_t* config);

/**
 * @brief Reset configuration to default values
 * @param config Pointer to configuration structure
 * @return ESP_OK on success
 */
esp_err_t armdeck_config_reset_to_default(armdeck_config_t* config);

/**
 * @brief Generate JSON response for READ_CONFIG command (0x50)
 * @param config Current configuration
 * @param device_info Current device information
 * @param json_output Buffer for JSON string (must be at least ARMDECK_JSON_MAX_SIZE)
 * @param max_size Maximum size of output buffer
 * @return ESP_OK on success, error code on failure
 */
esp_err_t armdeck_config_generate_json_response(const armdeck_config_t* config,
                                                const device_info_t* device_info,
                                                char* json_output,
                                                size_t max_size);

/**
 * @brief Parse JSON configuration from WRITE_CONFIG command (0x51)
 * @param json_input JSON string input
 * @param config Pointer to configuration structure to fill
 * @return ESP_OK on success, error code on failure
 */
esp_err_t armdeck_config_parse_json_input(const char* json_input, armdeck_config_t* config);

/**
 * @brief Validate configuration structure
 * @param config Configuration to validate
 * @return true if valid, false if invalid
 */
bool armdeck_config_validate(const armdeck_config_t* config);

/**
 * @brief Calculate CRC32 checksum for configuration
 * @param config Configuration structure
 * @return CRC32 checksum
 */
uint32_t armdeck_config_calculate_checksum(const armdeck_config_t* config);

/**
 * @brief Get HID code for action string
 * @param action Action string (e.g., "MEDIA_PLAY_PAUSE")
 * @param hid_code Pointer to store HID code
 * @param is_consumer Pointer to store if it's consumer control
 * @return ESP_OK if action found, ESP_ERR_NOT_FOUND if unknown action
 */
esp_err_t armdeck_config_get_hid_code(const char* action, uint8_t* hid_code, bool* is_consumer);

/**
 * @brief Get current device information
 * @param device_info Pointer to device information structure
 */
void armdeck_config_get_device_info(device_info_t* device_info);

/**
 * @brief Handle BLE configuration commands
 * @param command Command code (0x50, 0x51, 0x52)
 * @param data Input data (for 0x51)
 * @param data_len Length of input data
 * @param response Response buffer
 * @param response_max_len Maximum response length
 * @param response_len Actual response length
 * @return ESP_OK on success, error code on failure
 */
esp_err_t armdeck_config_handle_ble_command(uint8_t command,
                                            const uint8_t* data,
                                            uint16_t data_len,
                                            uint8_t* response,
                                            uint16_t response_max_len,
                                            uint16_t* response_len);

/**
 * @brief Get current configuration (read-only)
 * @return Pointer to current configuration, NULL if not initialized
 */
const armdeck_config_t* armdeck_config_get_current(void);

#endif /* ARMDECK_CONFIG_H */
