import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	users: defineTable({
		email: v.string(),
		firstName: v.optional(v.string()),
		lastName: v.optional(v.string()),
		workosId: v.optional(v.string()),
	})
		.index("by_email", ["email"])
		.index("by_workos_id", ["workosId"]),

	// Canonical per-place snapshot (provider-owned fields only)
	places: defineTable({
		provider: v.literal("google"),
		providerPlaceId: v.string(), // Google Places "id"

		// Convenience display name (denormalized from displayName.text)
		name: v.string(),

		// LocalizedText fields per docs
		displayName: v.optional(
			v.object({ text: v.string(), languageCode: v.optional(v.string()) })
		),
		primaryType: v.optional(v.string()),
		primaryTypeDisplayName: v.optional(
			v.object({ text: v.string(), languageCode: v.optional(v.string()) })
		),

		// Addressing
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
		location: v.optional(v.object({ lat: v.number(), lng: v.number() })),

		// Status
		businessStatus: v.optional(
			v.union(
				v.literal("OPERATIONAL"),
				v.literal("CLOSED_TEMPORARILY"),
				v.literal("CLOSED_PERMANENTLY")
			)
		),

		// Contact
		internationalPhoneNumber: v.optional(v.string()),
		nationalPhoneNumber: v.optional(v.string()),
		websiteUri: v.optional(v.string()),
		googleMapsUri: v.optional(v.string()),

		// Media
		photos: v.optional(
			v.array(
				v.object({
					name: v.string(),
					widthPx: v.number(),
					heightPx: v.number(),
				})
			)
		),

		// Opening hours (subset of OpeningHours shape)
		regularOpeningHours: v.optional(
			v.object({
				openNow: v.optional(v.boolean()),
				weekdayDescriptions: v.optional(v.array(v.string())),
				periods: v.optional(
					v.array(
						v.object({
							open: v.optional(
								v.object({
									day: v.optional(v.number()), // 0-6 per docs
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
				secondaryHoursType: v.optional(v.string()),
				specialDays: v.optional(
					v.array(
						v.object({
							startDate: v.object({
								year: v.number(),
								month: v.number(),
								day: v.number(),
							}),
							endDate: v.object({
								year: v.number(),
								month: v.number(),
								day: v.number(),
							}),
						})
					)
				),
			})
		),

		// Ratings (aggregate only; no userRatingCount)
		rating: v.optional(v.number()),

		lastSyncedAt: v.number(), // ms
		raw: v.optional(v.any()), // optional debugging blob
	})
		.index("by_provider_id", ["provider", "providerPlaceId"])
		.index("by_last_synced", ["lastSyncedAt"]),

	// Per-owner save with app-specific overlay
	saved_places: defineTable({
		userId: v.id("users"),
		placeId: v.id("places"),
		tags: v.optional(v.array(v.string())),
		myRating: v.optional(v.number()),
		note: v.optional(v.string()),
		// Optionally future: userId: v.id("users")
	})
		.index("by_user", ["userId"])
		.index("by_user_place", ["userId", "placeId"]),
});

export const validators = {
	place: {
		full: v.object({
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
	},
};
