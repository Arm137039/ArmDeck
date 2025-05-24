#ifndef BUTTON_MATRIX_H
#define BUTTON_MATRIX_H

#include <stdbool.h>
#include <stdint.h>
#include "esp_err.h"

// Définir les dimensions de la matrice de boutons
#define BUTTON_MATRIX_ROWS 4
#define BUTTON_MATRIX_COLS 4
#define BUTTON_MATRIX_SIZE (BUTTON_MATRIX_ROWS * BUTTON_MATRIX_COLS)

// Structure pour stocker l'état d'un bouton
typedef struct {
    bool pressed;          // État actuel (pressé ou non)
    bool last_state;       // État précédent pour la détection de changement
    uint32_t last_change;  // Horodatage du dernier changement (pour le debouncing)
    uint32_t color;        // Couleur RGB configurée
} button_state_t;

// Initialiser la matrice de boutons
esp_err_t button_matrix_init(void);

// Scanner la matrice pour détecter les boutons pressés
void button_matrix_scan(void);

// Définir la couleur d'un bouton
esp_err_t button_matrix_set_color(uint8_t button_id, uint32_t rgb_color);

// Obtenir l'état d'un bouton spécifique
bool button_matrix_is_pressed(uint8_t button_id);

// Configurer le callback pour les événements de bouton
typedef void (*button_event_cb_t)(uint8_t button_id, bool pressed);
void button_matrix_set_callback(button_event_cb_t callback);

#endif /* BUTTON_MATRIX_H */