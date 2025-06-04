export const BLE_CONFIG = {
    SERVICES: {
        ARMDECK: '7a0b1000-0000-1000-8000-00805f9b34fb',
        DEVICE_INFO: '0000180a-0000-1000-8000-00805f9b34fb',
    },
    CHARACTERISTICS: {
        KEYMAP: 'fb349b5f-8000-0080-0010-000001100b7a',
        COMMAND: 'fb349b5f-8000-0080-0010-000002100b7a',
    },
    PROTOCOL: {
        MAGIC_BYTE1: 0xAD,
        MAGIC_BYTE2: 0xDC,
        VERSION: 1,
    },
    TIMING: {
        ESP32_PROCESSING_DELAY: 100,
        RETRY_DELAY: 100,
        BUTTON_SAVE_DELAY: 100,
        AUTO_SAVE_TIMEOUT: 1500,
        CONNECTION_WAIT: 2000,
        SETUP_DELAY: 1000,
    }
} as const;

export const COMMANDS = {
    GET_INFO: 0x10,
    GET_CONFIG: 0x20,
    SET_CONFIG: 0x21,
    RESET_CONFIG: 0x22,
    GET_BUTTON: 0x30,
    SET_BUTTON: 0x31,
    TEST_BUTTON: 0x40,
    RESTART: 0x50,
    ACK: 0xA0,
    NACK: 0xA1,
} as const;

export const ERRORS = {
    NONE: 0x00,
    INVALID_CMD: 0x01,
    INVALID_PARAM: 0x02,
    CHECKSUM: 0x03,
} as const;

export const ACTION_TYPES = {
    NONE: 0x00,
    KEY: 0x01,
    MEDIA: 0x02,
    MACRO: 0x03,
    CUSTOM: 0x04
} as const;

export const KEY_MAP: Record<number, string> = {
    0x04: 'A', 0x05: 'B', 0x06: 'C', 0x07: 'D', 0x08: 'E', 0x09: 'F',
    0x0A: 'G', 0x0B: 'H', 0x0C: 'I', 0x0D: 'J', 0x0E: 'K', 0x0F: 'L',
    0x10: 'M', 0x11: 'N', 0x12: 'O', 0x13: 'P', 0x14: 'Q', 0x15: 'R',
    0x16: 'S', 0x17: 'T', 0x18: 'U', 0x19: 'V', 0x1A: 'W', 0x1B: 'X',
    0x1C: 'Y', 0x1D: 'Z', 0x1E: '1', 0x1F: '2', 0x20: '3', 0x21: '4',
    0x22: '5', 0x23: '6', 0x24: '7', 0x25: '8', 0x26: '9', 0x27: '0',
    0x28: 'ENTER', 0x29: 'ESCAPE', 0x2A: 'BACKSPACE', 0x2B: 'TAB',
    0x2C: 'SPACE', 0x39: 'CAPS_LOCK',
    0x3A: 'F1', 0x3B: 'F2', 0x3C: 'F3', 0x3D: 'F4', 0x3E: 'F5', 0x3F: 'F6',
    0x40: 'F7', 0x41: 'F8', 0x42: 'F9', 0x43: 'F10', 0x44: 'F11', 0x45: 'F12',
    0x74: 'F13', 0x75: 'F14', 0x76: 'F15', 0x77: 'F16',
    0x78: 'F17', 0x79: 'F18', 0x7A: 'F19', 0x6F: 'F20',
    0x70: 'F21', 0x71: 'F22', 0x72: 'F23', 0x73: 'F24',
    0x4F: 'RIGHT', 0x50: 'LEFT', 0x51: 'DOWN', 0x52: 'UP',
};

export const MEDIA_MAP: Record<number, string> = {
    0xCD: 'MEDIA_PLAY_PAUSE',
    0xB5: 'MEDIA_NEXT',
    0xB6: 'MEDIA_PREV',
    0xB7: 'MEDIA_STOP',
    0xE9: 'VOLUME_UP',
    0xEA: 'VOLUME_DOWN',
    0xE2: 'VOLUME_MUTE',
    0x6F: 'BRIGHTNESS_UP',
    0x70: 'BRIGHTNESS_DOWN',
};

export const KEY_REVERSE_MAP = Object.fromEntries(
    Object.entries(KEY_MAP).map(([code, name]) => [name, parseInt(code)])
);

export const MEDIA_REVERSE_MAP = Object.fromEntries(
    Object.entries(MEDIA_MAP).map(([code, name]) => [name, parseInt(code)])
);

