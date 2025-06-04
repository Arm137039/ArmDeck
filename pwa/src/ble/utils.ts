import { BLE_CONFIG, KEY_MAP, MEDIA_MAP, ACTION_TYPES, KEY_REVERSE_MAP, MEDIA_REVERSE_MAP } from './constants';
import { ButtonConfig, ParsedResponse } from './types';

export const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const calculateChecksum = (data: Uint8Array): number => {
    return data.reduce((checksum, byte) => checksum ^ byte, 0);
};

export const createEmptyButton = (id: number): ButtonConfig => ({
    id,
    label: `Button ${id + 1}`,
    action: '',
    color: '#607D8B',
    isDirty: false
});

export const buildCommand = (command: number, payload?: Uint8Array): Uint8Array => {
    const payloadLen = payload?.length || 0;
    const packet = new Uint8Array(4 + payloadLen + 1);

    let pos = 0;
    packet[pos++] = BLE_CONFIG.PROTOCOL.MAGIC_BYTE1;
    packet[pos++] = BLE_CONFIG.PROTOCOL.MAGIC_BYTE2;
    packet[pos++] = command;
    packet[pos++] = payloadLen;

    if (payload && payloadLen > 0) {
        packet.set(payload, pos);
        pos += payloadLen;
    }

    packet[pos] = calculateChecksum(packet.slice(0, pos));
    return packet;
};

export const parseResponse = (data: Uint8Array): ParsedResponse | null => {
    if (data.length < 5) {
        console.error('[BLE] Response too short:', data.length);
        return null;
    }

    let startIndex = -1;
    for (let i = 0; i <= data.length - 4; i++) {
        if (data[i] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE1 && data[i + 1] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE2) {
            startIndex = i;
            break;
        }
    }

    if (startIndex === -1) {
        console.error('[BLE] No magic bytes found');
        return null;
    }

    const adjustedData = data.slice(startIndex);
    if (adjustedData.length < 5) {
        console.error('[BLE] Adjusted data too short');
        return null;
    }

    const command = adjustedData[2];
    const length = adjustedData[3];
    const expectedLen = 4 + length + 1;

    if (adjustedData.length < expectedLen) {
        console.error('[BLE] Not enough data after magic bytes');
        return null;
    }

    const responseData = adjustedData.slice(0, expectedLen);
    const receivedChecksum = responseData[responseData.length - 1];
    const calculatedChecksum = calculateChecksum(responseData.slice(0, responseData.length - 1));

    if (receivedChecksum !== calculatedChecksum) {
        console.error('[BLE] Checksum validation failed');
        return null;
    }

    const error = responseData[4];
    const payload = length > 1 ? responseData.slice(5, 4 + length) : undefined;

    return { command, error, payload };
};

export const getKeyName = (keyCode: number): string => KEY_MAP[keyCode] || `0x${keyCode.toString(16).toUpperCase()}`;
export const getMediaActionName = (keyCode: number): string => MEDIA_MAP[keyCode] || `MEDIA_0x${keyCode.toString(16).toUpperCase()}`;

export const parseButtonData = (buttonData: Uint8Array, buttonId: number): ButtonConfig => {
    console.log(`[BLE] Données brutes du bouton ${buttonId}:`, Array.from(buttonData).map(b => b.toString(16).padStart(2, '0')).join(' '));

    if (buttonData.length < 16) {
        console.warn(`[BLE] Button ${buttonId} data too short`);
        return createEmptyButton(buttonId);
    }

    const actionType = buttonData[1];
    const keyCode = buttonData[2];
    const r = buttonData[4];
    const g = buttonData[5];
    const b = buttonData[6];

    const labelBytes = buttonData.slice(8, 16);
    let label = '';
    for (let j = 0; j < labelBytes.length; j++) {
        if (labelBytes[j] === 0) break;
        label += String.fromCharCode(labelBytes[j]);
    }

    let action = '';
    switch (actionType) {
        case ACTION_TYPES.KEY:
            action = `KEY_${getKeyName(keyCode)}`;
            console.log(`[BLE] Button ${buttonId} est une touche: ${action}, keyCode: ${keyCode}`);
            break;
        case ACTION_TYPES.MEDIA:
            action = getMediaActionName(keyCode);
            console.log(`[BLE] Button ${buttonId} est une action média: ${action}, keyCode: ${keyCode}`);
            break;
        case ACTION_TYPES.MACRO:
            action = 'MACRO';
            console.log(`[BLE] Button ${buttonId} est une macro`);
            break;
        case ACTION_TYPES.CUSTOM:
            action = 'CUSTOM';
            console.log(`[BLE] Button ${buttonId} est une action personnalisée`);
            break;
        default:
            action = 'UNKNOWN';
            console.log(`[BLE] Button ${buttonId} a un type d'action inconnu: ${actionType}`);
    }

    const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    const buttonConfig = {
        id: buttonId,
        label: label || `Button ${buttonId + 1}`,
        action,
        color,
        isDirty: false
    };
    return buttonConfig;
};

export const buildButtonPayload = (button: ButtonConfig, buttonIndex: number): Uint8Array => {
    const colorHex = button.color.replace('#', '');
    const r = parseInt(colorHex.substr(0, 2), 16);
    const g = parseInt(colorHex.substr(2, 2), 16);
    const b = parseInt(colorHex.substr(4, 2), 16);

    let actionType: number = ACTION_TYPES.NONE;
    let keyCode = 0x00;
    const modifier = 0;

    const mediaTerms = ['MEDIA_', 'VOLUME_', 'BRIGHTNESS_', 'MUTE'];
    const isMediaAction = !!(button.action && (
        mediaTerms.some(term => button.action.includes(term)) ||
        button.action === 'MUTE'
    ));

    if (!button.action || button.action === '') {
    } else if (isMediaAction) {
        actionType = ACTION_TYPES.MEDIA;

        // Extraire le nom de l'action réel si nécessaire
        let actionName = button.action;
        if (button.action === 'MUTE') {
            actionName = 'VOLUME_MUTE';
        }

        // Utiliser directement la map pour tous les boutons média
        keyCode = MEDIA_REVERSE_MAP[actionName];

        // Vérifier si le code existe, sinon utiliser une valeur par défaut
        if (keyCode === undefined) {
            console.warn(`[BLE] Code non trouvé pour l'action média: ${button.action}, utilisation de la valeur par défaut (MEDIA_PLAY_PAUSE)`);
            keyCode = 0xCD; // MEDIA_PLAY_PAUSE comme fallback
        }

        console.log(`[BLE] Action média configurée: ${button.action}, index=${buttonIndex}, type=${actionType}, code=0x${keyCode.toString(16).toUpperCase()}`);
    } else if (button.action.startsWith('KEY_')) {
        actionType = ACTION_TYPES.KEY;
        const keyName = button.action.replace('KEY_', '');
        keyCode = KEY_REVERSE_MAP[keyName] || 0x04;
    } else if (button.action === 'MACRO') {
        actionType = ACTION_TYPES.MACRO;
    } else if (button.action === 'CUSTOM') {
        actionType = ACTION_TYPES.CUSTOM;
    }

    const payload = new Uint8Array(16);
    payload[0] = buttonIndex;
    payload[1] = actionType;
    payload[2] = keyCode;
    payload[3] = modifier;
    payload[4] = r;
    payload[5] = g;
    payload[6] = b;
    payload[7] = 0;

    const labelBytes = new TextEncoder().encode(button.label.slice(0, 7));
    payload.set(labelBytes, 8);

    return payload;
};

