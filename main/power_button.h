#ifndef POWER_BUTTON_H
#define POWER_BUTTON_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"
#include "driver/gpio.h"

/* Configuration du switch power */
#define POWER_SWITCH_GPIO       GPIO_NUM_12
#define POWER_DEBOUNCE_MS       100     // ms pour anti-rebond

/* États du système */
typedef enum {
    POWER_STATE_ON = 0,     // Switch ON - système actif
    POWER_STATE_OFF         // Switch OFF - système en veille
} power_state_t;

/* Types d'événements du switch */
typedef enum {
    POWER_EVENT_SWITCH_ON = 0,   // Switch activé
    POWER_EVENT_SWITCH_OFF       // Switch désactivé
} power_event_t;

/* Callback pour les événements du bouton power */
typedef void (*power_button_callback_t)(power_event_t event);

/* Initialiser le bouton power */
esp_err_t power_button_init(void);

/* Enregistrer un callback pour les événements */
void power_button_set_callback(power_button_callback_t callback);

/* Obtenir l'état actuel du système */
power_state_t power_button_get_state(void);

/* Forcer un changement d'état (pour les tests) */
esp_err_t power_button_set_state(power_state_t state);

/* Gérer la veille du système */
esp_err_t power_button_enter_sleep(void);

/* Gérer le réveil du système */
esp_err_t power_button_wake_up(void);

/* Gérer l'arrêt complet */
esp_err_t power_button_shutdown(void);

/* Vérifier l'état du switch et agir en conséquence */
void power_button_check_state(void);

#endif /* POWER_BUTTON_H */
