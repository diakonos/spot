import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import MapComponent from "@/components/Map";
import { SearchBar } from "@/components/SearchBar";
import { useMapViewState } from "@/context/MapViewContext";
import { useUserLocation } from "@/hooks/useUserLocation";
import type { MapMarker } from "@/types/geospatial";
import {
	autocompletePlaces,
	searchPlacesByText,
} from "../../../integrations/google/client";
import { isProbablyUrl } from "../../../lib/utils";

export const Route = createFileRoute("/app/search/")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	const [input, setInput] = useState("");
	const [debouncedInput, setDebouncedInput] = useState("");
	const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [results, setResults] = useState<
		Array<{
			name: string;
			formatted_address?: string;
			place_id: string;
			geometry?: { location?: { lat: number; lng: number } };
		}>
	>([]);

	const { mode, setHighlight, highlight } = useMapViewState();
	const { location: userLocation } = useUserLocation();

	const locationBias = useMemo(() => {
		if (!userLocation) {
			return;
		}
		return {
			lat: userLocation.lat,
			lng: userLocation.lng,
		};
	}, [userLocation]);

	const DEBOUNCE_DELAY_MS = 250;
	const SECONDS_PER_MINUTE = 60;
	const MS_PER_SECOND = 1000;
	const MINUTES_TO_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
	const STALE_TIME_MINUTES = 5;
	const STALE_TIME_MS = STALE_TIME_MINUTES * MINUTES_TO_MS;

	// Debounce input for autocomplete
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedInput(input);
		}, DEBOUNCE_DELAY_MS);

		return () => clearTimeout(timer);
	}, [input]);

	// Reset session token when input changes significantly (new search session)
	useEffect(() => {
		if (input.length === 0) {
			setSessionToken(crypto.randomUUID());
		}
	}, [input]);

	// Autocomplete query
	const {
		data: autocompleteData,
		isLoading: isAutocompleteLoading,
		error: autocompleteError,
	} = useQuery({
		queryKey: [
			"places",
			"autocomplete",
			debouncedInput,
			sessionToken,
			locationBias?.lat ?? null,
			locationBias?.lng ?? null,
		],
		queryFn: async () => {
			const res = await autocompletePlaces(
				debouncedInput,
				sessionToken,
				locationBias ? { locationBias } : undefined
			);
			return res.suggestions ?? [];
		},
		enabled: debouncedInput.length > 0,
		staleTime: STALE_TIME_MS,
	});

	const suggestions = useMemo(() => autocompleteData ?? [], [autocompleteData]);

	const handleSuggestionClick = useCallback(
		(placeId: string, name?: string) => {
			setHighlight({ providerPlaceId: placeId, name });
			navigate({
				to: "/app/place/$placeid" as const,
				params: { placeid: placeId },
				// biome-ignore lint/suspicious/noExplicitAny: TanStack Router state typing is complex
				state: { sessionToken } as any,
			});
		},
		[navigate, sessionToken, setHighlight]
	);

	const runSearch = useCallback(async () => {
		const trimmed = input.trim();
		if (!trimmed) {
			return;
		}

		// Check if input is a URL
		if (isProbablyUrl(trimmed)) {
			// Navigate immediately to manual entry route with URL parameter
			// The manual page will handle the crawling and progressive loading
			navigate({
				to: "/app/place/manual" as const,
				search: { url: trimmed },
			});
		} else {
			// Handle regular Google text search
			setIsLoading(true);
			setError(null);
			try {
				const res = await searchPlacesByText(
					trimmed,
					locationBias ? { locationBias } : undefined
				);
				setResults(res.results ?? []);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Search failed");
			} finally {
				setIsLoading(false);
			}
		}
	}, [input, navigate, locationBias]);

	const suggestionItems = useMemo(
		() =>
			suggestions.map((suggestion) => (
				<li key={suggestion.place_id}>
					<button
						className="w-full cursor-pointer p-3 text-left transition-colors hover:bg-muted/50"
						onClick={() => {
							handleSuggestionClick(
								suggestion.place_id,
								suggestion.primary_text
							);
						}}
						type="button"
					>
						<div className="font-medium leading-tight">
							{suggestion.primary_text}
						</div>
						{suggestion.secondary_text && (
							<div className="text-muted-foreground text-xs">
								{suggestion.secondary_text}
							</div>
						)}
					</button>
				</li>
			)),
		[handleSuggestionClick, suggestions]
	);

	const resultItems = useMemo(
		() =>
			results.map((r) => (
				<li key={r.place_id}>
					<button
						className="w-full cursor-pointer rounded-lg border bg-background/50 p-3 text-left transition-colors hover:bg-background/70"
						onClick={() => {
							handleSuggestionClick(r.place_id, r.name);
						}}
						type="button"
					>
						<div className="font-medium leading-tight">{r.name}</div>
						{r.formatted_address && (
							<div className="text-muted-foreground text-xs">
								{r.formatted_address}
							</div>
						)}
					</button>
				</li>
			)),
		[handleSuggestionClick, results]
	);

	const shouldShowResults = !(isLoading || error) && results.length > 0;

	return (
		<div className="relative h-screen w-full">
			<motion.div
				animate={{ opacity: 0.3 }}
				className="pointer-events-none absolute top-0 left-0 h-full w-full"
				layoutId="map"
			>
				<MapComponent
					highlightProviderPlaceId={highlight?.providerPlaceId}
					mode={mode}
					// keep map passive on search screen
					onMarkerSelect={(marker: MapMarker) =>
						setHighlight({
							providerPlaceId: marker.providerPlaceId,
							placeId: marker.placeId,
							name: marker.name,
						})
					}
				/>
			</motion.div>
			<div className="flex w-full justify-center gap-2 px-4 pt-4 pb-2 backdrop-blur">
				<button
					aria-label="Go back"
					className="flex h-12 w-12 shrink-0 grow-0 items-center justify-center rounded-full border-muted/50 bg-background/95 shadow-lg backdrop-blur-sm transition-all duration-200 ease-in-out hover:bg-background hover:ring-2 hover:ring-ring/20 active:ring-2 active:ring-ring/20"
					onClick={() => navigate({ to: "/app" })}
					type="button"
				>
					<ChevronLeft className="h-6 w-6 text-foreground md:hidden" />
					<span className="hidden items-center gap-2 md:flex">
						<ChevronLeft className="h-5 w-5 text-foreground" />
						<span className="font-medium text-sm">Back</span>
					</span>
				</button>
				<div className="relative w-full max-w-md">
					<motion.div layoutId="searchbar">
						<SearchBar
							autoFocus
							containerClassName="w-full"
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									runSearch();
								}
							}}
							value={input}
							// onBlur={() => navigate({ to: '/app' })}
						/>
					</motion.div>

					{/* Autocomplete suggestions dropdown */}
					{input.length > 0 &&
						!isLoading &&
						!error &&
						(isAutocompleteLoading || suggestions.length > 0) && (
							<div className="absolute top-full right-0 left-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border bg-background shadow-lg">
								{isAutocompleteLoading && (
									<div className="p-3 text-muted-foreground text-sm">
										Searching…
									</div>
								)}
								{autocompleteError && (
									<div className="p-3 text-red-500 text-sm">
										{autocompleteError instanceof Error
											? autocompleteError.message
											: "Failed to load suggestions"}
									</div>
								)}
								{suggestions.length > 0 && (
									<ul className="divide-y">{suggestionItems}</ul>
								)}
							</div>
						)}
				</div>
			</div>
			<div className="px-4 py-4">
				{isLoading && (
					<div className="text-muted-foreground text-sm">Searching…</div>
				)}
				{error && <div className="text-red-500 text-sm">{error}</div>}
				{shouldShowResults && <ul className="space-y-3">{resultItems}</ul>}
			</div>
		</div>
	);
}
