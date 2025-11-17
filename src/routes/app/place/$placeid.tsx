import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { Bookmark, ExternalLink, Globe, MapPin, Phone, ShareIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";
import { Button } from "@/components/Button";
import { SavePlaceDialog } from "@/components/save-place-dialog";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@/components/ui/carousel";
import { useMapViewState } from "@/context/MapViewContext";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { useSystemShare } from "@/hooks/useSystemShare";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getPlaceDetails } from "../../../integrations/google/client";
import type { PlaceDetailsResponse } from "../../../integrations/google/types";
import { QUERY_STALE_TIME_MS } from "../../../lib/networking";
import { createLogger } from "@/lib/logger";

const logger = createLogger("PlaceDetailsRoute");

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
const LEADING_SLASHES_REGEX = /^\/+/;
type PlacePhoto = NonNullable<PlaceDetailsResponse["photos"]>[number];
type ResolvedPlacePhoto = PlacePhoto & { url: string };

const resolveProviderPhotoUrl = (photo: PlacePhoto): string | null => {
	const photoName = photo?.name?.trim();
	if (!photoName) {
		return null;
	}
	if (photoName.startsWith("http://") || photoName.startsWith("https://")) {
		return photoName;
	}
	if (!GOOGLE_PLACES_API_KEY) {
		return null;
	}
	const normalizedName = photoName.replace(LEADING_SLASHES_REGEX, "");
	const url = new URL(
		`https://places.googleapis.com/v1/${normalizedName}/media`
	);
	const params = new URLSearchParams();
	const width = photo.widthPx && photo.widthPx > 0 ? photo.widthPx : 800;
	params.set("maxWidthPx", Math.min(width, 1600).toString());
	params.set("key", GOOGLE_PLACES_API_KEY);
	url.search = params.toString();
	return url.toString();
};

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
	const sharePlace = useSystemShare();

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

	const handleSharePlace = useCallback(async () => {
		if (typeof window === "undefined" || !finalPlaceDetails) {
			return;
		}
		const placeName = finalPlaceDetails.name ?? "Spot";
		const result = await sharePlace({
			url: window.location.href,
			title: placeName,
			text: `Check out ${placeName} on Spot.`,
		});
		if (!result.ok) {
			logger.error("Failed to share place", result.error);
		}
	}, [finalPlaceDetails, sharePlace]);

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
	const shareButton = finalPlaceDetails ? (
		<Button className="hover:bg-slate-200" onClick={handleSharePlace} variant="ghost">
			<ShareIcon className="size-4" />
			Share
		</Button>
	) : null;

	let primaryActionButton: ReactNode | null = null;
	if (placeid && user) {
		primaryActionButton = (
			<button
				aria-label="Save place"
				className={`flex items-center gap-2 rounded-full border px-4 py-2 font-medium text-sm shadow-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${
					isSaved
						? "border-primary bg-primary/10 text-primary"
						: "bg-background text-foreground"
				}`}
				disabled={isEnsuringSaved || !finalPlaceDetails}
				onClick={handleOpenSaveDialog}
				type="button"
			>
				<Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
				<span>{saveButtonLabel}</span>
			</button>
		);
	} else if (!user) {
		primaryActionButton = (
			<Link
				className="rounded-full border border-primary/40 bg-primary/5 px-4 py-2 text-primary text-sm"
				to="/api/auth/login"
			>
				Sign in to save spots
			</Link>
		);
	}

	const pageNavRightButton =
		shareButton || primaryActionButton ? (
			<div className="flex items-center gap-2">
				{shareButton}
				{primaryActionButton}
			</div>
		) : null;
	const photoItems =
		finalPlaceDetails?.photos?.filter((photo) => Boolean(photo?.name)) ?? [];
	const resolvedPhotoItems = useMemo<ResolvedPlacePhoto[]>(
		() =>
			photoItems
				.map((photo) => {
					const url = resolveProviderPhotoUrl(photo);
					return url ? { ...photo, url } : null;
				})
				.filter((photo): photo is ResolvedPlacePhoto => photo !== null),
		[photoItems]
	);

	return (
		<PageContainer>
			<PageNav rightButton={pageNavRightButton} />
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
			<div className="px-4">
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
						{/* Name */}
						<div>
							<h2 className="font-bold text-2xl">{finalPlaceDetails.name}</h2>
							{finalPlaceDetails.formatted_address && (
								<div className="mt-2 flex items-start gap-2 text-muted-foreground">
									<MapPin className="mt-0.5 h-4 w-4 shrink-0" />
									<span className="text-sm">
										{finalPlaceDetails.formatted_address}
									</span>
								</div>
							)}
							{saveError && (
								<div className="mt-2 text-red-500 text-sm">{saveError}</div>
							)}
						</div>

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

						{/* Photos */}
						{resolvedPhotoItems.length > 0 && (
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<h3 className="font-semibold text-lg">Photos</h3>
									<span className="text-muted-foreground text-sm">
										{resolvedPhotoItems.length} photo
										{resolvedPhotoItems.length !== 1 ? "s" : ""} available
									</span>
								</div>
								<Carousel
									className="w-full"
									opts={{ align: "start", loop: true }}
								>
									<CarouselContent>
										{resolvedPhotoItems.map((photo) => (
											<CarouselItem key={photo.url}>
												<div className="overflow-hidden rounded-xl bg-muted">
													<img
														alt={`${finalPlaceDetails.name} scene`}
														className="h-64 w-full object-cover"
														height={photo.heightPx || 600}
														loading="lazy"
														src={photo.url}
														width={photo.widthPx || 800}
													/>
												</div>
											</CarouselItem>
										))}
									</CarouselContent>
									<CarouselPrevious
										className="-translate-y-1/2 top-1/2"
										style={{ left: "0.75rem" }}
									/>
									<CarouselNext
										className="-translate-y-1/2 top-1/2"
										style={{ right: "0.75rem" }}
									/>
								</Carousel>
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
					</div>
				)}
			</div>
		</PageContainer>
	);
}
