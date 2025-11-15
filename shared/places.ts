export type PlaceProvider = "google" | "manual";

export const MANUAL_PLACE_PREFIX = "manual_";

export function isManualPlaceId(providerPlaceId: string): boolean {
	return providerPlaceId.startsWith(MANUAL_PLACE_PREFIX);
}

export function inferProviderFromPlaceId(
	providerPlaceId: string
): PlaceProvider {
	return isManualPlaceId(providerPlaceId) ? "manual" : "google";
}
