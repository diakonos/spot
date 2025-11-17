"use node";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { v } from "convex/values";
import { createLogger } from "../src/lib/logger";
import { authedAction } from "./functions";

const logger = createLogger("convex/itinerary");

export const createItinerary = authedAction({
	args: {
		countryName: v.string(),
		places: v.array(
			v.object({
				name: v.string(),
				primaryType: v.optional(v.string()),
				formattedAddress: v.optional(v.string()),
				location: v.optional(v.object({ lat: v.number(), lng: v.number() })),
			})
		),
	},
	returns: v.object({
		itinerary: v.string(),
		countryName: v.string(),
		placeCount: v.number(),
	}),
	handler: async (_ctx, { countryName, places }) => {
		if (places.length === 0) {
			throw new Error("No places provided");
		}

		logger.debug(
			`Creating itinerary for ${countryName} with ${places.length} places`
		);

		// Build place information for the prompt
		const placesInfo = places
			.map((place, index) => {
				const type = place.primaryType || "place";
				const address = place.formattedAddress || "Address unknown";
				const coords = place.location
					? `(${place.location.lat}, ${place.location.lng})`
					: "";
				return `${index + 1}. ${place.name} - ${type}${coords ? ` ${coords}` : ""} - ${address}`;
			})
			.join("\n");

		const prompt = `You are a travel planning expert. Create a detailed itinerary for visiting ${countryName} with the following saved places:

${placesInfo}

Please create a comprehensive itinerary that:
1. Determines the recommended trip duration to visit all places at a comfortable pace
2. Takes into account the type of locations (e.g., breakfast places should be planned for morning, restaurants for meal times, attractions for daytime, etc.)
3. Considers the distance between locations and arranges them in an efficient order to minimize travel time
4. Groups nearby places together when possible
5. Provides a day-by-day breakdown with suggested times for each location
6. Includes practical tips and recommendations

Format the itinerary as markdown with clear sections for each day. Include:
- Total recommended trip duration
- Day-by-day schedule with times
- Travel tips between locations
- Any additional recommendations based on the types of places saved

Make the itinerary practical, enjoyable, and efficient.`;

		try {
			const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
			const apiKey = process.env.OPENROUTER_API_KEY;
			if (!apiKey) {
				throw new Error("OPENROUTER_API_KEY environment variable is not set");
			}
			const openrouter = createOpenRouter({
				apiKey,
			});
			const result = await generateText({
				model: openrouter.chat(model),
				prompt,
			});

			logger.debug(`Itinerary generated: ${result.text}`);

			return {
				itinerary: result.text,
				countryName,
				placeCount: places.length,
			};
		} catch (error) {
			logger.error(
				`Failed to generate itinerary: ${error instanceof Error ? error.message : "Unknown error"}`
			);
			throw new Error(
				`Failed to generate itinerary: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	},
});
