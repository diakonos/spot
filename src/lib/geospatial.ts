import type { MapBounds } from "@/types/geospatial";

export function coordinatesEqual(
	a: MapBounds,
	b: MapBounds,
	tolerance = 0.0001
) {
	return (
		Math.abs(a.west - b.west) < tolerance &&
		Math.abs(a.south - b.south) < tolerance &&
		Math.abs(a.east - b.east) < tolerance &&
		Math.abs(a.north - b.north) < tolerance
	);
}
