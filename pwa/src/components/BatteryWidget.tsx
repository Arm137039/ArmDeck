import React, { useEffect, useState } from 'react';
import useUnifiedBle from '../hooks/useBle.ts';
import '../styles/BatteryWidget.scss';

import { ReactComponent as BatteryFull } from '../assets/battery-full.svg';
import { ReactComponent as Battery75 } from '../assets/battery-75.svg';
import { ReactComponent as Battery50 } from '../assets/battery-50.svg';
import { ReactComponent as Battery25 } from '../assets/battery-25.svg';
import { ReactComponent as BatteryEmpty } from '../assets/battery-empty.svg';

export const getBatteryIcon = (level: number | null): React.ReactElement => {
    if (level === null) return <BatteryEmpty />;

    if (level >= 87.5) return <BatteryFull />;
    if (level >= 62.5) return <Battery75 />;
    if (level >= 37.5) return <Battery50 />;
    if (level >= 12.5) return <Battery25 />;
    return <BatteryEmpty />;
};

export const isBatteryLow = (level: number | null): boolean => {
    return level !== null && level < 15;
};

interface BatteryWidgetProps {
    level?: number | null;
    alwaysShow?: boolean;
}

const BatteryWidget: React.FC<BatteryWidgetProps> = ({ level: propLevel, alwaysShow = true }) => {
    const { batteryLevel: hookLevel, isConnected, readBatteryLevel } = useUnifiedBle();
    const [lastKnownLevel, setLastKnownLevel] = useState<number | null>(null);

    // Logique pour conserver le dernier niveau connu
    useEffect(() => {
        if (hookLevel !== null) {
            setLastKnownLevel(hookLevel);
        }
    }, [hookLevel]);

    // Rafraîchir périodiquement la batterie quand connecté
    useEffect(() => {
        let intervalId: number | null = null;

        if (isConnected) {
            // Lire la batterie immédiatement
            readBatteryLevel().catch(err => console.error('Failed to read battery level:', err));

            // Puis configurer un intervalle de rafraîchissement
            intervalId = window.setInterval(() => {
                readBatteryLevel().catch(err => console.error('Failed to read battery level:', err));
            }, 60000); // Lecture toutes les minutes
        }

        return () => {
            if (intervalId !== null) {
                clearInterval(intervalId);
            }
        };
    }, [isConnected, readBatteryLevel]);

    // Déterminer le niveau à afficher
    // Priorité : 1. Niveau fourni en prop, 2. Niveau du hook, 3. Dernier niveau connu, 4. Null
    const displayLevel = propLevel !== undefined
        ? propLevel
        : (hookLevel !== null
            ? hookLevel
            : lastKnownLevel);

    if (!isConnected && !alwaysShow) {
        return null;
    }

    const batteryLowClass = isBatteryLow(displayLevel) ? 'battery-low' : '';
    const connectionClass = isConnected ? 'connected' : 'disconnected';

    return (
        <div className={`battery-widget ${batteryLowClass} ${connectionClass}`}>
            <div className="battery-icon">
                {getBatteryIcon(displayLevel)}
            </div>
            <div className="battery-text">
                {displayLevel !== null ? `${displayLevel}%` : 'N/A'}
            </div>
        </div>
    );
};

export default BatteryWidget;