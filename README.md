# ArmDeck - Stream Deck Configurable via BLE

> **Un Stream Deck personnalisable de 15 boutons (5x3) basé sur ESP32 avec configuration via interface web BLE**

## Vue d'ensemble

ArmDeck est un Stream Deck configurable avec 15 boutons disposés en matrice 5×3. Il fonctionne comme un périphérique HID Bluetooth Low Energy (BLE) et peut être configuré en temps réel via une interface web connectée par BLE.

### Fonctionnalités principales

- **15 boutons configurables** en matrice 5×3
- **Connexion BLE HID** pour émulation clavier/media
- **Configuration via interface web** BLE en temps réel
- **Persistance des configurations** en mémoire flash NVS
- **Bouton power** avec gestion de veille
- **Actions supportées** : touches fonction, contrôles media, macros, ect
- **Protocol de communication** propriétaire pour la configuration

### Architecture de communication

```
Interface Web ←→ BLE ←→ ESP32 ←→ Ordinateur (HID)
      ↑              ↑        ↑
Configuration     Trame     Boutton
                   
```

## Matériel

### Composants principaux
- **ESP32-WROOM-32D**
- **15 blue switch**
- **1 switch power**
- **15 Diodes** pour les boutons
- **Alimentation** USB

### Schéma de câblage

#### Matrice de boutons 5×3
```
Lignes (Rows) - Sorties :
- ROW1 (GPIO 5)  : Boutons 1,2,3,4,5
- ROW2 (GPIO 4)  : Boutons 6,7,8,9,10  
- ROW3 (GPIO 2)  : Boutons 11,12,13,14,15

Colonnes (Columns) - Entrées avec diode :
- COL1 (GPIO 18) : Boutons 1,6,11
- COL2 (GPIO 19) : Boutons 2,7,12
- COL3 (GPIO 21) : Boutons 3,8,13
- COL4 (GPIO 22) : Boutons 4,9,14
- COL5 (GPIO 23) : Boutons 5,10,15
```

#### Bouton Power
```
GPIO 12 ←→ Switch ←→ GND
(Pull-up interne activé)
```

## Installation et configuration

### Prérequis
2. **VS Code**
1. **ESP-IDF v5.4.1**

## Configuration via interface web

### Connexion BLE
1. **Détecter le device** : "ArmDeck" dans la liste BLE
2. **Se connecter** via l'interface web

### Services BLE

Le device expose un service personnalisé pour la configuration :

**Service ArmDeck** : `7a0b1000-0000-1000-8000-00805f9b34fb`

**Caractéristiques :**
- **Command** : `7a0b1002-0000-1000-8000-00805f9b34fb` (Write/Notify)
- **Keymap** : `7a0b1001-0000-1000-8000-00805f9b34fb` (Write)

## Protocole de communication : **ArmDeck Protocol**

Le protocole propriétaire se nomme **"ArmDeck Protocol"** et gère la communication entre l'interface web et l'ESP32 via BLE.

### Caractéristiques du protocole

**Nom :** `ArmDeck Protocol v1.0`  
**Version :** `0x01` (définie par `ARMDECK_PROTOCOL_VERSION`)  
**Transport :** BLE via service personnalisé  
**Magic bytes :** `0xAD 0xDC` (ArmDeck)  

### Architecture de communication

```
Interface Web ←→ BLE ←→ ESP32 ←→ Ordinateur (HID)
      ↑              ↑        ↑
Configuration   ArmDeck    Actions
    JSON        Protocol   HID/Clavier
```

### Structure des paquets

```
[HEADER][PAYLOAD][CHECKSUM]

HEADER (4 bytes):
- Magic (2 bytes): 0xAD 0xDC
- Command (1 byte): Code commande  
- Length (1 byte): Taille payload
```

### Commandes supportées

#### 📖 GET_INFO (0x10)
Obtenir les informations du device

**Envoi :** `[0xAD][0xDC][0x10][0x00][checksum]`

**Réponse :**
```c
typedef struct {
    uint8_t protocol_version;  // Version du protocole
    uint8_t firmware_major;    // Version firmware
    uint8_t firmware_minor;
    uint8_t firmware_patch;
    uint8_t num_buttons;       // Nombre de boutons (15)
    uint8_t battery_level;     // Niveau batterie
    uint32_t uptime_seconds;   // Temps de fonctionnement
    uint32_t free_heap;        // Mémoire libre
    char device_name[16];      // Nom du device
} armdeck_device_info_t;
```

#### ⚙️ GET_CONFIG (0x20)
Obtenir la configuration complète

**Envoi :** `[0xAD][0xDC][0x20][0x00][checksum]`

**Réponse :** Configuration complète des 15 boutons

#### 🔧 SET_CONFIG (0x21)
Définir la configuration complète

**Envoi :** `[HEADER][armdeck_config_t][checksum]`

#### 🎯 GET_BUTTON (0x30)
Obtenir la configuration d'un bouton spécifique

**Envoi :** `[0xAD][0xDC][0x30][0x01][button_id][checksum]`

#### ✏️ SET_BUTTON (0x31)
Configurer un bouton spécifique

**Envoi :** `[HEADER][armdeck_button_t][checksum]`

#### 🧪 TEST_BUTTON (0x40)
Tester un bouton (simulation de pression)

**Envoi :** `[0xAD][0xDC][0x40][0x01][button_id][checksum]`

#### 🔄 RESET_CONFIG (0x22)
Réinitialiser à la configuration par défaut

**Envoi :** `[0xAD][0xDC][0x22][0x00][checksum]`

#### 🔃 RESTART (0x50)
Redémarrer le device

**Envoi :** `[0xAD][0xDC][0x50][0x00][checksum]`

### Structure d'un bouton

```c
typedef struct {
    uint8_t button_id;        // ID du bouton (0-14)
    uint8_t action_type;      // Type d'action
    uint8_t key_code;         // Code de la touche HID
    uint8_t modifier;         // Modificateurs (Ctrl, Alt, etc.)
    uint8_t color_r;          // Composante rouge (0-255)
    uint8_t color_g;          // Composante verte (0-255)
    uint8_t color_b;          // Composante bleue (0-255)
    uint8_t reserved;         // Réservé
    char label[8];            // Label (7 chars + null)
} armdeck_button_t;
```

### Types d'actions supportées

#### 🎮 Actions Media (Consumer Control)
```c
ACTION_MEDIA = 0x02
```

Codes disponibles :
- `0xCD` : Play/Pause
- `0xB5` : Next Track
- `0xB6` : Previous Track  
- `0xB7` : Stop
- `0xE9` : Volume Up
- `0xEA` : Volume Down
- `0xE2` : Mute

#### ⌨️ Actions Clavier (Keyboard)
```c
ACTION_KEY = 0x01
```

Codes HID standard (exemples) :
- `0x6F` : F20
- `0x70` : F21
- `0x71` : F22
- `0x72` : F23
- `0x73` : F24
- `0x74` : F13
- `0x75` : F14
- `0x76` : F15

#### 🔧 Modificateurs
Combinaisons possibles (OR bit à bit) :
- `0x01` : Ctrl Gauche
- `0x02` : Shift Gauche  
- `0x04` : Alt Gauche
- `0x08` : GUI Gauche (Touche Windows)
- `0x10` : Ctrl Droit
- `0x20` : Shift Droit
- `0x40` : Alt Droit
- `0x80` : GUI Droit

## 🎨 Configuration par défaut

Au premier démarrage, cette configuration est créée :

| Bouton | Label      | Action           | Code  | Couleur   |
|--------|------------|------------------|-------|-----------|
| 1      | Play       | MEDIA_PLAY_PAUSE | 0xCD  | #4CAF50 |
| 2      | Next       | MEDIA_NEXT       | 0xB5  | #2196F3 |
| 3      | Prev       | MEDIA_PREV       | 0xB6  | #2196F3 |
| 4      | Vol+       | VOLUME_UP        | 0xE9  | #FF9800 |
| 5      | Vol-       | VOLUME_DOWN      | 0xEA  | #FF9800 |
| 6      | Mute       | VOLUME_MUTE      | 0xE2  | #F44336 |
| 7      | Stop       | MEDIA_STOP       | 0xB7  | #9C27B0 |
| 8      | F20        | KEY_F20          | 0x6F  | #607D8B |
| 9      | F21        | KEY_F21          | 0x70  | #607D8B |
| 10     | F22        | KEY_F22          | 0x71  | #607D8B |
| 11     | F23        | KEY_F23          | 0x72  | #607D8B |
| 12     | F24        | KEY_F24          | 0x73  | #607D8B |
| 13     | F13        | KEY_F13          | 0x74  | #3F51B5 |
| 14     | F14        | KEY_F14          | 0x75  | #3F51B5 |
| 15     | F15        | KEY_F15          | 0x76  | #3F51B5 |

## Gestion de l'alimentation

### Bouton Power (GPIO 12) avec Interruption

Le bouton power utilise un **système d'interruption matérielle** pour une réactivité maximale :

**Configuration ISR :**
```c
// Configuration GPIO avec interruption sur front montant/descendant
io_conf.intr_type = GPIO_INTR_ANYEDGE;

// Installation du gestionnaire d'interruption
gpio_isr_handler_add(POWER_SWITCH_GPIO, power_switch_isr, NULL);

// Configuration réveil deep sleep
esp_sleep_enable_ext0_wakeup(POWER_SWITCH_GPIO, 1);
```

**Fonctionnement de l'ISR :**
- **Détection instantanée** des changements d'état du switch
- **Switch OFF détecté** → Demande de deep sleep immédiate
- **Switch ON détecté** → Signal de réveil depuis l'ISR
- **Anti-rebond matériel** via la logique de l'ESP32

**États du système :**
- **ON** : Système actif, scanning des boutons, BLE actif
- **OFF** : Deep sleep immédiat, réveil uniquement par switch power

**Événements gérés par interruption :**
- **Switch ON→OFF** : Passage en deep sleep **immédiat** (depuis l'ISR)
- **Switch OFF→ON** : Réveil automatique depuis deep sleep
- **Deep Sleep** : Réveil uniquement par switch power (GPIO 12)

## Protocole de communication : **ArmDeck Protocol**

Le protocole propriétaire se nomme **"ArmDeck Protocol"** et gère la communication entre l'interface web et l'ESP32 via BLE.

### Caractéristiques du protocole

**Nom :** `ArmDeck Protocol v1.0`
**Version :** `0x01` (définie par `ARMDECK_PROTOCOL_VERSION`)
**Transport :** BLE via service personnalisé
**Magic bytes :** `0xAD 0xDC` (ArmDeck)

### Gestion de la connexion BLE

**Optimisations automatiques :**
- **Publicité arrêtée** quand un client est connecté
- **Publicité redémarrée** automatiquement à la déconnexion
- **Keep-alive** toutes les 15 secondes pour maintenir la connexion HID
- **Timeout de connexion** configurable

### Tags principaux
- `ARMDECK_MAIN` : Application principale
- `ARMDECK_BLE` : Gestion BLE
- `ARMDECK_HID` : Profile HID
- `ARMDECK_PROTOCOL` : Protocole de communication
- `ARMDECK_MATRIX` : Matrice de boutons
- `POWER_SWITCH` : Bouton power


## Documentation technique

### Références
- [ESP-IDF Programming Guide](https://docs.espressif.com/projects/esp-idf/)
- [Bluetooth HID Specification](https://www.bluetooth.com/specifications/specs/human-interface-device-profile-1-1-1/)
- [USB HID Usage Tables](https://usb.org/sites/default/files/documents/hut1_12v2.pdf)

### Architecture interne

```
Application Layer:     [Interface Web] ←→ [Configuration]
Protocol Layer:        [ArmDeck Protocol] ←→ [BLE Service]  
HID Layer:            [HID Profile] ←→ [OS HID Driver]
Hardware Layer:       [Button Matrix + Power ISR] + [ESP32 BLE Stack]
```
