import { v } from "convex/values";
import type { GooglePlaceDetailsResponse } from "../src/integrations/google/types";
import { action } from "./_generated/server";

export const fetchPlaceDetails = action({
	args: { placeId: v.string() },
	returns: v.object({
		provider: v.literal("google"),
		providerPlaceId: v.string(),
		name: v.string(),
		displayName: v.optional(
			v.object({
				text: v.string(),
				languageCode: v.string(),
			})
		),
		formattedAddress: v.optional(v.string()),
		addressComponents: v.optional(
			v.array(
				v.object({
					longText: v.string(),
					shortText: v.optional(v.string()),
					types: v.array(v.string()),
					languageCode: v.optional(v.string()),
				})
			)
		),
		location: v.optional(
			v.object({
				lat: v.number(),
				lng: v.number(),
			})
		),
		primaryType: v.optional(v.string()),
		primaryTypeDisplayName: v.optional(
			v.object({
				text: v.string(),
				languageCode: v.string(),
			})
		),
		businessStatus: v.optional(v.string()),
		internationalPhoneNumber: v.optional(v.string()),
		nationalPhoneNumber: v.optional(v.string()),
		websiteUri: v.optional(v.string()),
		googleMapsUri: v.optional(v.string()),
		photos: v.optional(
			v.array(
				v.object({
					name: v.string(),
					widthPx: v.number(),
					heightPx: v.number(),
				})
			)
		),
		regularOpeningHours: v.optional(
			v.object({
				openNow: v.optional(v.boolean()),
				weekdayDescriptions: v.optional(v.array(v.string())),
				periods: v.optional(
					v.array(
						v.object({
							open: v.optional(
								v.object({
									day: v.optional(v.number()),
									hour: v.optional(v.number()),
									minute: v.optional(v.number()),
									date: v.optional(
										v.object({
											year: v.number(),
											month: v.number(),
											day: v.number(),
										})
									),
								})
							),
							close: v.optional(
								v.object({
									day: v.optional(v.number()),
									hour: v.optional(v.number()),
									minute: v.optional(v.number()),
									date: v.optional(
										v.object({
											year: v.number(),
											month: v.number(),
											day: v.number(),
										})
									),
								})
							),
						})
					)
				),
			})
		),
		rating: v.optional(v.number()),
		lastSyncedAt: v.number(),
		raw: v.record(v.string(), v.any()),
	}),
	handler: async (_ctx, { placeId }) => {
		const apiKey = process.env.GOOGLE_PLACES_API_KEY;
		if (!apiKey) {
			throw new Error("GOOGLE_PLACES_API_KEY environment variable is not set");
		}

		const fieldMask = [
			"id",
			"displayName",
			"formattedAddress",
			"addressComponents",
			"location",
			"rating",
			"photos",
			"websiteUri",
			"internationalPhoneNumber",
			"nationalPhoneNumber",
			"googleMapsUri",
			"regularOpeningHours",
			"primaryType",
			"primaryTypeDisplayName",
			"businessStatus",
		].join(",");

		const res = await fetch(
			`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
			{
				headers: {
					"X-Goog-Api-Key": apiKey,
					"X-Goog-FieldMask": fieldMask,
				},
			}
		);

		if (!res.ok) {
			const text = await res.text();
			throw new Error(
				`Google Places Details API request failed: ${res.status} - ${text}`
			);
		}

		const json = (await res.json()) as GooglePlaceDetailsResponse;

		return {
			provider: "google" as const,
			providerPlaceId: json.id,
			name: json.displayName?.text ?? "",
			displayName: json.displayName
				? {
						text: json.displayName.text,
						languageCode: json.displayName.languageCode ?? "en-US",
					}
				: undefined,
			formattedAddress: json.formattedAddress,
			addressComponents: json.addressComponents?.map((c) => ({
				longText: c.longText,
				shortText: c.shortText,
				types: c.types,
				languageCode: c.languageCode ?? "en-US",
			})),
			location: json.location
				? { lat: json.location.latitude, lng: json.location.longitude }
				: undefined,
			primaryType: json.primaryType,
			primaryTypeDisplayName: json.primaryTypeDisplayName
				? {
						text: json.primaryTypeDisplayName.text,
						languageCode: json.primaryTypeDisplayName.languageCode ?? "en-US",
					}
				: undefined,
			businessStatus: json.businessStatus,
			internationalPhoneNumber: json.internationalPhoneNumber,
			nationalPhoneNumber: json.nationalPhoneNumber,
			websiteUri: json.websiteUri,
			googleMapsUri: json.googleMapsUri,
			photos: json.photos,
			regularOpeningHours: json.regularOpeningHours,
			rating: json.rating,
			lastSyncedAt: Date.now(),
			raw: json,
		};
	},
});
