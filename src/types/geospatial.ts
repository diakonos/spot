import type { Doc, Id } from "../../convex/_generated/dataModel";

export type MapBounds = {
	west: number;
	south: number;
	east: number;
	north: number;
};

export type MapMarker = {
	placeId: string;
	providerPlaceId: string;
	name: string;
	latitude: number;
	longitude: number;
	isSaved: boolean;
	isHighlighted: boolean;
};

export type MapMode = "all" | "saved" | "none";

export type PlaceFilterKeys = {
	provider: Doc<"places">["provider"];
	primaryType?: Doc<"places">["primaryType"];
};

export type PlaceGeospatialKey = Id<"places">;
