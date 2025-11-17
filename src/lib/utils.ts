import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export const urlPattern = /^(https?:\/\/|www\.)/i;

/**
 * Check if a string is probably a URL.
 * Permissive regex to detect http(s):// or www. prefixes.
 */
export function isProbablyUrl(input: string): boolean {
	const trimmed = input.trim();
	// Match http://, https://, or www. at the start

	return urlPattern.test(trimmed);
}

/**
 * Converts a 2-letter ISO country code to a flag emoji.
 * Returns the Globe emoji as fallback if conversion fails.
 */
export function getCountryFlagEmoji(countryCode: string): string {
	if (!countryCode || countryCode.length !== 2) {
		return "🌍"; // Globe emoji as fallback
	}

	const codePoints = countryCode
		.toUpperCase()
		.split("")
		.map((char) => 127_397 + char.charCodeAt(0));

	return String.fromCodePoint(...codePoints);
}
