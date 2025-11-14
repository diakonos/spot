/// <reference types="@types/google.maps" />

/**
 * Client-side Google Places API helpers using the JavaScript SDK
 * These functions use the Google Maps JavaScript API Places library.
 * The API key should be secured using Google Cloud Console restrictions.
 */

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import type {
	AutocompletePlacesResponse,
	PlaceDetailsResponse,
	SearchPlacesByTextResponse,
} from "./types";

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
const DEFAULT_LOCATION_BIAS_RADIUS_METERS = 50_000;
type LocationBiasOptions = {
	lat: number;
	lng: number;
	radiusMeters?: number;
};

type PlacesClientRequestOptions = {
	locationBias?: LocationBiasOptions;
};
if (!GOOGLE_PLACES_API_KEY) {
	console.warn(
		"VITE_GOOGLE_PLACES_API_KEY is not set. Google Places API calls will fail."
	);
}

// Initialize the loader once
let loaderInitialized = false;

async function ensureLoaderInitialized() {
	if (!GOOGLE_PLACES_API_KEY) {
		throw new Error("Google Places API key is not configured");
	}

	if (!loaderInitialized) {
		setOptions({
			key: GOOGLE_PLACES_API_KEY,
			v: "weekly",
		});
		loaderInitialized = true;
		// Wait for the bootstrap to complete by calling importLibrary
		await importLibrary("places");
	}
}

async function getPlacesLibrary() {
	await ensureLoaderInitialized();
	return await importLibrary("places");
}

function buildLocationBiasCircle(
	locationBias?: LocationBiasOptions
): google.maps.CircleLiteral | undefined {
	if (!locationBias) {
		return;
	}
	return {
		center: {
			lat: locationBias.lat,
			lng: locationBias.lng,
		},
		radius: locationBias.radiusMeters ?? DEFAULT_LOCATION_BIAS_RADIUS_METERS,
	};
}

export async function searchPlacesByText(
	query: string,
	options?: PlacesClientRequestOptions
): Promise<SearchPlacesByTextResponse> {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		return { results: [] };
	}

	const placesLibrary = await getPlacesLibrary();
	return new Promise((resolve, reject) => {
		const request: google.maps.places.SearchByTextRequest = {
			textQuery: trimmedQuery,
			fields: [
				"name",
				"formatted_address",
				"place_id",
				"geometry",
				"rating",
				"user_ratings_total",
				"opening_hours",
			],
		};
		const locationBiasCircle = buildLocationBiasCircle(options?.locationBias);
		if (locationBiasCircle) {
			request.locationBias = locationBiasCircle;
		}

		return placesLibrary.Place.searchByText(request)
			.then((results) => {
				const transformedResults = results.places.map((place) => ({
					name: place.displayName || "",
					formatted_address: place.formattedAddress ?? undefined,
					place_id: place.id,
					geometry: place.location
						? {
								location: {
									lat: place.location.lat(),
									lng: place.location.lng(),
								},
							}
						: undefined,
					rating: place.rating ?? undefined,
					user_ratings_total: place.userRatingCount ?? undefined,
				}));
				resolve({ results: transformedResults });
			})
			.catch((error) => {
				reject(new Error(`Google Places text search failed: ${error}`));
			});
	});
}

// Session token cache for autocomplete requests
const sessionTokenCache = new Map<
	string,
	google.maps.places.AutocompleteSessionToken
>();

async function getAutocompleteSessionToken(
	sessionToken: string
): Promise<google.maps.places.AutocompleteSessionToken> {
	const placesLibrary = await getPlacesLibrary();
	let token = sessionTokenCache.get(sessionToken);
	if (!token) {
		token = new placesLibrary.AutocompleteSessionToken();
		sessionTokenCache.set(sessionToken, token);
	}
	return token;
}

export async function autocompletePlaces(
	input: string,
	sessionToken: string,
	options?: PlacesClientRequestOptions
): Promise<AutocompletePlacesResponse> {
	const inputText = input.trim();
	if (!inputText) {
		return { suggestions: [] };
	}

	const placesLibrary = await getPlacesLibrary();
	const token = await getAutocompleteSessionToken(sessionToken);

	const request: google.maps.places.AutocompleteRequest = {
		input: inputText,
		sessionToken: token,
	};
	const locationBiasCircle = buildLocationBiasCircle(options?.locationBias);
	if (locationBiasCircle) {
		request.locationBias = locationBiasCircle;
	}

	try {
		const result =
			await placesLibrary.AutocompleteSuggestion.fetchAutocompleteSuggestions(
				request
			);

		const suggestions = result.suggestions
			.filter((suggestion) => suggestion.placePrediction !== null)
			.map((suggestion) => {
				const prediction = suggestion.placePrediction;
				if (!prediction) {
					throw new Error("Place prediction is null");
				}
				return {
					place_id: prediction.placeId,
					primary_text: prediction.mainText?.text || "",
					secondary_text: prediction.secondaryText?.text || "",
					full_text: prediction.text?.text || "",
				};
			});

		return { suggestions };
	} catch (error) {
		throw new Error(`Google Places autocomplete failed: ${error}`);
	}
}

export async function getPlaceDetails(
	placeId: string
): Promise<PlaceDetailsResponse> {
	if (!placeId) {
		throw new Error("placeId is required");
	}

	const placesLibrary = await getPlacesLibrary();

	// Create a Place instance from the place ID
	const place = new placesLibrary.Place({ id: placeId });

	// Fetch the fields we need
	const fetchRequest: google.maps.places.FetchFieldsRequest = {
		fields: [
			"id",
			"displayName",
			"formattedAddress",
			"location",
			"rating",
			"userRatingCount",
			"photos",
			"websiteURI",
			"internationalPhoneNumber",
			"nationalPhoneNumber",
			"googleMapsURI",
		],
	};

	try {
		const result = await place.fetchFields(fetchRequest);
		const fetchedPlace = result.place;

		return {
			id: fetchedPlace.id,
			name: fetchedPlace.displayName || "",
			formatted_address: fetchedPlace.formattedAddress ?? undefined,
			location: fetchedPlace.location
				? {
						lat: fetchedPlace.location.lat(),
						lng: fetchedPlace.location.lng(),
					}
				: undefined,
			rating: fetchedPlace.rating ?? undefined,
			user_ratings_total: fetchedPlace.userRatingCount ?? undefined,
			photos: fetchedPlace.photos?.map((photo) => ({
				name: photo.getURI() || "",
				widthPx: photo.widthPx || 0,
				heightPx: photo.heightPx || 0,
			})),
			website: fetchedPlace.websiteURI ?? undefined,
			phone: fetchedPlace.internationalPhoneNumber ?? undefined,
			google_maps_uri: fetchedPlace.googleMapsURI ?? undefined,
		};
	} catch (error) {
		throw new Error(`Google Places details request failed: ${error}`);
	}
}
