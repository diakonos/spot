import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import {
	ArrowLeft,
	Bookmark,
	ExternalLink,
	Globe,
	MapPin,
	Phone,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMapViewState } from "@/context/MapViewContext";
import { api } from "../../../../convex/_generated/api";
import { getPlaceDetails } from "../../../integrations/google/client";
import type { PlaceDetailsResponse } from "../../../integrations/google/types";
import { QUERY_STALE_TIME_MS } from "../../../lib/networking";

export const Route = createFileRoute("/app/place/$placeid")({
	component: PlaceDetailsComponent,
});

function PlaceDetailsComponent() {
	const navigate = useNavigate();
	const { placeid } = Route.useParams();
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const { setHighlight } = useMapViewState();

	// Try to get place from Convex first
	const convexPlaceData = useConvexQuery(
		api.places.getPlaceDetailsWithSaveStatus,
		placeid ? { providerPlaceId: placeid } : "skip"
	);

	// Determine which data source to use
	const placeDetails: PlaceDetailsResponse | null | undefined =
		convexPlaceData?.place ?? null;
	const isSaved = convexPlaceData?.isSaved ?? false;

	// Fallback to Google API if Convex doesn't have the place
	const {
		data: googlePlaceData,
		isLoading: isLoadingGoogle,
		error: googleError,
	} = useQuery({
		queryKey: ["places", "details", placeid],
		queryFn: async () => {
			if (!placeid) {
				throw new Error("placeid is required");
			}
			return await getPlaceDetails(placeid);
		},
		enabled: convexPlaceData === null && !!placeid,
		staleTime: QUERY_STALE_TIME_MS,
	});

	const finalPlaceDetails = placeDetails ?? googlePlaceData ?? null;
	const isLoading =
		convexPlaceData === undefined ||
		(convexPlaceData === null && isLoadingGoogle);
	const error = googleError;

	useEffect(() => {
		if (!finalPlaceDetails) {
			return;
		}
		setHighlight((prev) => {
			if (prev?.providerPlaceId === placeid) {
				return prev;
			}
			return {
				providerPlaceId: placeid,
				name: finalPlaceDetails.name,
			};
		});
		return () => {
			setHighlight((prev) => (prev?.providerPlaceId === placeid ? null : prev));
		};
	}, [finalPlaceDetails, placeid, setHighlight]);

	// Save mutation
	const savePlace = useMutation(api.places.savePlaceForCurrentUser);

	const handleSave = async () => {
		if (!finalPlaceDetails || isSaved || isSaving) {
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			await savePlace({
				providerPlaceId: placeid,
				name: finalPlaceDetails.name,
				formattedAddress: finalPlaceDetails.formatted_address,
				location: finalPlaceDetails.location,
				rating: finalPlaceDetails.rating,
			});
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Failed to save place");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="h-screen w-full overflow-y-auto">
			<div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
				<button
					aria-label="Go back"
					className="flex items-center justify-center rounded-full p-2 transition-colors hover:bg-muted"
					onClick={() => navigate({ to: "/app/search" })}
					type="button"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<p className="font-semibold text-lg">Back to search</p>
			</div>

			<div className="px-4 py-6">
				{isLoading && (
					<div className="py-8 text-center text-muted-foreground">
						Loading place details…
					</div>
				)}

				{error && (
					<div className="py-8 text-center text-red-500">
						{error instanceof Error
							? error.message
							: "Failed to load place details"}
					</div>
				)}

				{finalPlaceDetails && (
					<div className="space-y-6">
						{/* Name and Save Button */}
						<div>
							<div className="flex items-start justify-between gap-4">
								<div className="flex-1">
									<h2 className="font-bold text-2xl">
										{finalPlaceDetails.name}
									</h2>
									{finalPlaceDetails.formatted_address && (
										<div className="mt-2 flex items-start gap-2 text-muted-foreground">
											<MapPin className="mt-0.5 h-4 w-4 shrink-0" />
											<span className="text-sm">
												{finalPlaceDetails.formatted_address}
											</span>
										</div>
									)}
								</div>
								{!isSaved && (
									<button
										aria-label="Save place"
										className="flex items-center gap-2 rounded-lg border bg-background px-4 py-2 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
										disabled={isSaving}
										onClick={handleSave}
										type="button"
									>
										<Bookmark className="h-4 w-4" />
										<span className="font-medium text-sm">
											{isSaving ? "Saving..." : "Save"}
										</span>
									</button>
								)}
								{isSaved && (
									<div className="flex items-center gap-2 rounded-lg border bg-muted px-4 py-2">
										<Bookmark className="h-4 w-4 fill-current" />
										<span className="font-medium text-sm">Saved</span>
									</div>
								)}
							</div>
							{saveError && (
								<div className="mt-2 text-red-500 text-sm">{saveError}</div>
							)}
						</div>

						{/* Rating */}
						{finalPlaceDetails.rating !== undefined && (
							<div className="flex items-center gap-2">
								<span className="font-semibold text-lg">
									{finalPlaceDetails.rating.toFixed(1)}
								</span>
								<span className="text-muted-foreground">⭐</span>
								{finalPlaceDetails.user_ratings_total !== undefined && (
									<span className="text-muted-foreground text-sm">
										({finalPlaceDetails.user_ratings_total.toLocaleString()}{" "}
										reviews)
									</span>
								)}
							</div>
						)}

						{/* Open Now */}
						{finalPlaceDetails.open_now !== undefined && (
							<div
								className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium text-sm ${
									finalPlaceDetails.open_now
										? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
										: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
								}`}
							>
								<span
									className={`h-2 w-2 rounded-full ${
										finalPlaceDetails.open_now ? "bg-green-600" : "bg-red-600"
									}`}
								/>
								{finalPlaceDetails.open_now ? "Open Now" : "Closed"}
							</div>
						)}

						{/* Contact Information */}
						{(finalPlaceDetails.phone || finalPlaceDetails.website) && (
							<div className="space-y-3">
								{finalPlaceDetails.phone && (
									<a
										className="flex items-center gap-3 text-primary hover:underline"
										href={`tel:${finalPlaceDetails.phone}`}
									>
										<Phone className="h-5 w-5" />
										<span>{finalPlaceDetails.phone}</span>
									</a>
								)}
								{finalPlaceDetails.website && (
									<a
										className="flex items-center gap-3 text-primary hover:underline"
										href={finalPlaceDetails.website}
										rel="noopener noreferrer"
										target="_blank"
									>
										<Globe className="h-5 w-5" />
										<span className="truncate">
											{finalPlaceDetails.website}
										</span>
										<ExternalLink className="h-4 w-4 shrink-0" />
									</a>
								)}
							</div>
						)}

						{/* Google Maps Link */}
						{finalPlaceDetails.google_maps_uri && (
							<a
								className="flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-3 transition-colors hover:bg-muted"
								href={finalPlaceDetails.google_maps_uri}
								rel="noopener noreferrer"
								target="_blank"
							>
								<MapPin className="h-5 w-5" />
								<span>Open in Google Maps</span>
								<ExternalLink className="h-4 w-4" />
							</a>
						)}

						{/* Photos */}
						{finalPlaceDetails.photos &&
							finalPlaceDetails.photos.length > 0 && (
								<div className="space-y-2">
									<h3 className="font-semibold text-lg">Photos</h3>
									<div className="text-muted-foreground text-sm">
										{finalPlaceDetails.photos.length} photo
										{finalPlaceDetails.photos.length !== 1 ? "s" : ""} available
									</div>
									<div className="text-muted-foreground text-xs">
										Photo name: {finalPlaceDetails.photos[0]?.name}
									</div>
								</div>
							)}
					</div>
				)}
			</div>
		</div>
	);
}
