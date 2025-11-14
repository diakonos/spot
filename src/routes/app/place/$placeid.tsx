import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import {
	ArrowLeft,
	Bookmark,
	ExternalLink,
	Globe,
	MapPin,
	Phone,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useMapViewState } from "@/context/MapViewContext";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { getPlaceDetails } from "../../../integrations/google/client";
import type { PlaceDetailsResponse } from "../../../integrations/google/types";
import { QUERY_STALE_TIME_MS } from "../../../lib/networking";

export const Route = createFileRoute("/app/place/$placeid")({
	component: PlaceDetailsComponent,
});

function PlaceDetailsComponent() {
	const { user } = useAuth();
	const navigate = useNavigate();
	const { placeid } = Route.useParams();
	const [saveError, setSaveError] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [selectedListId, setSelectedListId] = useState<string | null>(null);
	const [listError, setListError] = useState<string | null>(null);
	const [listSuccess, setListSuccess] = useState<string | null>(null);
	const [isSavingToList, setIsSavingToList] = useState(false);
	const { setHighlight } = useMapViewState();

	const handleDialogOpenChange = (open: boolean) => {
		setIsDialogOpen(open);
		if (!open) {
			setSelectedListId(null);
			setListError(null);
			setListSuccess(null);
		}
	};

	// Try to get place from Convex first
	const convexPlaceData = useConvexQuery(
		api.places.getPlaceDetailsWithSaveStatus,
		placeid ? { providerPlaceId: placeid } : "skip"
	);

	// Determine which data source to use
	const placeDetails: PlaceDetailsResponse | null | undefined =
		convexPlaceData?.place ?? null;
	const isSaved = convexPlaceData?.isSaved ?? false;

	const listQueryArgs = useMemo(() => ({}) as const, []);
	const userLists = useConvexQuery(
		api.lists.getListsForCurrentUser,
		user ? listQueryArgs : "skip"
	);
	const listsLoading = user ? userLists === undefined : false;

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
	const addPlaceToList = useMutation(api.lists.addSavedPlaceToList);

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

	const handleSave = async () => {
		if (!finalPlaceDetails || isSaved || isSaving) {
			return;
		}

		setIsSaving(true);
		setSaveError(null);

		try {
			const args = buildSaveArgs();
			if (!args) {
				return;
			}
			await savePlace(args);
		} catch (err) {
			setSaveError(err instanceof Error ? err.message : "Failed to save place");
		} finally {
			setIsSaving(false);
		}
	};

	const handleAddToList = async () => {
		if (!user) {
			setListError("Sign in to save to a list.");
			return;
		}
		if (!selectedListId) {
			setListError("Select a list to continue.");
			return;
		}
		const args = buildSaveArgs();
		if (!args) {
			setListError("Place details missing.");
			return;
		}
		setIsSavingToList(true);
		setListError(null);
		setListSuccess(null);
		try {
			const savedPlaceId = await savePlace(args);
			await addPlaceToList({
				listId: selectedListId as Id<"place_lists">,
				savedPlaceId,
			});
			setListSuccess("Saved to list!");
			setSelectedListId(null);
		} catch (err) {
			setListError(
				err instanceof Error ? err.message : "Failed to save to list"
			);
		} finally {
			setIsSavingToList(false);
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
								<div className="flex flex-wrap items-center gap-2">
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
									{user ? (
										<Dialog
											onOpenChange={handleDialogOpenChange}
											open={isDialogOpen}
										>
											<DialogTrigger asChild>
												<button
													className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 py-2 text-primary transition-colors hover:bg-primary/20"
													type="button"
												>
													<Bookmark className="h-4 w-4" />
													<span className="font-medium text-sm">
														Save to list
													</span>
												</button>
											</DialogTrigger>
											<DialogContent>
												<DialogHeader>
													<DialogTitle>Save to a list</DialogTitle>
													<DialogDescription>
														Pick one of your lists to store this spot.
													</DialogDescription>
												</DialogHeader>
												<div className="space-y-4">
													{listsLoading && (
														<div className="text-muted-foreground text-sm">
															Loading lists…
														</div>
													)}
													{!listsLoading && userLists?.length === 0 && (
														<div className="rounded-md border border-dashed p-4 text-muted-foreground text-sm">
															<p>You don&apos;t have any lists yet.</p>
															<p className="mt-2">
																<Link
																	className="text-primary underline-offset-4 hover:underline"
																	to="/app/lists"
																>
																	Create one from your lists page.
																</Link>
															</p>
														</div>
													)}
													{!listsLoading &&
														userLists &&
														userLists.length > 0 && (
															<Select
																onValueChange={(value) => {
																	setSelectedListId(value);
																	setListError(null);
																}}
																value={selectedListId ?? undefined}
															>
																<SelectTrigger className="w-full">
																	<SelectValue placeholder="Choose a list" />
																</SelectTrigger>
																<SelectContent>
																	{userLists.map((list) => (
																		<SelectItem key={list._id} value={list._id}>
																			<span className="flex flex-col text-left">
																				<span className="font-medium text-sm">
																					{list.name}
																				</span>
																				<span className="text-muted-foreground text-xs">
																					{list.itemCount} saved spot
																					{list.itemCount === 1 ? "" : "s"}
																				</span>
																			</span>
																		</SelectItem>
																	))}
																</SelectContent>
															</Select>
														)}
													{listError && (
														<p className="text-red-500 text-sm">{listError}</p>
													)}
													{listSuccess && (
														<p className="text-green-600 text-sm">
															{listSuccess}
														</p>
													)}
												</div>
												<DialogFooter>
													<button
														className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
														disabled={
															isSavingToList ||
															listsLoading ||
															!userLists ||
															userLists.length === 0
														}
														onClick={handleAddToList}
														type="button"
													>
														{isSavingToList ? "Saving…" : "Save to list"}
													</button>
												</DialogFooter>
											</DialogContent>
										</Dialog>
									) : (
										<Link
											className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-primary text-sm"
											to="/app/profile"
										>
											Sign in to use lists
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
		</div>
	);
}
