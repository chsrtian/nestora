/**
 * Currency formatting utilities for Philippine Peso (PHP)
 * Centralized formatter to ensure consistent currency display across the app
 */

/**
 * Format a price value in Philippine Peso (PHP)
 * @param value - The price value in PHP
 * @returns Formatted string like "PHP 12,000"
 */
export function formatPriceInPHP(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Price unavailable";
  }

  const formatted = new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);

  return `PHP ${formatted}`;
}

/**
 * Format a price range in Philippine Peso
 * @param min - Minimum price
 * @param max - Maximum price (or null for open-ended)
 * @returns Formatted string like "PHP 5,000 - PHP 20,000"
 */
export function formatPriceRangeInPHP(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  const minStr = min !== null && min !== undefined ? formatPriceInPHP(min) : "Any";
  const maxStr = max !== null && max !== undefined ? formatPriceInPHP(max) : "no limit";
  return `${minStr} - ${maxStr}`;
}

/**
 * Format a price for display with "/mo" suffix (monthly rent)
 * @param value - The price value in PHP
 * @returns Formatted string like "PHP 12,000/mo"
 */
export function formatMonthlyRentInPHP(value: number | null | undefined): string {
  const formatted = formatPriceInPHP(value);
  if (formatted === "Price unavailable") {
    return formatted;
  }
  return `${formatted}/mo`;
}
