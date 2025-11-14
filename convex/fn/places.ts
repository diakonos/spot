import type { Id } from "../_generated/dataModel";

/**
 * Helper function to convert Convex place document to PlaceDetailsResponse format
 */
export function convertPlaceToPlaceDetailsResponse(place: {
	_id: Id<"places">;
	providerPlaceId: string;
	name: string;
	formattedAddress?: string;
	location?: { lat: number; lng: number };
	rating?: number;
	photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
	websiteUri?: string;
	internationalPhoneNumber?: string;
	googleMapsUri?: string;
	raw?: Record<string, unknown>;
}): {
	id: string;
	name: string;
	formatted_address?: string;
	location?: { lat: number; lng: number };
	rating?: number;
	user_ratings_total?: number;
	photos?: Array<{ name: string; widthPx: number; heightPx: number }>;
	website?: string;
	phone?: string;
	google_maps_uri?: string;
} {
	return {
		id: place.providerPlaceId,
		name: place.name,
		formatted_address: place.formattedAddress,
		location: place.location,
		rating: place.rating,
		user_ratings_total:
			typeof place.raw?.userRatingCount === "number"
				? place.raw.userRatingCount
				: undefined,
		photos: place.photos,
		website: place.websiteUri,
		phone: place.internationalPhoneNumber,
		google_maps_uri: place.googleMapsUri,
	};
}
