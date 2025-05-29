#ifndef ARMDECK_CONFIG_H
#define ARMDECK_CONFIG_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"
#include "armdeck_protocol.h"

/* Configuration management for ArmDeck */

/* NVS namespace and keys */
#define ARMDECK_NVS_NAMESPACE       "armdeck"
#define ARMDECK_NVS_KEY_CONFIG      "config"
#define ARMDECK_NVS_KEY_VERSION     "version"

/* Initialize configuration system */
esp_err_t armdeck_config_init(void);

/* Load configuration from NVS */
esp_err_t armdeck_config_load(void);

/* Save current configuration to NVS */
esp_err_t armdeck_config_save(void);

/* Reset configuration to factory defaults */
esp_err_t armdeck_config_reset(void);

/* Get current configuration */
const armdeck_config_t* armdeck_config_get(void);

/* Set configuration */
esp_err_t armdeck_config_set(const armdeck_config_t* config);

/* Get single button configuration */
const armdeck_button_t* armdeck_config_get_button(uint8_t button_id);

/* Set single button configuration */
esp_err_t armdeck_config_set_button(uint8_t button_id, const armdeck_button_t* button);

/* Validate configuration */
bool armdeck_config_validate(const armdeck_config_t* config);

#endif /* ARMDECK_CONFIG_H */