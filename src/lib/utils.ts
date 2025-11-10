import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number into a currency string.
 * @param amount The number to format.
 * @param currency The currency code (e.g., "USD").
 * @returns A formatted currency string.
 */
export function formatCurrency(amount: number, currency: string = "USD") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  }).format(amount);
}

/**
 * Formats a large number into a compact, readable string (e.g., 1.5K, 2M).
 * @param num The number to format.
 * @returns A compact string representation of the number.
 */
export function formatCompactNumber(num: number) {
  if (Math.abs(num) >= 1e6) {
    return (num / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (Math.abs(num) >= 1e3) {
    return (num / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}
