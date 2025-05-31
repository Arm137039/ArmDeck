#ifndef ARMDECK_COMMON_H
#define ARMDECK_COMMON_H

#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

// Variables partagées entre les modules
extern bool ble_connected;
extern uint16_t hid_conn_id;
extern esp_timer_handle_t keep_alive_timer;

// Fonctions partagées pour le keep-alive
void start_keep_alive(void);
void stop_keep_alive(void);
void send_hid_keep_alive(void);

// Fonction pour mettre à jour l'état de connexion global
void armdeck_main_set_connected(bool connected, uint16_t conn_id);

// Fonction pour mettre à jour le niveau de batterie
void armdeck_update_battery_level(uint8_t level);

#endif // ARMDECK_COMMON_H