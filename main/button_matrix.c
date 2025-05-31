#include "button_matrix.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char* TAG = "ARMDECK_MATRIX";

/* GPIO pins for rows (outputs) */
static const int row_pins[MATRIX_ROWS] = {
    GPIO_NUM_2,   // ROW1 - Buttons 1,2,3,4,5
    GPIO_NUM_4,   // ROW2 - Buttons 6,7,8,9,10
    GPIO_NUM_5    // ROW3 - Buttons 11,12,13,14,15
};

/* GPIO pins for columns (inputs with pull-up) */
static const int col_pins[MATRIX_COLS] = {
    GPIO_NUM_18,  // COL1 - Buttons 1,6,11
    GPIO_NUM_19,  // COL2 - Buttons 2,7,12
    GPIO_NUM_21,  // COL3 - Buttons 3,8,13
    GPIO_NUM_22,  // COL4 - Buttons 4,9,14
    GPIO_NUM_23   // COL5 - Buttons 5,10,15
};

/* Button state tracking */
static bool button_states[TOTAL_BUTTONS] = {false};
static bool button_last_states[TOTAL_BUTTONS] = {false};
static uint32_t button_last_change[TOTAL_BUTTONS] = {0};

/* Task handle */
static TaskHandle_t scan_task_handle = NULL;
static bool scanning_enabled = false;

/* Callback */
static button_event_cb_t event_callback = NULL;

esp_err_t armdeck_matrix_init(void) {
    ESP_LOGI(TAG, "Initializing 5x3 button matrix...");
    
    /* Configure row pins (outputs, high by default) */
    for (int i = 0; i < MATRIX_ROWS; i++) {
        gpio_reset_pin(row_pins[i]);
        gpio_set_direction(row_pins[i], GPIO_MODE_OUTPUT);
        gpio_set_level(row_pins[i], 1);
        ESP_LOGD(TAG, "Row %d on GPIO %d", i + 1, row_pins[i]);
    }
    
    /* Configure column pins (inputs with pull-up) */
    for (int i = 0; i < MATRIX_COLS; i++) {
        gpio_reset_pin(col_pins[i]);
        gpio_set_direction(col_pins[i], GPIO_MODE_INPUT);
        gpio_set_pull_mode(col_pins[i], GPIO_PULLUP_ONLY);
        ESP_LOGD(TAG, "Col %d on GPIO %d", i + 1, col_pins[i]);
    }
    
    /* Initialize button states */
    for (int i = 0; i < TOTAL_BUTTONS; i++) {
        button_states[i] = false;
        button_last_states[i] = false;
        button_last_change[i] = 0;
    }
    
    ESP_LOGI(TAG, "Button matrix initialized");
    return ESP_OK;
}

void armdeck_matrix_set_callback(button_event_cb_t callback) {
    event_callback = callback;
}

static void scan_matrix(void) {
    uint32_t current_time = esp_timer_get_time() / 1000; // Convert to ms
    
    for (int row = 0; row < MATRIX_ROWS; row++) {
        /* Activate current row (set low) */
        gpio_set_level(row_pins[row], 0);
        
        /* Small delay for signal stabilization */
        esp_rom_delay_us(10);
        
        /* Read all columns */
        for (int col = 0; col < MATRIX_COLS; col++) {
            int button_id = (row * MATRIX_COLS) + col;
            bool current_state = (gpio_get_level(col_pins[col]) == 0); // Pressed = low
            
            /* Debounce logic */
            if (current_state != button_last_states[button_id]) {
                button_last_change[button_id] = current_time;
                button_last_states[button_id] = current_state;
            } else if ((current_time - button_last_change[button_id]) > DEBOUNCE_DELAY_MS) {
                /* State has been stable for debounce period */
                if (current_state != button_states[button_id]) {
                    button_states[button_id] = current_state;
                    
                    /* Trigger callback if registered */
                    if (event_callback) {
                        event_callback(button_id, current_state);
                    }
                    
                    ESP_LOGI(TAG, "Button %d %s", button_id + 1,
                            current_state ? "pressed" : "released");
                }
            }
        }
        
        /* Deactivate current row (set high) */
        gpio_set_level(row_pins[row], 1);
    }
}

static void scan_task(void* pvParameters) {
    ESP_LOGI(TAG, "Button scan task started");
    
    while (scanning_enabled) {
        scan_matrix();
        vTaskDelay(pdMS_TO_TICKS(SCAN_PERIOD_MS));
    }
    
    ESP_LOGI(TAG, "Button scan task stopped");
    vTaskDelete(NULL);
}

esp_err_t armdeck_matrix_start(void) {
    if (scan_task_handle != NULL) {
        ESP_LOGW(TAG, "Scan task already running");
        return ESP_ERR_INVALID_STATE;
    }
    
    scanning_enabled = true;
    
    BaseType_t ret = xTaskCreate(scan_task, "matrix_scan", 2048, NULL, 5, &scan_task_handle);
    if (ret != pdPASS) {
        ESP_LOGE(TAG, "Failed to create scan task");
        scanning_enabled = false;
        return ESP_FAIL;
    }
    
    ESP_LOGI(TAG, "Matrix scanning started");
    return ESP_OK;
}

esp_err_t armdeck_matrix_stop(void) {
    if (scan_task_handle == NULL) {
        ESP_LOGW(TAG, "Scan task not running");
        return ESP_ERR_INVALID_STATE;
    }
    
    scanning_enabled = false;
    
    /* Wait for task to finish */
    vTaskDelay(pdMS_TO_TICKS(SCAN_PERIOD_MS * 2));
    
    scan_task_handle = NULL;
    ESP_LOGI(TAG, "Matrix scanning stopped");
    return ESP_OK;
}

bool armdeck_matrix_get_button_state(uint8_t button_id) {
    if (button_id >= TOTAL_BUTTONS) {
        return false;
    }
    return button_states[button_id];
}

void armdeck_matrix_test_button(uint8_t button_id) {
    if (button_id >= TOTAL_BUTTONS || !event_callback) {
        return;
    }
    
    ESP_LOGI(TAG, "Testing button %d", button_id + 1);
    
    /* Simulate press */
    event_callback(button_id, true);
    vTaskDelay(pdMS_TO_TICKS(100));
    
    /* Simulate release */
    event_callback(button_id, false);
}