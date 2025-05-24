#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "button_matrix.h"
#include "armdeck_service.h"

#define BUTTON_TAG "BUTTON_MATRIX"

// Définir les pins pour les lignes et colonnes
// Vous devrez adapter ces valeurs à votre matériel
static const gpio_num_t row_pins[BUTTON_MATRIX_ROWS] = {GPIO_NUM_32, GPIO_NUM_33, GPIO_NUM_25, GPIO_NUM_26};
static const gpio_num_t col_pins[BUTTON_MATRIX_COLS] = {GPIO_NUM_27, GPIO_NUM_14, GPIO_NUM_12, GPIO_NUM_13};

// État des boutons
static button_state_t button_states[BUTTON_MATRIX_SIZE];

// Callback pour les événements de bouton
static button_event_cb_t button_callback = NULL;

// Debounce time in milliseconds
#define DEBOUNCE_TIME_MS 50

// Initialiser la matrice de boutons
esp_err_t button_matrix_init(void)
{
    // Configurer les pins de ligne comme sorties
    for (int i = 0; i < BUTTON_MATRIX_ROWS; i++) {
        gpio_config_t io_conf = {
            .pin_bit_mask = (1ULL << row_pins[i]),
            .mode = GPIO_MODE_OUTPUT,
            .pull_up_en = GPIO_PULLUP_DISABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
            .intr_type = GPIO_INTR_DISABLE
        };
        gpio_config(&io_conf);
        gpio_set_level(row_pins[i], 1); // Désactiver les lignes (logique inverse)
    }
    
    // Configurer les pins de colonne comme entrées avec pull-up
    for (int i = 0; i < BUTTON_MATRIX_COLS; i++) {
        gpio_config_t io_conf = {
            .pin_bit_mask = (1ULL << col_pins[i]),
            .mode = GPIO_MODE_INPUT,
            .pull_up_en = GPIO_PULLUP_ENABLE,
            .pull_down_en = GPIO_PULLDOWN_DISABLE,
            .intr_type = GPIO_INTR_DISABLE
        };
        gpio_config(&io_conf);
    }
    
    // Initialiser l'état des boutons
    memset(button_states, 0, sizeof(button_states));
    
    // Définir le callback par défaut pour envoyer les événements au service BLE
    button_callback = armdeck_send_button_event;
    
    ESP_LOGI(BUTTON_TAG, "Button matrix initialized");
    return ESP_OK;
}

// Scanner la matrice pour détecter les boutons pressés
void button_matrix_scan(void)
{
    uint32_t current_time = esp_timer_get_time() / 1000; // en ms
    
    // Parcourir chaque ligne
    for (int row = 0; row < BUTTON_MATRIX_ROWS; row++) {
        // Activer la ligne actuelle (logique inverse: 0 = actif)
        gpio_set_level(row_pins[row], 0);
        
        // Petit délai pour stabiliser les signaux
        vTaskDelay(1 / portTICK_PERIOD_MS);
        
        // Lire toutes les colonnes
        for (int col = 0; col < BUTTON_MATRIX_COLS; col++) {
            int button_id = row * BUTTON_MATRIX_COLS + col;
            
            // Lire l'état du bouton (0 = pressé, car pull-up)
            bool current_state = (gpio_get_level(col_pins[col]) == 0);
            
            // Vérifier si l'état a changé et si le debounce est respecté
            if (current_state != button_states[button_id].last_state && 
                (current_time - button_states[button_id].last_change) > DEBOUNCE_TIME_MS) {
                
                button_states[button_id].pressed = current_state;
                button_states[button_id].last_state = current_state;
                button_states[button_id].last_change = current_time;
                
                // Appeler le callback si défini
                if (button_callback) {
                    button_callback(button_id, current_state);
                }
                
                ESP_LOGI(BUTTON_TAG, "Button %d %s", button_id, current_state ? "pressed" : "released");
            }
        }
        
        // Désactiver la ligne actuelle
        gpio_set_level(row_pins[row], 1);
    }
}

// Définir la couleur d'un bouton (si les LEDs sont implémentées)
esp_err_t button_matrix_set_color(uint8_t button_id, uint32_t rgb_color)
{
    if (button_id >= BUTTON_MATRIX_SIZE) {
        return ESP_ERR_INVALID_ARG;
    }
    
    button_states[button_id].color = rgb_color;
    
    // TODO: Implémenter le contrôle des LEDs RGB si disponible
    ESP_LOGI(BUTTON_TAG, "Button %d color set to 0x%06x", button_id, rgb_color);
    
    return ESP_OK;
}

// Obtenir l'état d'un bouton spécifique
bool button_matrix_is_pressed(uint8_t button_id)
{
    if (button_id < BUTTON_MATRIX_SIZE) {
        return button_states[button_id].pressed;
    }
    return false;
}

// Configurer le callback pour les événements de bouton
void button_matrix_set_callback(button_event_cb_t callback)
{
    button_callback = callback;
}