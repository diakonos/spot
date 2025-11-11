// biome-ignore lint/style/useFilenamingConvention: Map component uses PascalCase name for consistency.
import { useQuery as useConvexQuery } from "convex/react";
import { Feature } from "ol";
import { Point } from "ol/geom";
import { Vector as VectorLayer } from "ol/layer";
import TileLayer from "ol/layer/Tile";
import OlMap from "ol/Map";
import type MapBrowserEvent from "ol/MapBrowserEvent";
import View from "ol/View";
import "ol/ol.css";
import { fromLonLat, toLonLat } from "ol/proj";
import { Vector as VectorSource } from "ol/source";
import OSM from "ol/source/OSM";
import { Circle, Fill, Stroke, Style } from "ol/style";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";

export type MapMode = "all" | "saved" | "none";

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

type MapComponentProps = {
	mode: MapMode;
	highlightProviderPlaceId?: string | null;
	onMarkerSelect?: (marker: MapMarker) => void;
	onBoundsChange?: (bounds: MapBounds) => void;
};

const washdcLongLat: [number, number] = [-77.0369, 38.9072];

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

function coordinatesEqual(a: MapBounds, b: MapBounds, tolerance = 0.0001) {
	return (
		Math.abs(a.west - b.west) < tolerance &&
		Math.abs(a.south - b.south) < tolerance &&
		Math.abs(a.east - b.east) < tolerance &&
		Math.abs(a.north - b.north) < tolerance
	);
}

export default function MapComponent({
	mode,
	highlightProviderPlaceId,
	onMarkerSelect,
	onBoundsChange,
}: MapComponentProps) {
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapInstanceRef = useRef<OlMap | null>(null);
	const placesLayerRef = useRef<VectorLayer<VectorSource> | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [bounds, setBounds] = useState<MapBounds | null>(null);

	const onMarkerSelectRef = useRef(onMarkerSelect);
	const onBoundsChangeRef = useRef(onBoundsChange);

	useEffect(() => {
		onMarkerSelectRef.current = onMarkerSelect;
	}, [onMarkerSelect]);

	useEffect(() => {
		onBoundsChangeRef.current = onBoundsChange;
	}, [onBoundsChange]);

	const defaultCenter = useMemo(() => fromLonLat(washdcLongLat), []);

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
		if (!mapContainerRef.current || mapInstanceRef.current) {
			return;
		}

		const baseLayer = new TileLayer({
			source: new OSM(),
		});

		const map = new OlMap({
			target: mapContainerRef.current,
			layers: [baseLayer],
			view: new View({
				center: defaultCenter,
				zoom: 12,
			}),
			controls: [],
		});

		const placeVectorSource = new VectorSource();
		const placeLayer = new VectorLayer({
			source: placeVectorSource,
			zIndex: 10,
		});
		map.addLayer(placeLayer);
		placesLayerRef.current = placeLayer;

		const handleMoveEnd = () => {
			updateBounds(map);
		};
		map.on("moveend", handleMoveEnd);

		const handleClick = (event: MapBrowserEvent<UIEvent>) => {
			const feature = map.forEachFeatureAtPixel(event.pixel, (feat) => feat);
			if (!feature) {
				return;
			}
			const markerData = feature.get("markerData") as MapMarker | undefined;
			if (markerData) {
				onMarkerSelectRef.current?.(markerData);
			}
		};
		map.on("singleclick", handleClick);

		const handlePointerMove = (event: MapBrowserEvent<UIEvent>) => {
			const hit = map.hasFeatureAtPixel(event.pixel);
			const targetElement = map.getTargetElement();
			if (targetElement) {
				targetElement.style.cursor = hit ? "pointer" : "";
			}
		};
		map.on("pointermove", handlePointerMove);

		mapInstanceRef.current = map;
		updateBounds(map);

		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const userLonLat: [number, number] = [
						position.coords.longitude,
						position.coords.latitude,
					];
					const userLocation = fromLonLat(userLonLat);
					map.getView().setCenter(userLocation);
					map.getView().setZoom(16);

					const userFeature = new Feature({
						geometry: new Point(userLocation),
					});
					userFeature.setStyle(
						new Style({
							image: new Circle({
								radius: 8,
								fill: new Fill({ color: "#38bdf8" }),
								stroke: new Stroke({ color: "#0f172a", width: 2 }),
							}),
						})
					);

					const locationLayer = new VectorLayer({
						source: new VectorSource({ features: [userFeature] }),
						zIndex: 20,
					});
					map.addLayer(locationLayer);
				},
				(_err) => {
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
		} else {
			setError(
				"Geolocation is not supported by your browser. Showing Washington, DC instead."
			);
		}

		return () => {
			map.un("moveend", handleMoveEnd);
			map.un("singleclick", handleClick);
			map.un("pointermove", handlePointerMove);
			map.setTarget(undefined);
			placesLayerRef.current = null;
			mapInstanceRef.current = null;
		};
	}, [defaultCenter, updateBounds]);

	const queryArgs = useMemo(() => {
		if (!bounds) {
			return;
		}
		return {
			bounds,
			mode,
			highlightProviderPlaceId: highlightProviderPlaceId ?? undefined,
		};
	}, [bounds, mode, highlightProviderPlaceId]);

	const mapData = useConvexQuery(api.map.listPlacesForMap, queryArgs);

	useEffect(() => {
		const layer = placesLayerRef.current;
		if (!layer) {
			return;
		}
		const source = layer.getSource();
		if (!source) {
			return;
		}
		if (mapData === undefined) {
			return;
		}

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
	}, [mapData]);

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
			<div
				className="h-full w-full"
				ref={mapContainerRef}
				style={{ position: "absolute", inset: 0 }}
			/>
		</div>
	);
}
