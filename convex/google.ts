"use node";

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
		businessStatus: v.optional(
			v.union(
				v.literal("OPERATIONAL"),
				v.literal("CLOSED_TEMPORARILY"),
				v.literal("CLOSED_PERMANENTLY")
			)
		),
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
				referrer: "https://rightful-schnauzer-365.convex.site",
			}
		);
		if (!res.ok) {
			console.error(`[${res.status}] ${res.statusText}`);
			console.error(await res.text());
			throw new Error("Google Places Details API request failed.");
		}
		const place = (await res.json()) as GooglePlaceDetailsResponse;
		console.debug("Google place:", place);

		return {
			provider: "google" as const,
			providerPlaceId: placeId,
			name: place.displayName?.text ?? "",
			displayName: place.displayName?.text
				? {
						text: place.displayName.text,
						languageCode: place.displayName.languageCode ?? "en-US",
					}
				: undefined,
			formattedAddress: place.formattedAddress ?? undefined,
			addressComponents: place.addressComponents
				?.filter((c) => !!c.longText)
				.map((c) => ({
					longText: c.longText!,
					shortText: c.shortText ?? undefined,
					types: c.types ?? [],
					languageCode: c.languageCode ?? "en-US",
				})),
			location:
				place.location?.latitude && place.location?.longitude
					? { lat: place.location.latitude, lng: place.location.longitude }
					: undefined,
			primaryType: place.primaryType ?? undefined,
			primaryTypeDisplayName: place.primaryTypeDisplayName?.text
				? {
						text: place.primaryTypeDisplayName.text,
						languageCode: place.primaryTypeDisplayName.languageCode ?? "en-US",
					}
				: undefined,
			businessStatus:
				place.businessStatus === "OPERATIONAL" ||
				place.businessStatus === "CLOSED_TEMPORARILY" ||
				place.businessStatus === "CLOSED_PERMANENTLY"
					? place.businessStatus
					: undefined,
			internationalPhoneNumber: place.internationalPhoneNumber ?? undefined,
			nationalPhoneNumber: place.nationalPhoneNumber ?? undefined,
			websiteUri: place.websiteUri ?? undefined,
			googleMapsUri: place.googleMapsUri ?? undefined,
			photos: place.photos?.map((p) => ({
				name: p.name ?? "",
				widthPx: p.widthPx ?? 0,
				heightPx: p.heightPx ?? 0,
			})),
			regularOpeningHours: place.regularOpeningHours
				? {
						openNow: place.regularOpeningHours.openNow ?? undefined,
						weekdayDescriptions:
							place.regularOpeningHours.weekdayDescriptions ?? undefined,
						periods: place.regularOpeningHours.periods?.map((p) => ({
							open:
								p.open?.day && p.open.hour && p.open.minute
									? {
											day: p.open.day!,
											hour: p.open.hour!,
											minute: p.open.minute!,
											date:
												p.open.date?.day &&
												p.open.date.year &&
												p.open.date.month
													? {
															year: p.open.date.year!,
															month: p.open.date.month!,
															day: p.open.date.day!,
														}
													: undefined,
										}
									: undefined,
							close:
								p.close?.day && p.close.hour && p.close.minute
									? {
											day: p.close.day!,
											hour: p.close.hour!,
											minute: p.close.minute!,
											date:
												p.close.date?.day &&
												p.close.date.year &&
												p.close.date.month
													? {
															year: p.close.date.year!,
															month: p.close.date.month!,
															day: p.close.date.day!,
														}
													: undefined,
										}
									: undefined,
						})),
					}
				: undefined,
			rating: place.rating ?? undefined,
			raw: place,
		};
	},
});
