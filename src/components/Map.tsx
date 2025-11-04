import { Feature } from "ol";
import { Point } from "ol/geom";
import { Vector as VectorLayer } from "ol/layer";
import TileLayer from "ol/layer/Tile";
import OlMap from "ol/Map";
import View from "ol/View";
import "ol/ol.css";
import { fromLonLat } from "ol/proj";
import { Vector as VectorSource } from "ol/source";
import OSM from "ol/source/OSM";
import { Circle, Fill, Stroke, Style } from "ol/style";
import { useEffect, useRef, useState } from "react";

const washdcLongLat = [-77.0369, 38.9072];

export default function MapComponent() {
	const mapRef = useRef<HTMLDivElement>(null);
	const [error, setError] = useState<string | null>(null);

	// Default to Washington DC coordinates
	const defaultCenter = fromLonLat(washdcLongLat);

	useEffect(() => {
		// Initialize the map
		const initialMap = new OlMap({
			target: "map",
			layers: [
				new TileLayer({
					source: new OSM(),
				}),
			],
			view: new View({
				center: defaultCenter,
				zoom: 12,
			}),
			controls: [],
		});

		// setMap(initialMap);

		// Request user's location
		if (navigator.geolocation) {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const userLocation = fromLonLat([
						position.coords.longitude,
						position.coords.latitude,
					]);

					// Update the view to center on user's location
					initialMap.getView().setCenter(userLocation);
					initialMap.getView().setZoom(17);

					// Add a marker for the user's location
					const marker = new Feature({
						geometry: new Point(userLocation),
					});

					const markerStyle = new Style({
						image: new Circle({
							radius: 8,
							fill: new Fill({ color: "#4285F4" }),
							stroke: new Stroke({
								color: "#fff",
								width: 2,
							}),
						}),
					});

					marker.setStyle(markerStyle);

					const vectorSource = new VectorSource({
						features: [marker],
					});

					const vectorLayer = new VectorLayer({
						source: vectorSource,
					});

					initialMap.addLayer(vectorLayer);
				},
				(err) => {
					console.error("Error getting location:", err);
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

		// Cleanup function
		return () => {
			if (initialMap) {
				initialMap.setTarget(undefined);
			}
		};
	}, [defaultCenter]);

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
				id="map"
				ref={mapRef}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
				}}
			/>
		</div>
	);
}
