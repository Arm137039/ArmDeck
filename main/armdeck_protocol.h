#ifndef ARMDECK_PROTOCOL_H
#define ARMDECK_PROTOCOL_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

/* Protocol version */
#define ARMDECK_PROTOCOL_VERSION    0x01

/* Packet structure:
 * [HEADER][PAYLOAD][CHECKSUM]
 * 
 * HEADER (4 bytes):
 * - Magic (2 bytes): 0xAD 0xEC
 * - Command (1 byte)
 * - Length (1 byte): payload length
 * 
 * PAYLOAD (variable)
 * 
 * CHECKSUM (1 byte): XOR of all bytes
 */

/* Magic bytes */
#define ARMDECK_MAGIC_BYTE1         0xAD
#define ARMDECK_MAGIC_BYTE2         0xDC  

/* Command codes */
typedef enum {
    CMD_GET_INFO        = 0x10,  // Get device info
    CMD_GET_CONFIG      = 0x20,  // Get button configuration
    CMD_SET_CONFIG      = 0x21,  // Set button configuration
    CMD_RESET_CONFIG    = 0x22,  // Reset to default
    CMD_GET_BUTTON      = 0x30,  // Get single button config
    CMD_SET_BUTTON      = 0x31,  // Set single button config
    CMD_TEST_BUTTON     = 0x40,  // Test button press
    CMD_RESTART         = 0x50,  // Restart device
    CMD_ACK             = 0xA0,  // Acknowledge
    CMD_NACK            = 0xA1,  // Not acknowledge
} armdeck_cmd_t;

/* Error codes */
typedef enum {
    ERR_NONE            = 0x00,
    ERR_INVALID_CMD     = 0x01,
    ERR_INVALID_PARAM   = 0x02,
    ERR_CHECKSUM        = 0x03,
    ERR_LENGTH          = 0x04,
    ERR_BUSY            = 0x05,
    ERR_MEMORY          = 0x06,
} armdeck_error_t;

/* Action types for buttons */
typedef enum {
    ACTION_NONE         = 0x00,  // No action (disabled button)
    ACTION_KEY          = 0x01,  // Single key press
    ACTION_MEDIA        = 0x02,  // Media control
    ACTION_MACRO        = 0x03,  // Macro sequence
    ACTION_CUSTOM       = 0x04,  // Custom function
} armdeck_action_t;

/* Packet header structure */
typedef struct __attribute__((packed)) {
    uint8_t magic1;         // 0xAD
    uint8_t magic2;         // 0xEC
    uint8_t command;        // Command code
    uint8_t length;         // Payload length
} armdeck_header_t;

/* Device info response */
typedef struct __attribute__((packed)) {
    uint8_t protocol_version;
    uint8_t firmware_major;
    uint8_t firmware_minor;
    uint8_t firmware_patch;
    uint8_t num_buttons;
    uint8_t battery_level;
    uint32_t uptime_seconds;
    uint32_t free_heap;
    char device_name[16];
} armdeck_device_info_t;

/* Button configuration */
typedef struct __attribute__((packed)) {
    uint8_t button_id;      // 0-14 for 15 buttons
    uint8_t action_type;    // ACTION_KEY, ACTION_MEDIA, etc.
    uint8_t key_code;       // HID key code
    uint8_t modifier;       // Modifier keys (Ctrl, Alt, etc.)
    uint8_t color_r;        // Red component
    uint8_t color_g;        // Green component
    uint8_t color_b;        // Blue component
    uint8_t reserved;       // Padding
    char label[8];          // Short label (7 chars + null)
} armdeck_button_t;

/* Full configuration */
typedef struct __attribute__((packed)) {
    uint8_t version;
    uint8_t num_buttons;
    uint16_t reserved;
    armdeck_button_t buttons[15];
} armdeck_config_t;

/* Response packet */
typedef struct __attribute__((packed)) {
    armdeck_header_t header;
    uint8_t error_code;
    uint8_t data[255];      // Max payload
} armdeck_response_t;

/* Function prototypes */

/**
 * Parse incoming packet
 */
esp_err_t armdeck_protocol_parse(const uint8_t* data, uint16_t len, 
                                 armdeck_header_t* header, uint8_t** payload);

/**
 * Build response packet
 */
uint16_t armdeck_protocol_build_response(uint8_t cmd, uint8_t error, 
                                         const void* payload, uint8_t payload_len,
                                         uint8_t* output, uint16_t max_len);

/**
 * Calculate checksum
 */
uint8_t armdeck_protocol_checksum(const uint8_t* data, uint16_t len);

/**
 * Handle command and generate response
 */
esp_err_t armdeck_protocol_handle_command(const uint8_t* input, uint16_t input_len,
                                          uint8_t* output, uint16_t* output_len);

/**
 * Get button configuration
 */
const armdeck_button_t* armdeck_protocol_get_button_config(uint8_t button_id);

/**
 * Get full configuration
 */
const armdeck_config_t* armdeck_protocol_get_config(void);

#endif /* ARMDECK_PROTOCOL_H */