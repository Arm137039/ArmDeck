#ifndef ARMDECK_MATRIX_H
#define ARMDECK_MATRIX_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

/* Matrix configuration */
#define MATRIX_ROWS         3
#define MATRIX_COLS         4
#define TOTAL_BUTTONS       (MATRIX_ROWS * MATRIX_COLS)
#define DEBOUNCE_DELAY_MS   50
#define SCAN_PERIOD_MS      10

/* Button event callback */
typedef void (*button_event_cb_t)(uint8_t button_id, bool pressed);

/* Initialize button matrix */
esp_err_t armdeck_matrix_init(void);

/* Set button event callback */
void armdeck_matrix_set_callback(button_event_cb_t callback);

/* Start button scanning task */
esp_err_t armdeck_matrix_start(void);

/* Stop button scanning task */
esp_err_t armdeck_matrix_stop(void);

/* Get current button state */
bool armdeck_matrix_get_button_state(uint8_t button_id);

/* Test mode - simulate button press */
void armdeck_matrix_test_button(uint8_t button_id);

#endif /* ARMDECK_MATRIX_H */