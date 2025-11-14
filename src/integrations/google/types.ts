/// <reference types="@types/google.maps" />

/**
 * Type definitions for Google Places API responses
 * Based on: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places#Place
 */

export type LocalizedText = {
	text: string;
	languageCode?: string;
};

export type AddressComponent = {
	longText: string;
	shortText?: string;
	types: string[];
	languageCode?: string;
};

export type LatLng = {
	latitude: number;
	longitude: number;
};

export type Photo = {
	name: string;
	widthPx: number;
	heightPx: number;
};

export type TimePoint = {
	day?: number; // 0-6, where 0 is Sunday
	hour?: number;
	minute?: number;
	date?: {
		year: number;
		month: number;
		day: number;
	};
};

export type Period = {
	open?: TimePoint;
	close?: TimePoint;
};

export type SpecialDay = {
	startDate: { year: number; month: number; day: number };
	endDate: { year: number; month: number; day: number };
};

export type OpeningHours = {
	openNow?: boolean;
	weekdayDescriptions?: string[];
	periods?: Period[];
	secondaryHoursType?: string;
	specialDays?: SpecialDay[];
};

export type BusinessStatus =
	| "OPERATIONAL"
	| "CLOSED_TEMPORARILY"
	| "CLOSED_PERMANENTLY";

/**
 * Google Places API Place resource response
 * Used for the GET /places/{placeId} endpoint
 */
export type GooglePlaceDetailsResponse = {
	id: string;
	displayName?: LocalizedText;
	formattedAddress?: string;
	addressComponents?: AddressComponent[];
	location?: LatLng;
	rating?: number;
	photos?: Photo[];
	websiteUri?: string;
	internationalPhoneNumber?: string;
	nationalPhoneNumber?: string;
	googleMapsUri?: string;
	primaryType?: string;
	primaryTypeDisplayName?: LocalizedText;
	businessStatus?: BusinessStatus;
};

/**
 * Google Places API Text Search response
 */
export type GooglePlacesTextSearchResponse = {
	places: Array<{
		id: string;
		displayName?: LocalizedText;
		formattedAddress?: string;
		location?: LatLng;
		rating?: number;
		userRatingCount?: number;
		photos?: Photo[];
	}>;
};

/**
 * Google Places API Autocomplete response
 */
export type GooglePlacesAutocompleteResponse = {
	suggestions: Array<{
		placePrediction?: {
			placeId: string;
			text: {
				text: string;
			};
			structuredFormat?: {
				mainText: {
					text: string;
				};
				secondaryText: {
					text: string;
				};
			};
		};
	}>;
};

/**
 * Response type for autocompletePlaces function
 */
export type AutocompletePlacesResponse = {
	suggestions: Array<{
		place_id: string;
		primary_text: string;
		secondary_text: string;
		full_text: string;
	}>;
};

/**
 * Response type for searchPlacesByText function
 */
export type SearchPlacesByTextResponse = {
	results: Array<{
		name: string;
		formatted_address?: string;
		place_id: string;
		geometry?: { location?: { lat: number; lng: number } };
		rating?: number;
		user_ratings_total?: number;
		opening_hours?: google.maps.places.OpeningHours;
	}>;
};

/**
 * Response type for getPlaceDetails function
 */
export type PlaceDetailsResponse = {
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
};
