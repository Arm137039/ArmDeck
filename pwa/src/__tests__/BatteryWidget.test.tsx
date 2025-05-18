import { describe, it, expect } from 'vitest';
import { getBatteryIcon, isBatteryLow } from '../components/BatteryWidget';
import { ReactComponent as BatteryFull } from '../assets/battery-full.svg';
import { ReactComponent as Battery75 } from '../assets/battery-75.svg';
import { ReactComponent as Battery50 } from '../assets/battery-50.svg';
import { ReactComponent as Battery25 } from '../assets/battery-25.svg';
import { ReactComponent as BatteryEmpty } from '../assets/battery-empty.svg';

describe('BatteryWidget', () => {
  describe('getBatteryIcon', () => {
    it('should return BatteryEmpty when level is null', () => {
      const result = getBatteryIcon(null);
      expect(result.type).toBe(BatteryEmpty);
    });

    it('should return BatteryFull when level is 100', () => {
      const result = getBatteryIcon(100);
      expect(result.type).toBe(BatteryFull);
    });

    it('should return BatteryFull when level is 88', () => {
      const result = getBatteryIcon(88);
      expect(result.type).toBe(BatteryFull);
    });

    it('should return Battery75 when level is 75', () => {
      const result = getBatteryIcon(75);
      expect(result.type).toBe(Battery75);
    });

    it('should return Battery75 when level is 63', () => {
      const result = getBatteryIcon(63);
      expect(result.type).toBe(Battery75);
    });

    it('should return Battery50 when level is 50', () => {
      const result = getBatteryIcon(50);
      expect(result.type).toBe(Battery50);
    });

    it('should return Battery50 when level is 38', () => {
      const result = getBatteryIcon(38);
      expect(result.type).toBe(Battery50);
    });

    it('should return Battery25 when level is 25', () => {
      const result = getBatteryIcon(25);
      expect(result.type).toBe(Battery25);
    });

    it('should return Battery25 when level is 13', () => {
      const result = getBatteryIcon(13);
      expect(result.type).toBe(Battery25);
    });

    it('should return BatteryEmpty when level is 12', () => {
      const result = getBatteryIcon(12);
      expect(result.type).toBe(BatteryEmpty);
    });

    it('should return BatteryEmpty when level is 0', () => {
      const result = getBatteryIcon(0);
      expect(result.type).toBe(BatteryEmpty);
    });
  });

  describe('isBatteryLow', () => {
    it('should return false when level is null', () => {
      expect(isBatteryLow(null)).toBe(false);
    });

    it('should return false when level is 15', () => {
      expect(isBatteryLow(15)).toBe(false);
    });

    it('should return false when level is 100', () => {
      expect(isBatteryLow(100)).toBe(false);
    });

    it('should return true when level is 14', () => {
      expect(isBatteryLow(14)).toBe(true);
    });

    it('should return true when level is 0', () => {
      expect(isBatteryLow(0)).toBe(true);
    });
  });
});