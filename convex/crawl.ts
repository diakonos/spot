"use node";

import FirecrawlApp from "@mendable/firecrawl-js";
import { v } from "convex/values";
import { z } from "zod";
import type { PlaceDetailsResponse } from "../src/integrations/google/types";
import { createLogger } from "../src/lib/logger";
import { authedAction } from "./functions";

const logger = createLogger("convex/crawl");

/**
 * Crawl a URL and attempt to extract place-like information using Firecrawl's structured extraction.
 * Returns a structure compatible with PlaceDetailsResponse from Google Places API.
 */
export const firecrawlUrlToPlace = authedAction({
	args: { url: v.string() },
	handler: async (_ctx, { url }): Promise<Partial<PlaceDetailsResponse>> => {
		// Validate URL format
		let parsedUrl: URL;
		try {
			// Prepend https:// if missing protocol but starts with www.
			const normalizedUrl = url.trim().startsWith("www.")
				? `https://${url.trim()}`
				: url.trim();
			parsedUrl = new URL(normalizedUrl);
		} catch (_error) {
			throw new Error(`Invalid URL format: ${url}`);
		}

		const apiKey = process.env.FIRECRAWL_API_KEY;
		if (!apiKey) {
			throw new Error("FIRECRAWL_API_KEY environment variable is not set");
		}

		const firecrawl = new FirecrawlApp({ apiKey });

		// Define the schema for structured data extraction using Zod
		// This matches the fields we want to extract from place/business websites
		const placeSchema = z.object({
			name: z.string(),
			address: z.string(),
			phone: z.string(),
			website: z.string(),
			category: z.union([
				z.literal("restaurant"),
				z.literal("bar"),
				z.literal("cafe"),
				z.literal("hotel"),
				z.literal("landmark"),
				z.literal("attraction"),
				z.literal("other"),
			]),
		});

		// Use Firecrawl's structured extraction with JSON format
		// Reference: https://docs.firecrawl.dev/features/scrape#extract-structured-data
		const scrapeResult = await firecrawl.scrape(parsedUrl.toString(), {
			formats: [
				{
					type: "json",
					schema: placeSchema,
					prompt:
						"You are helping a user extract information about a physical place. Extract information which identifies the place such as name, address, and the rest of the given schema.",
				},
			],
		});

		const extractedData = scrapeResult.json as Partial<
			z.infer<typeof placeSchema>
		>;
		logger.debug("firecrawl extracted data:", extractedData);

		if (!extractedData.name) {
			throw new Error("No name could be parsed.");
		}

		const response: Partial<PlaceDetailsResponse> = {
			name: extractedData.name,
			formatted_address: extractedData.address,
			website: extractedData.website || parsedUrl.toString(),
			phone: extractedData.phone,
		};

		return response;
	},
});

/**
 * Crawl a URL and attempt to extract place-like information using the spot-scraper service.
 * Returns a structure compatible with PlaceDetailsResponse from Google Places API.
 */
export const crawlUrlToplace = authedAction({
	args: { url: v.string() },
	handler: async (_ctx, { url }): Promise<Partial<PlaceDetailsResponse>> => {
		// Validate URL format
		let parsedUrl: URL;
		try {
			// Prepend https:// if missing protocol but starts with www.
			const normalizedUrl = url.trim().startsWith("www.")
				? `https://${url.trim()}`
				: url.trim();
			parsedUrl = new URL(normalizedUrl);
		} catch (_error) {
			throw new Error(`Invalid URL format: ${url}`);
		}

		const apiKey = process.env.SPOT_SCRAPER_API_KEY;
		if (!apiKey) {
			throw new Error("SPOT_SCRAPER_API_KEY environment variable is not set");
		}

		const response = await fetch(
			"https://spot-scraper-t5orb.sevalla.app/crawl",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
				},
				body: JSON.stringify({ url: parsedUrl.toString() }),
			}
		);

		if (!response.ok) {
			throw new Error(
				`Failed to crawl URL: ${response.status} ${response.statusText}`
			);
		}

		const result = await response.json();
		logger.debug("spot-scraper extracted data:", result);

		return result as Partial<PlaceDetailsResponse>;
	},
});
