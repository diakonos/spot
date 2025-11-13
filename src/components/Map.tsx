// biome-ignore lint/style/useFilenamingConvention: Map component uses PascalCase name for consistency.

import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useQuery as useConvexQuery } from "convex/react";
import { Feature } from "ol";
import { Point } from "ol/geom";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import type OlMap from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import type { Types as MapBrowserEventTypeLiteral } from "ol/MapBrowserEventType";
import type { Types as MapEventTypeLiteral } from "ol/MapEventType";
import {
	Map as OlReactMap,
	TileLayer as TileLayerComponent,
	VectorLayer as VectorLayerComponent,
	View,
} from "react-openlayers";
import "ol/ol.css";
import { fromLonLat, toLonLat } from "ol/proj";
import { Vector as VectorSource } from "ol/source";
import OSM from "ol/source/OSM";
import { Circle, Fill, Stroke, Style } from "ol/style";
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

const washdcLongLat: [number, number] = [-77.0369, 38.9072];

const MOVE_END_EVENT: MapEventTypeLiteral = "moveend";
const SINGLE_CLICK_EVENT: MapBrowserEventTypeLiteral = "singleclick";
const POINTER_MOVE_EVENT: MapBrowserEventTypeLiteral = "pointermove";

const markerStyleCache = new Map<string, Style>();

function getMarkerStyle({
	isHighlighted,
	isSaved,
}: Pick<MapMarker, "isHighlighted" | "isSaved">) {
	const key = `${Number(isHighlighted)}-${Number(isSaved)}`;
	const cachedStyle = markerStyleCache.get(key);
	if (cachedStyle) {
		return cachedStyle;
	}

	let radius = 6;
	if (isHighlighted) {
		radius = 10;
	} else if (isSaved) {
		radius = 7;
	}

	let fillColor = "#ffffff";
	if (isHighlighted) {
		fillColor = "#fb7185"; // rose-400
	} else if (isSaved) {
		fillColor = "#2563eb"; // blue-600
	}

	const strokeColor = isHighlighted ? "#be123c" : "#0f172a";
	const strokeWidth = isHighlighted ? 3 : 2;

	const style = new Style({
		image: new Circle({
			radius,
			fill: new Fill({ color: fillColor }),
			stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
		}),
	});

	markerStyleCache.set(key, style);
	return style;
}

export default function MapComponent({
	mode,
	highlightProviderPlaceId,
	onMarkerSelect,
	onBoundsChange,
}: MapComponentProps) {
	const { loading: authLoading } = useAuth();
	const [mapInstance, setMapInstance] = useState<OlMap | null>(null);
	const [userLocationSource, setUserLocationSource] =
		useState<VectorSource | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [bounds, setBounds] = useState<MapBounds | null>(null);

	const handleMapMount = useCallback((map: OlMap | undefined) => {
		setMapInstance(map ?? null);
	}, []);

	const onMarkerSelectRef = useRef(onMarkerSelect);
	const onBoundsChangeRef = useRef(onBoundsChange);

	useEffect(() => {
		onMarkerSelectRef.current = onMarkerSelect;
	}, [onMarkerSelect]);

	useEffect(() => {
		onBoundsChangeRef.current = onBoundsChange;
	}, [onBoundsChange]);

	const defaultCenter = useMemo(() => fromLonLat(washdcLongLat), []);
	const baseTileSource = useMemo(() => new OSM(), []);
	const interactions = useMemo(
		() =>
			defaultInteractions({
				altShiftDragRotate: false,
				pinchRotate: false,
			}),
		[]
	);
	const placesSource = useMemo(() => new VectorSource(), []);

	const updateBounds = useCallback((map: OlMap) => {
		const size = map.getSize();
		if (!size) {
			return;
		}
		const extent = map.getView().calculateExtent(size);
		const bottomLeft = toLonLat([extent[0], extent[1]]);
		const topRight = toLonLat([extent[2], extent[3]]);
		const newBounds: MapBounds = {
			west: bottomLeft[0],
			south: bottomLeft[1],
			east: topRight[0],
			north: topRight[1],
		};
		setBounds((prev) => {
			if (prev && coordinatesEqual(prev, newBounds)) {
				return prev;
			}
			onBoundsChangeRef.current?.(newBounds);
			return newBounds;
		});
	}, []);

	useEffect(() => {
		if (!mapInstance) {
			return;
		}

		const mapEvents = mapInstance as unknown as {
			on: (type: string, listener: (event: unknown) => void) => void;
			un: (type: string, listener: (event: unknown) => void) => void;
		};

		const handleMoveEnd = () => {
			updateBounds(mapInstance);
		};

		const handleClick = (event: MapBrowserEvent<PointerEvent>) => {
			const feature = mapInstance.forEachFeatureAtPixel(
				event.pixel,
				(feat) => feat
			);
			if (!feature) {
				return;
			}
			const markerData = feature.get("markerData") as MapMarker | undefined;
			if (markerData) {
				onMarkerSelectRef.current?.(markerData);
			}
		};

		const handlePointerMove = (event: MapBrowserEvent<PointerEvent>) => {
			const hit = mapInstance.hasFeatureAtPixel(event.pixel);
			const targetElement = mapInstance.getTargetElement();
			if (targetElement) {
				targetElement.style.cursor = hit ? "pointer" : "";
			}
		};

		mapEvents.on(MOVE_END_EVENT, handleMoveEnd as (event: unknown) => void);
		mapEvents.on(SINGLE_CLICK_EVENT, handleClick as (event: unknown) => void);
		mapEvents.on(
			POINTER_MOVE_EVENT,
			handlePointerMove as (event: unknown) => void
		);

		updateBounds(mapInstance);

		return () => {
			mapEvents.un(MOVE_END_EVENT, handleMoveEnd as (event: unknown) => void);
			mapEvents.un(SINGLE_CLICK_EVENT, handleClick as (event: unknown) => void);
			mapEvents.un(
				POINTER_MOVE_EVENT,
				handlePointerMove as (event: unknown) => void
			);
		};
	}, [mapInstance, updateBounds]);

	useEffect(() => {
		if (!mapInstance) {
			return;
		}

		let isActive = true;

		if (!navigator.geolocation) {
			setError(
				"Geolocation is not supported by your browser. Showing Washington, DC instead."
			);
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
				const userLocation = fromLonLat(userLonLat);
				mapInstance.getView().setCenter(userLocation);
				mapInstance.getView().setZoom(16);

				const userFeature = new Feature({
					geometry: new Point(userLocation),
				});
				userFeature.setStyle(
					new Style({
						image: new Circle({
							radius: 8,
							fill: new Fill({ color: "#2b7fff" }),
							stroke: new Stroke({ color: "#fff", width: 2 }),
						}),
					})
				);

				setUserLocationSource(new VectorSource({ features: [userFeature] }));
				setError(null);
			},
			(_err) => {
				if (!isActive) {
					return;
				}
				setError(
					"Unable to retrieve your location. Showing Washington, DC instead."
				);
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
	}, [mapInstance]);

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
		if (mapData === undefined) {
			return;
		}

		const source = placesSource;

		source.clear(true);
		const markers = mapData?.markers ?? [];
		if (markers.length === 0) {
			return;
		}

		const features = markers.map((marker) => {
			const feature = new Feature({
				geometry: new Point(fromLonLat([marker.longitude, marker.latitude])),
			});
			feature.set("markerData", marker);
			feature.setStyle(getMarkerStyle(marker));
			return feature;
		});

		source.addFeatures(features);
	}, [mapData, placesSource]);

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
			<OlReactMap
				controls={[]}
				interactions={interactions}
				ref={handleMapMount}
				style={{
					position: "absolute",
					inset: 0,
					width: "100%",
					height: "100%",
				}}
			>
				<TileLayerComponent source={baseTileSource} />
				<VectorLayerComponent source={placesSource} zIndex={10} />
				{userLocationSource ? (
					<VectorLayerComponent source={userLocationSource} zIndex={20} />
				) : null}
				<View center={defaultCenter} zoom={12} />
			</OlReactMap>
		</div>
	);
}
