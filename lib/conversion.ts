export type Unit = 'g' | 'kg' | 'mL' | 'L' | 'items';

export interface UnitInfo {
  name: string;
  dimension: 'weight' | 'volume' | 'count';
  factorToBase: number; // Conversion factor to primary dimension unit (g, mL, items)
}

export const SUPPORTED_UNITS: Record<Unit, UnitInfo> = {
  g: { name: 'Grams (g)', dimension: 'weight', factorToBase: 1 },
  kg: { name: 'Kilograms (kg)', dimension: 'weight', factorToBase: 1000 },
  mL: { name: 'Milliliters (mL)', dimension: 'volume', factorToBase: 1 },
  L: { name: 'Liters (L)', dimension: 'volume', factorToBase: 1000 },
  items: { name: 'Items (count)', dimension: 'count', factorToBase: 1 },
};

/**
 * Returns the conversion factor to go from 'fromUnit' to 'toUnit'.
 * Qty in toUnit = Qty in fromUnit * conversion_factor
 */
export function getConversionFactor(fromUnit: Unit, toUnit: Unit): number {
  const fromInfo = SUPPORTED_UNITS[fromUnit];
  const toInfo = SUPPORTED_UNITS[toUnit];

  if (!fromInfo || !toInfo) {
    throw new Error(`Unsupported or invalid units: ${fromUnit} or ${toUnit}`);
  }

  if (fromInfo.dimension !== toInfo.dimension) {
    throw new Error(
      `Incompatible units: Cannot convert from ${fromUnit} (${fromInfo.dimension}) to ${toUnit} (${toInfo.dimension})`
    );
  }

  return fromInfo.factorToBase / toInfo.factorToBase;
}

/**
 * Converts a quantity from 'fromUnit' to 'toUnit'
 */
export function convertQuantity(qty: number, fromUnit: Unit, toUnit: Unit): number {
  const factor = getConversionFactor(fromUnit, toUnit);
  return qty * factor;
}

/**
 * Format value to INR currency string
 */
export function formatINR(amount: number | string): string {
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(numericAmount);
}
