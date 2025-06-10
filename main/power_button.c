#include "power_button.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "esp_sleep.h"
#include "armdeck_ble.h"
#include "armdeck_service.h"
#include "button_matrix.h"

static const char* TAG = "POWER_SWITCH";

/* Variables globales */
static power_state_t current_state = POWER_STATE_ON;
static power_button_callback_t event_callback = NULL;
static bool last_switch_state = true; // true = ON (pull-up), false = OFF (GND)

/* Fonction helper pour vérifier la connexion BLE */
static bool is_ble_connected(void) {
    return armdeck_service_get_conn_id() != 0xFFFF;
}

/* Variable pour signaler le deep sleep depuis l'ISR */
static volatile bool deep_sleep_requested = false;

/* ISR pour détecter les changements d'état du switch */
static void IRAM_ATTR power_switch_isr(void* arg) {
    // Lecture directe de l'état du switch
    bool current_switch_state = gpio_get_level(POWER_SWITCH_GPIO);
    
    // Log pour debug - voir si l'ISR se déclenche
    ESP_EARLY_LOGI(TAG, "ISR: switch=%s, last=%s", 
                   current_switch_state ? "ON" : "OFF", 
                   last_switch_state ? "ON" : "OFF");
    
    // Si le switch passe à OFF, demander l'arrêt immédiat
    if (!current_switch_state && last_switch_state) {
        // Switch OFF détecté - demander arrêt immédiat
        deep_sleep_requested = true;
        ESP_EARLY_LOGI(TAG, "ISR: Switch OFF detecte - deep sleep demande");
    }
    // Si le switch passe à ON, signaler l'événement
    else if (current_switch_state && !last_switch_state) {
        ESP_EARLY_LOGI(TAG, "ISR: Switch ON detecte");
        // Ici on pourrait envoyer un événement si nécessaire
    }
    
    // Mettre à jour l'état
    last_switch_state = current_switch_state;
}

esp_err_t power_button_init(void) {
    ESP_LOGI(TAG, "=== DEBUT INIT POWER SWITCH ===");
    ESP_LOGI(TAG, "Initialisation du switch power sur GPIO %d", POWER_SWITCH_GPIO);
    
    /* Configuration du GPIO */
    gpio_config_t io_conf = {0};
    io_conf.intr_type = GPIO_INTR_ANYEDGE;
    io_conf.mode = GPIO_MODE_INPUT;
    io_conf.pin_bit_mask = (1ULL << POWER_SWITCH_GPIO);
    io_conf.pull_down_en = 0;
    io_conf.pull_up_en = 1;
    
    esp_err_t ret = gpio_config(&io_conf);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Erreur configuration GPIO: %s", esp_err_to_name(ret));
        return ret;
    }    /* Lire l'état initial du switch */
    last_switch_state = gpio_get_level(POWER_SWITCH_GPIO);
    ESP_LOGI(TAG, "État initial du switch: %s", last_switch_state ? "ON" : "OFF");
    
    /* Ajuster l'état interne selon l'état initial du switch */
    if (!last_switch_state) {
        // Switch OFF au démarrage - état veille
        current_state = POWER_STATE_OFF;
        ESP_LOGI(TAG, "Switch OFF au démarrage - état veille configuré");
    } else {
        current_state = POWER_STATE_ON;
        ESP_LOGI(TAG, "Switch ON au démarrage - état actif configuré");
    }
    
    /* Installation de l'ISR */
    ret = gpio_install_isr_service(0);
    if (ret != ESP_OK && ret != ESP_ERR_INVALID_STATE) {
        ESP_LOGE(TAG, "Erreur installation ISR service: %s", esp_err_to_name(ret));
        return ret;
    }
    
    ret = gpio_isr_handler_add(POWER_SWITCH_GPIO, power_switch_isr, NULL);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Erreur ajout ISR handler: %s", esp_err_to_name(ret));
        return ret;
    }
      /* Configuration de la source de réveil pour le deep sleep */
    esp_sleep_enable_ext0_wakeup(POWER_SWITCH_GPIO, 1); // Réveil quand switch passe à ON (niveau haut)
    
    ESP_LOGI(TAG, "Switch power initialisé avec succès");
    return ESP_OK;
}

/* Fonction pour vérifier l'état du switch et agir en conséquence */
void power_button_check_state(void) {
    // Vérifier d'abord si un deep sleep a été demandé par l'ISR
    if (deep_sleep_requested) {
        ESP_LOGI(TAG, "Deep sleep demandé par ISR - arrêt immédiat du système");
        deep_sleep_requested = false;
        
        // Effectuer l'arrêt propre si possible
        if (event_callback) {
            event_callback(POWER_EVENT_SWITCH_OFF);
        }
        current_state = POWER_STATE_OFF;
        
        // Entrer en deep sleep immédiatement
        esp_deep_sleep_start();
    }
    
    bool current_switch_state = gpio_get_level(POWER_SWITCH_GPIO);
    
    // Log périodique pour debug
    static int debug_counter = 0;
    if (debug_counter % 10 == 0) {  // Affiche un log toutes les 10 vérifications
        ESP_LOGI(TAG, "Check state: current=%s, last=%s, state=%d", 
                current_switch_state ? "ON" : "OFF", 
                last_switch_state ? "ON" : "OFF", 
                current_state);
    }
    debug_counter++;
    
    if (current_switch_state != last_switch_state) {
        ESP_LOGI(TAG, "CHANGEMENT DÉTECTÉ ! %s -> %s", 
                last_switch_state ? "ON" : "OFF",
                current_switch_state ? "ON" : "OFF");
        
        last_switch_state = current_switch_state;
        
        if (current_switch_state) {
            // Switch ON - réveil/activation
            ESP_LOGI(TAG, "Switch activé - Réveil du système");
            if (current_state == POWER_STATE_OFF) {
                power_button_wake_up();
                if (event_callback) {
                    event_callback(POWER_EVENT_SWITCH_ON);
                }
            }
        } else {
            // Switch OFF - veille
            ESP_LOGI(TAG, "Switch désactivé - Mode veille");
            if (current_state == POWER_STATE_ON) {
                power_button_enter_sleep();
                if (event_callback) {
                    event_callback(POWER_EVENT_SWITCH_OFF);
                }
            }
        }
    }
}

void power_button_set_callback(power_button_callback_t callback) {
    event_callback = callback;
}

power_state_t power_button_get_state(void) {
    return current_state;
}

esp_err_t power_button_set_state(power_state_t state) {
    current_state = state;
    ESP_LOGI(TAG, "État forcé à: %d", state);
    return ESP_OK;
}

esp_err_t power_button_enter_sleep(void) {
    ESP_LOGI(TAG, "Entrée en mode veille...");
    
    current_state = POWER_STATE_OFF;
    
    /* Arrêter la matrice de boutons */
    armdeck_matrix_stop();
    
    /* Déconnecter le BLE si connecté */
    if (is_ble_connected()) {
        ESP_LOGI(TAG, "Déconnexion BLE avant veille");
    }
    
    /* Arrêter la publicité BLE */
    armdeck_ble_stop_advertising();
    
    ESP_LOGI(TAG, "Système préparé pour deep sleep - arrêt imminent");
    
    /* Entrer en deep sleep */
    esp_deep_sleep_start();
    
    /* Cette ligne ne sera jamais atteinte */
    return ESP_OK;
}

esp_err_t power_button_wake_up(void) {
    ESP_LOGI(TAG, "Réveil du mode veille...");
    
    current_state = POWER_STATE_ON;
    
    /* Redémarrer la matrice de boutons */
    armdeck_matrix_start();
    
    /* Redémarrer la publicité BLE */
    armdeck_ble_start_advertising();
    
    ESP_LOGI(TAG, "Système réveillé et opérationnel");
    return ESP_OK;
}

esp_err_t power_button_shutdown(void) {
    ESP_LOGI(TAG, "Arrêt complet du système...");
    
    current_state = POWER_STATE_OFF;
    
    /* Arrêter tous les services */
    armdeck_matrix_stop();
    
    if (is_ble_connected()) {
        ESP_LOGI(TAG, "Déconnexion BLE avant arrêt");
    }
    
    armdeck_ble_stop_advertising();
    
    ESP_LOGI(TAG, "Arrêt du système - Au revoir !");
    
    /* Entrer en deep sleep */
    esp_deep_sleep_start();
    
    return ESP_OK; // Ne sera jamais atteint
}
