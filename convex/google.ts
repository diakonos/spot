"use node";

import { v } from "convex/values";
import type { GooglePlaceDetailsResponse } from "../src/integrations/google/types";
import { createLogger } from "../src/lib/logger";
import { action } from "./_generated/server";
import { validators } from "./schema";

const logger = createLogger("convex/google");

export const fetchPlaceDetails = action({
	args: { placeId: v.string() },
	returns: validators.place.full,
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
			logger.error(`[${res.status}] ${res.statusText}`);
			logger.error(await res.text());
			throw new Error("Google Places Details API request failed.");
		}
		const place = (await res.json()) as GooglePlaceDetailsResponse;
		logger.debug("Google place:", place);

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
			rating: place.rating ?? undefined,
			raw: place,
		};
	},
});
