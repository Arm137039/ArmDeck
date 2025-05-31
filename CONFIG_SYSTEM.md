# ArmDeck Configuration System

## Vue d'ensemble

Le système de configuration ArmDeck permet de configurer dynamiquement les 12 boutons du StreamDeck via BLE et de persister ces configurations dans la mémoire flash NVS.

## Architecture

### Fichiers créés/modifiés :
- `components/armdeck_service/include/armdeck_config.h` - Structures et déclarations
- `components/armdeck_service/armdeck_config.c` - Implémentation complète
- `main/armdeck_main.c` - Intégration des handlers BLE

### Structures de données :

```c
typedef struct {
    uint8_t id;              // ID bouton (0-14)
    char label[16];          // Label affiché ("Play/Pause")
    char action[32];         // Action ("MEDIA_PLAY_PAUSE")
    char color[8];           // Couleur ("#4CAF50")
} button_config_t;

typedef struct {
    uint8_t version;         // Version config (1)
    button_config_t buttons[15];
    uint32_t checksum;       // CRC32 pour validation
} armdeck_config_t;
```

## Protocole BLE

### Service et Caractéristiques :
- **Service ArmDeck** : `7a0b1000-0000-1000-8000-00805f9b34fb`
- **Command Characteristic** : `7a0b1002-0000-1000-8000-00805f9b34fb`
- **Keymap Characteristic** : `7a0b1001-0000-1000-8000-00805f9b34fb`

### Commandes supportées :

#### 1. READ_CONFIG (0x50)
**Envoi** : 1 byte via command characteristic
```
[0x50]
```

**Réponse** : JSON via command characteristic (notification)
```json
{
  "cmd": "0x50",
  "status": "ok",
  "data": {
    "version": 1,
    "buttons": [
      {"id": 0, "label": "Play/Pause", "action": "MEDIA_PLAY_PAUSE", "color": "#4CAF50"},
      {"id": 1, "label": "Next", "action": "MEDIA_NEXT", "color": "#2196F3"},
      ...
    ],
    "device": {
      "name": "ArmDeck",
      "firmware": "1.2.0",
      "uptime": 12345,
      "heap": 190000
    }
  }
}
```

#### 2. WRITE_CONFIG (0x51)
**Envoi** : JSON via keymap characteristic
```json
{
  "version": 1,
  "buttons": [
    {"id": 0, "label": "Play/Pause", "action": "MEDIA_PLAY_PAUSE", "color": "#4CAF50"},
    {"id": 1, "label": "Next", "action": "MEDIA_NEXT", "color": "#2196F3"},
    ...
  ]
}
```

**Réponse** : JSON via command characteristic (notification)
```json
{"cmd": "0x51", "status": "ok", "message": "Config saved to NVS"}
```

#### 3. RESET_CONFIG (0x52)
**Envoi** : 1 byte via command characteristic
```
[0x52]
```

**Réponse** : JSON via command characteristic (notification)
```json
{"cmd": "0x52", "status": "ok", "message": "Config reset to default"}
```

## Actions Supportées

### Media Controls (Consumer Control) :
- `MEDIA_PLAY_PAUSE` → 0xCD
- `MEDIA_NEXT` → 0xB5
- `MEDIA_PREV` → 0xB6
- `VOLUME_UP` → 0xE9
- `VOLUME_DOWN` → 0xEA
- `VOLUME_MUTE` → 0xE2
- `MEDIA_STOP` → 0xB7

### Function Keys (Keyboard) :
- `KEY_F20` → 0x6F
- `KEY_F21` → 0x70
- `KEY_F22` → 0x71
- `KEY_F23` → 0x72
- `KEY_F24` → 0x73

## Configuration par défaut

Au premier démarrage, la configuration suivante est créée :

| Bouton | Label | Action | Couleur |
|--------|-------|--------|---------|
| 0 | Play/Pause | MEDIA_PLAY_PAUSE | #4CAF50 |
| 1 | Next | MEDIA_NEXT | #2196F3 |
| 2 | Previous | MEDIA_PREV | #2196F3 |
| 3 | Volume + | VOLUME_UP | #FF9800 |
| 4 | Volume - | VOLUME_DOWN | #FF9800 |
| 5 | Mute | VOLUME_MUTE | #F44336 |
| 6 | Stop | MEDIA_STOP | #9C27B0 |
| 7 | F20 | KEY_F20 | #607D8B |
| 8 | F21 | KEY_F21 | #607D8B |
| 9 | F22 | KEY_F22 | #607D8B |
| 10 | F23 | KEY_F23 | #607D8B |
| 11 | F24 | KEY_F24 | #607D8B |

## Stockage NVS

- **Namespace** : `"armdeck_cfg"`
- **Key** : `"buttons"`
- **Validation** : CRC32 checksum
- **Fallback** : Configuration par défaut si corruption détectée

## API Functions

### Principales fonctions :

```c
// Initialisation du système
esp_err_t armdeck_config_init(void);

// Chargement/sauvegarde NVS
esp_err_t armdeck_config_load_from_nvs(armdeck_config_t* config);
esp_err_t armdeck_config_save_to_nvs(const armdeck_config_t* config);

// Gestion des commandes BLE
esp_err_t armdeck_config_handle_ble_command(uint8_t command, ...);

// Accès à la configuration courante
const armdeck_config_t* armdeck_config_get_current(void);

// Conversion action → HID code
esp_err_t armdeck_config_get_hid_code(const char* action, uint8_t* hid_code, bool* is_consumer);
```

## Gestion d'erreurs

### Validation automatique :
- ✅ Vérification CRC32
- ✅ Validation format JSON
- ✅ Contrôle des actions supportées
- ✅ Vérification des limites de taille
- ✅ Fallback vers configuration par défaut

### Messages d'erreur :
- `"JSON parsing failed"` - JSON malformé
- `"NVS write failed"` - Erreur de sauvegarde
- `"Config not initialized"` - Système non initialisé
- `"Response too large"` - Réponse dépasse MTU BLE

## Intégration Web Bluetooth

### Exemple JavaScript :

```javascript
// Connexion au service ArmDeck
const service = await device.gatt.getPrimaryService('7a0b1000-0000-1000-8000-00805f9b34fb');
const commandChar = await service.getCharacteristic('7a0b1002-0000-1000-8000-00805f9b34fb');
const keymapChar = await service.getCharacteristic('7a0b1001-0000-1000-8000-00805f9b34fb');

// Lire la configuration
await commandChar.writeValue(new Uint8Array([0x50]));
const response = await commandChar.readValue(); // Attendre notification

// Écrire une nouvelle configuration
const config = {
  version: 1,
  buttons: [/* ... */]
};
await keymapChar.writeValue(new TextEncoder().encode(JSON.stringify(config)));
```

## Tests et Debug

### Logs à surveiller :
- `ARMDECK_CONFIG: Configuration system initialized successfully`
- `ARMDECK_CONFIG: Button X PRESSED: Label (ACTION)`
- `ARMDECK_CONFIG: Config saved to NVS successfully`

### Commandes de test existantes :
- `0x30` : Test matrix (cycle tous les boutons)
- `0x10` : Keep-alive test
- `0x20` : Status check

## Compilation

Le système est automatiquement inclus dans la compilation via CMakeLists.txt.
Dépendances requises : `cJSON`, `nvs_flash`, `esp_timer`.
