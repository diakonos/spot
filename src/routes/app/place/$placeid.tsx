import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { Bookmark, ExternalLink, Globe, MapPin, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";
import { SavePlaceDialog } from "@/components/save-place-dialog";
import { useMapViewState } from "@/context/MapViewContext";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getPlaceDetails } from "../../../integrations/google/client";
import type { PlaceDetailsResponse } from "../../../integrations/google/types";
import { QUERY_STALE_TIME_MS } from "../../../lib/networking";

export const Route = createFileRoute("/app/place/$placeid")({
	component: PlaceDetailsComponent,
});

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This route coordinates several data sources and UI states; splitting it further would add indirection without clear benefit right now.
function PlaceDetailsComponent() {
	const { user } = useAuth();
	const { profile } = useCurrentProfile();
	const { placeid } = Route.useParams();
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isEnsuringSaved, setIsEnsuringSaved] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [localSavedPlaceId, setLocalSavedPlaceId] =
		useState<Id<"saved_places"> | null>(null);
	const { setHighlight } = useMapViewState();

	// Try to get place from Convex first
	const convexPlaceData = useConvexQuery(
		api.places.getPlaceDetailsWithSaveStatus,
		placeid ? { providerPlaceId: placeid } : "skip"
	);

	// Determine which data source to use
	const placeDetails: PlaceDetailsResponse | null | undefined =
		convexPlaceData?.place ?? null;
	const remoteSavedPlaceId = convexPlaceData?.savedPlaceId ?? null;
	const savedPlaceId = localSavedPlaceId ?? remoteSavedPlaceId;
	const isSaved = savedPlaceId !== null;
	let saveButtonLabel = "Save";
	if (isEnsuringSaved) {
		saveButtonLabel = "Saving…";
	} else if (isSaved) {
		saveButtonLabel = "Saved";
	}

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

	useEffect(() => {
		if (!(localSavedPlaceId && remoteSavedPlaceId)) {
			return;
		}
		if (localSavedPlaceId === remoteSavedPlaceId) {
			setLocalSavedPlaceId(null);
		}
	}, [localSavedPlaceId, remoteSavedPlaceId]);

	// Save mutation
	const savePlace = useMutation(api.places.savePlaceForCurrentUser);

	const buildSaveArgs = () => {
		if (!finalPlaceDetails) {
			return null;
		}
		return {
			providerPlaceId: placeid,
			name: finalPlaceDetails.name,
			formattedAddress: finalPlaceDetails.formatted_address,
			location: finalPlaceDetails.location,
			rating: finalPlaceDetails.rating,
		};
	};

	const ensurePlaceIsSaved = async (): Promise<Id<"saved_places"> | null> => {
		if (savedPlaceId) {
			return savedPlaceId;
		}
		if (!finalPlaceDetails) {
			setSaveError("Place details missing.");
			return null;
		}
		if (isEnsuringSaved) {
			return null;
		}
		const args = buildSaveArgs();
		if (!args) {
			return null;
		}
		setIsEnsuringSaved(true);
		setSaveError(null);
		try {
			const newSavedPlaceId = await savePlace(args);
			setLocalSavedPlaceId(newSavedPlaceId);
			return newSavedPlaceId;
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Failed to save place");
			return null;
		} finally {
			setIsEnsuringSaved(false);
		}
	};

	const handleOpenSaveDialog = async () => {
		const ensuredId = await ensurePlaceIsSaved();
		if (ensuredId) {
			setIsDialogOpen(true);
		}
	};

	const handleDialogOpenChange = (open: boolean) => {
		if (!open) {
			setIsDialogOpen(false);
		}
	};

	return (
		<PageContainer>
			<PageNav />
			{user && placeid && (
				<SavePlaceDialog
					onOpenChange={handleDialogOpenChange}
					onSavedPlaceCleared={() => {
						setLocalSavedPlaceId(null);
						setSaveError(null);
					}}
					open={isDialogOpen}
					placeName={finalPlaceDetails?.name}
					providerPlaceId={placeid}
					savedPlaceId={savedPlaceId}
					username={profile?.username ?? undefined}
				/>
			)}
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
								<div className="flex flex-wrap items-center gap-2">
									{user ? (
										<button
											aria-label="Save place"
											className={`flex items-center gap-2 rounded-lg border px-4 py-2 font-medium text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${
												isSaved
													? "border-primary bg-primary/10 text-primary"
													: "bg-background"
											}`}
											disabled={isEnsuringSaved || !finalPlaceDetails}
											onClick={handleOpenSaveDialog}
											type="button"
										>
											<Bookmark
												className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`}
											/>
											<span>{saveButtonLabel}</span>
										</button>
									) : (
										<Link
											className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-primary text-sm"
											to="/api/auth/login"
										>
											Sign in to save spots
										</Link>
									)}
								</div>
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
		</PageContainer>
	);
}
