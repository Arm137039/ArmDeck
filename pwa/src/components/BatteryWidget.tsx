import React from 'react';
import useUnifiedBle from '../hooks/useUnifiedBle';
import '../styles/BatteryWidget.scss';

import { ReactComponent as BatteryFull } from '../assets/battery-full.svg';
import { ReactComponent as Battery75 } from '../assets/battery-75.svg';
import { ReactComponent as Battery50 } from '../assets/battery-50.svg';
import { ReactComponent as Battery25 } from '../assets/battery-25.svg';
import { ReactComponent as BatteryEmpty } from '../assets/battery-empty.svg';

/**
 * Determines which battery icon to display based on the battery level
 * @param level Battery level (0-100)
 * @returns The appropriate battery icon component
 */
export const getBatteryIcon = (level: number | null): React.ReactElement => {
    if (level === null) return <BatteryEmpty />;

    if (level >= 87.5) return <BatteryFull />;
    if (level >= 62.5) return <Battery75 />;
    if (level >= 37.5) return <Battery50 />;
    if (level >= 12.5) return <Battery25 />;
    return <BatteryEmpty />;
};

/**
 * Determines if the battery level is low (below 15%)
 * @param level Battery level (0-100)
 * @returns True if the battery level is low, false otherwise
 */
export const isBatteryLow = (level: number | null): boolean => {
    return level !== null && level < 15;
};

interface BatteryWidgetProps {
    level?: number | null;
    alwaysShow?: boolean;
}

/**
 * Battery widget component that displays the current battery level
 * with an appropriate icon and text
 */
const BatteryWidget: React.FC<BatteryWidgetProps> = ({ level: propLevel, alwaysShow = true }) => {
    const { batteryLevel: hookLevel, isConnected } = useUnifiedBle();
    const batteryLevel = propLevel !== undefined ? propLevel : hookLevel;

    if (!isConnected && !alwaysShow) {
        return null;
    }

    const batteryLowClass = isBatteryLow(batteryLevel) ? 'battery-low' : '';

    const connectionClass = isConnected ? 'connected' : 'disconnected';

    return (
        <div className={`battery-widget ${batteryLowClass} ${connectionClass}`}>
            <div className="battery-icon">
                {getBatteryIcon(batteryLevel)}
            </div>
            <div className="battery-text">
                {batteryLevel !== null ? `${batteryLevel}%` : 'N/A'}
            </div>
        </div>
    );
};

export default BatteryWidget;