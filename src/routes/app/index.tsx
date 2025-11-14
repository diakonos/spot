import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { motion } from "framer-motion";
import { ListIcon, SearchIcon, SparklesIcon, XIcon } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/Button";
import { useMapViewState } from "@/context/MapViewContext";
import type { MapMarker } from "@/types/geospatial";
import MapComponent from "../../components/Map";

export const Route = createFileRoute("/app/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { user } = useAuth();
	const { mode, highlight, setHighlight } = useMapViewState();

	const handleMarkerSelect = useCallback(
		(marker: MapMarker) => {
			setHighlight({
				providerPlaceId: marker.providerPlaceId,
				placeId: marker.placeId,
				name: marker.name,
			});
		},
		[setHighlight]
	);

	return (
		<div className="h-screen w-full">
			<motion.div
				className="absolute top-0 left-0 h-full w-full"
				layoutId="map"
			>
				<MapComponent
					highlightProviderPlaceId={highlight?.providerPlaceId}
					mode={mode}
					onMarkerSelect={handleMarkerSelect}
				/>
			</motion.div>
			<div className="-translate-x-1/2 absolute top-4 left-1/2 z-10 w-full max-w-xl px-4">
				<div className="flex flex-col gap-3">
					<Link to="/app/search">
						<motion.div layoutId="searchbar">
							<Button
								className="inline-flex w-full justify-start text-muted-foreground shadow-lg"
								variant="inputStyle"
							>
								<SearchIcon className="ml-4 h-8 w-8" /> Search for spots
							</Button>
						</motion.div>
					</Link>
					{highlight && (
						<div className="flex items-center justify-between gap-3 rounded-lg bg-white/90 px-3 py-2 text-slate-700 shadow-lg backdrop-blur">
							<div className="min-w-0">
								<p className="truncate font-semibold text-sm">
									{highlight.name ?? "Highlighted place"}
								</p>
								<p className="truncate text-muted-foreground text-xs">
									{highlight.providerPlaceId}
								</p>
							</div>
							<button
								aria-label="Clear highlight"
								className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition hover:bg-slate-300"
								onClick={() => setHighlight(null)}
								type="button"
							>
								<XIcon className="size-4" />
							</button>
						</div>
					)}
				</div>
			</div>
			<div className="relative h-18 bg-linear-to-t from-transparent to-black/30">
				{user && (
					<div className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white p-3 shadow-lg">
						{user.firstName?.charAt(0).toUpperCase()}
					</div>
				)}
			</div>
			<div className="absolute bottom-0 left-0 flex w-full flex-col justify-center gap-4 bg-linear-to-b from-transparent to-black/30 px-4 py-4">
				<div className="flex w-full gap-3">
					<Button className="flex-1 shadow-lg" variant="primary">
						<SparklesIcon className="h-8 w-8" /> Save spot
					</Button>
					<Link className="flex-1" to="/app/my-spots">
						<motion.div layoutId="my-spots">
							<Button className="w-full shadow-lg">
								<ListIcon className="h-8 w-8" /> My spots
							</Button>
						</motion.div>
					</Link>
				</div>
			</div>
		</div>
	);
}
