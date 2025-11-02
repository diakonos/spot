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
