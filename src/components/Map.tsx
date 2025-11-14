// biome-ignore lint/style/useFilenamingConvention: Map component uses PascalCase name for consistency.

import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useQuery as useConvexQuery } from "convex/react";
import type { FeatureCollection, Point } from "geojson";
import { RLayer, RMap, RSource } from "maplibre-react-components";
import type {
	CircleLayerSpecification,
	Map as MapLibreMap,
	MapGeoJSONFeature,
	MapMouseEvent,
	StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coordinatesEqual } from "@/lib/geospatial";
import type { MapBounds, MapMarker, MapMode } from "@/types/geospatial";
import { api } from "../../convex/_generated/api";

type MapComponentProps = {
	mode: MapMode;
	highlightProviderPlaceId?: string | null;
	onMarkerSelect?: (marker: MapMarker) => void;
	onBoundsChange?: (bounds: MapBounds) => void;
};

type MarkerFeatureProperties = {
	markerData: MapMarker;
	isHighlighted: boolean;
	isSaved: boolean;
};

type MapEventWithTarget = {
	target: MapLibreMap;
};

const DEFAULT_CENTER: [number, number] = [-77.0369, 38.9072];
const DEFAULT_ZOOM = 12;
const USER_LOCATION_ZOOM = 16;
const GEOLOCATION_ERROR_UNSUPPORTED =
	"Geolocation is not supported by your browser. Showing Washington, DC instead.";
const GEOLOCATION_ERROR_UNAVAILABLE =
	"Unable to retrieve your location. Showing Washington, DC instead.";
const PLACES_SOURCE_ID = "places";
const PLACES_LAYER_ID = "places-layer";
const USER_LOCATION_SOURCE_ID = "user-location";
const USER_LOCATION_LAYER_ID = "user-location-layer";

const OSM_RASTER_STYLE: StyleSpecification = {
	version: 8,
	sources: {
		osm: {
			type: "raster",
			tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
			tileSize: 256,
			attribution:
				'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		},
	},
	layers: [
		{
			id: "osm",
			type: "raster",
			source: "osm",
		},
	],
};

const markerLayerPaint = {
	"circle-radius": [
		"case",
		["==", ["get", "isHighlighted"], true],
		10,
		["==", ["get", "isSaved"], true],
		7,
		6,
	],
	"circle-color": [
		"case",
		["==", ["get", "isHighlighted"], true],
		"#fb7185",
		["==", ["get", "isSaved"], true],
		"#2563eb",
		"#ffffff",
	],
	"circle-stroke-color": [
		"case",
		["==", ["get", "isHighlighted"], true],
		"#be123c",
		"#0f172a",
	],
	"circle-stroke-width": [
		"case",
		["==", ["get", "isHighlighted"], true],
		3,
		2,
	],
} as CircleLayerSpecification["paint"];

const userLocationLayerPaint = {
	"circle-radius": 8,
	"circle-color": "#2b7fff",
	"circle-stroke-width": 2,
	"circle-stroke-color": "#ffffff",
} as CircleLayerSpecification["paint"];

export default function MapComponent({
	mode,
	highlightProviderPlaceId,
	onMarkerSelect,
	onBoundsChange,
}: MapComponentProps) {
	const { loading: authLoading } = useAuth();
	const [error, setError] = useState<string | null>(null);
	const [bounds, setBounds] = useState<MapBounds | null>(null);
	const [userLocation, setUserLocation] = useState<[number, number] | null>(
		null
	);
	const [isMapReady, setIsMapReady] = useState(false);
	const mapRef = useRef<MapLibreMap | null>(null);
	const [markers, setMarkers] = useState<MapMarker[]>([]);

	const onMarkerSelectRef = useRef(onMarkerSelect);
	const onBoundsChangeRef = useRef(onBoundsChange);

	useEffect(() => {
		onMarkerSelectRef.current = onMarkerSelect;
	}, [onMarkerSelect]);

	useEffect(() => {
		onBoundsChangeRef.current = onBoundsChange;
	}, [onBoundsChange]);

	const updateBounds = useCallback((map: MapLibreMap) => {
		const mapBounds = map.getBounds();
		const newBounds: MapBounds = {
			west: mapBounds.getWest(),
			south: mapBounds.getSouth(),
			east: mapBounds.getEast(),
			north: mapBounds.getNorth(),
		};
		setBounds((prev) => {
			if (prev && coordinatesEqual(prev, newBounds)) {
				return prev;
			}
			onBoundsChangeRef.current?.(newBounds);
			return newBounds;
		});
	}, []);

	const handleMapLoad = useCallback(
		(event: MapEventWithTarget) => {
			const map = event.target;
			mapRef.current = map;
			setIsMapReady(true);
			updateBounds(map);
		},
		[updateBounds]
	);

	const handleMoveEnd = useCallback(
		(event: MapEventWithTarget) => {
			const map = event.target;
			mapRef.current = map;
			updateBounds(map);
		},
		[updateBounds]
	);

	const handleClick = useCallback((event: MapMouseEvent) => {
		const map = event.target as MapLibreMap;
		mapRef.current = map;
		const features = map.queryRenderedFeatures(event.point, {
			layers: [PLACES_LAYER_ID],
		}) as MapGeoJSONFeature[];
		const firstFeature = features[0];
		if (!firstFeature?.properties) {
			return;
		}
		const properties = firstFeature.properties as MarkerFeatureProperties;
		const marker = properties.markerData;
		if (marker) {
			onMarkerSelectRef.current?.(marker);
		}
	}, []);

	const handleMouseMove = useCallback((event: MapMouseEvent) => {
		const map = event.target as MapLibreMap;
		mapRef.current = map;
		const features = map.queryRenderedFeatures(event.point, {
			layers: [PLACES_LAYER_ID],
		});
		const canvas = map.getCanvas();
		canvas.style.cursor = features.length > 0 ? "pointer" : "";
	}, []);

	useEffect(() => {
		if (!isMapReady || !mapRef.current) {
			return;
		}

		let isActive = true;

		if (!navigator.geolocation) {
			setUserLocation(null);
			setError(GEOLOCATION_ERROR_UNSUPPORTED);
			return;
		}

		navigator.geolocation.getCurrentPosition(
			(position) => {
				if (!isActive) {
					return;
				}

				const userLonLat: [number, number] = [
					position.coords.longitude,
					position.coords.latitude,
				];
				setUserLocation(userLonLat);
				mapRef.current?.easeTo({
					center: userLonLat,
					zoom: USER_LOCATION_ZOOM,
				});
				setError(null);
			},
			() => {
				if (!isActive) {
					return;
				}
				setUserLocation(null);
				setError(GEOLOCATION_ERROR_UNAVAILABLE);
			},
			{
				enableHighAccuracy: true,
				timeout: 10_000,
				maximumAge: 0,
			}
		);

		return () => {
			isActive = false;
		};
	}, [isMapReady]);

	const queryArgs = useMemo(() => {
		if (!bounds || authLoading) {
			return;
		}
		return {
			bounds,
			mode,
			highlightProviderPlaceId: highlightProviderPlaceId ?? undefined,
		};
	}, [bounds, mode, highlightProviderPlaceId, authLoading]);

	const mapData = useConvexQuery(api.map.listPlacesForMap, queryArgs ?? "skip");

	useEffect(() => {
		if (queryArgs === undefined) {
			setMarkers([]);
			return;
		}
		if (mapData === undefined) {
			return;
		}
		setMarkers(mapData?.markers ?? []);
	}, [mapData, queryArgs]);

	const markersGeoJson = useMemo<FeatureCollection<Point, MarkerFeatureProperties>>(
		() => ({
			type: "FeatureCollection",
			features: markers.map((marker) => ({
				type: "Feature",
				geometry: {
					type: "Point",
					coordinates: [marker.longitude, marker.latitude],
				},
				properties: {
					markerData: marker,
					isHighlighted: marker.isHighlighted,
					isSaved: marker.isSaved,
				},
			})),
		}),
		[markers]
	);

	const userLocationSourceData = useMemo<FeatureCollection<Point> | null>(
		() => {
			if (!userLocation) {
				return null;
			}

			return {
				type: "FeatureCollection",
				features: [
					{
						type: "Feature",
						geometry: {
							type: "Point",
							coordinates: userLocation,
						},
						properties: {},
					},
				],
			};
		},
		[userLocation]
	);

	return (
		<div className="relative h-full w-full">
			{error && (
				<div
					className="-translate-x-1/2 absolute top-4 left-1/2 z-10 transform rounded border-yellow-500 border-l-4 bg-yellow-100 p-4 text-yellow-700"
					role="alert"
				>
					<p className="font-bold">Notice</p>
					<p>{error}</p>
				</div>
			)}
			<RMap
				id="spot-map"
				mapStyle={OSM_RASTER_STYLE}
				initialCenter={DEFAULT_CENTER}
				initialZoom={DEFAULT_ZOOM}
				onLoad={handleMapLoad}
				onMoveEnd={handleMoveEnd}
				onClick={handleClick}
				onMouseMove={handleMouseMove}
				style={{
					position: "absolute",
					inset: 0,
					width: "100%",
					height: "100%",
				}}
			>
				<RSource
					key={PLACES_SOURCE_ID}
					id={PLACES_SOURCE_ID}
					type="geojson"
					data={markersGeoJson}
				/>
				<RLayer
					key={PLACES_LAYER_ID}
					id={PLACES_LAYER_ID}
					source={PLACES_SOURCE_ID}
					type="circle"
					paint={markerLayerPaint}
				/>
				{userLocationSourceData ? (
					<>
						<RSource
							key={USER_LOCATION_SOURCE_ID}
							id={USER_LOCATION_SOURCE_ID}
							type="geojson"
							data={userLocationSourceData}
						/>
						<RLayer
							key={USER_LOCATION_LAYER_ID}
							id={USER_LOCATION_LAYER_ID}
							source={USER_LOCATION_SOURCE_ID}
							type="circle"
							paint={userLocationLayerPaint}
						/>
					</>
				) : null}
			</RMap>
		</div>
	);
}
