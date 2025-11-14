import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "../../../components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Skeleton } from "../../../components/ui/skeleton";
import { Textarea } from "../../../components/ui/textarea";
import {
	autocompletePlaces,
	getPlaceDetails,
} from "../../../integrations/google/client";
import type { PlaceDetailsResponse } from "../../../integrations/google/types";

export const Route = createFileRoute("/app/place/manual")({
	validateSearch: (search: Record<string, unknown>) => ({
		url: (search.url as string | undefined) || undefined,
	}),
	component: ManualPlaceEntryComponent,
});

type LoadingState = "idle" | "crawling" | "autocomplete" | "fetching" | "done";

type FormData = {
	name: string;
	formatted_address: string;
	website: string;
	phone: string;
	lat: string;
	lng: string;
	google_maps_uri: string;
	rating: string;
	user_ratings_total: string;
};

const MAX_AUTOCOMPLETE_SUGGESTIONS = 3;
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;

function createEmptyFormData(): FormData {
	return {
		name: "",
		formatted_address: "",
		website: "",
		phone: "",
		lat: "",
		lng: "",
		google_maps_uri: "",
		rating: "",
		user_ratings_total: "",
	};
}

function placeDetailsToFormData(place: PlaceDetailsResponse): FormData {
	return {
		name: place.name || "",
		formatted_address: place.formatted_address || "",
		website: place.website || "",
		phone: place.phone || "",
		lat: place.location?.lat?.toString() || "",
		lng: place.location?.lng?.toString() || "",
		google_maps_uri: place.google_maps_uri || "",
		rating: place.rating?.toString() || "",
		user_ratings_total: place.user_ratings_total?.toString() || "",
	};
}

function validateCoordinate(
	value: string,
	min: number,
	max: number
): string | null {
	if (!value.trim()) {
		return null;
	}
	const num = Number.parseFloat(value);
	if (Number.isNaN(num) || num < min || num > max) {
		return `Must be between ${min} and ${max}`;
	}
	return null;
}

function validateUrl(value: string): string | null {
	if (!value.trim()) {
		return null;
	}
	try {
		new URL(value.trim());
		return null;
	} catch {
		return "Invalid URL format";
	}
}

function validateFormData(formData: FormData): Record<string, string> {
	const errors: Record<string, string> = {};

	if (!formData.name.trim()) {
		errors.name = "Name is required";
	}

	const websiteError = validateUrl(formData.website);
	if (websiteError) {
		errors.website = websiteError;
	}

	const mapsUriError = validateUrl(formData.google_maps_uri);
	if (mapsUriError) {
		errors.google_maps_uri = mapsUriError;
	}

	const latError = validateCoordinate(formData.lat, MIN_LATITUDE, MAX_LATITUDE);
	if (latError) {
		errors.lat = latError;
	}

	const lngError = validateCoordinate(
		formData.lng,
		MIN_LONGITUDE,
		MAX_LONGITUDE
	);
	if (lngError) {
		errors.lng = lngError;
	}

	return errors;
}

function FormField({
	label,
	id,
	required = false,
	children,
	error,
}: {
	label: string;
	id: string;
	required?: boolean;
	children: React.ReactNode;
	error?: string;
}) {
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>
				{label} {required && <span className="text-red-500">*</span>}
			</Label>
			{children}
			{error && <p className="text-red-500 text-sm">{error}</p>}
		</div>
	);
}

function LoadingMessage({ state }: { state: LoadingState }) {
	const messages = {
		crawling: "Extracting place information from URL...",
		autocomplete: "Searching Google Places for matching results...",
		fetching: "Fetching complete place details...",
	} as const;

	const message = messages[state as keyof typeof messages];
	if (!message) {
		return null;
	}

	return (
		<div className="mx-auto mb-4 max-w-2xl rounded-lg border bg-muted/50 p-4">
			<p className="text-muted-foreground text-sm">{message}</p>
		</div>
	);
}

function ErrorMessage({ error }: { error: string }) {
	return (
		<div className="mx-auto mb-4 max-w-2xl rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
			<p className="font-medium">Error loading place details</p>
			<p className="text-sm">{error}</p>
		</div>
	);
}

function AlternativePlace({ place }: { place: PlaceDetailsResponse }) {
	return (
		<>
			<div className="font-medium">{place.name}</div>
			{place.formatted_address && (
				<div className="text-muted-foreground text-sm">
					{place.formatted_address}
				</div>
			)}
			{place.rating && (
				<div className="mt-2 text-muted-foreground text-xs">
					Rating: {place.rating}{" "}
					{place.user_ratings_total && `(${place.user_ratings_total} reviews)`}
				</div>
			)}
		</>
	);
}

function ManualPlaceEntryComponent() {
	const navigate = useNavigate();
	const search = useSearch({ from: "/app/place/manual" });
	const crawlUrlToPlace = useAction(api.crawl.firecrawlUrlToPlace);
	const savePlace = useMutation(api.places.savePlaceForCurrentUser);

	const [loadingState, setLoadingState] = useState<LoadingState>("idle");
	const [error, setError] = useState<string | null>(null);
	const sessionToken = useRef(crypto.randomUUID());
	const [formData, setFormData] = useState<FormData>(createEmptyFormData());
	const [autocompleteResults, setAutocompleteResults] = useState<
		PlaceDetailsResponse[]
	>([]);
	const [showAlternativesDialog, setShowAlternativesDialog] = useState(false);
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState<string | null>(null);

	// Progressive loading effect
	useEffect(() => {
		if (!search.url) {
			setLoadingState("done");
			return;
		}

		let mounted = true;
		setSelectedPlaceId(null);

		const loadPlaceData = async () => {
			try {
				// Step 1: Crawl URL
				setLoadingState("crawling");
				setError(null);

				const crawledData = await crawlUrlToPlace({
					url: search.url as string,
				});
				console.log("crawledData", crawledData);

				if (!mounted) {
					return;
				}

				setFormData((prev) => ({
					...prev,
					name: crawledData.name || "",
					formatted_address: crawledData.formatted_address || "",
					website: crawledData.website || "",
					phone: crawledData.phone || "",
				}));

				// Step 2 & 3: Search and fill place details
				if (crawledData.name) {
					setLoadingState("autocomplete");
					let query = crawledData.name;
					if (crawledData.formatted_address) {
						query += ` ${crawledData.formatted_address}`;
					}
					const response = await autocompletePlaces(
						query,
						sessionToken.current
					);
					console.log("autocomplete response", response);

					if (mounted && response.suggestions.length > 0) {
						setLoadingState("fetching");
						const detailsPromises = response.suggestions
							.slice(0, MAX_AUTOCOMPLETE_SUGGESTIONS)
							.map((s) => getPlaceDetails(s.place_id));

						const details = await Promise.all(detailsPromises);

						if (mounted) {
							setAutocompleteResults(details);
							if (details[0]) {
								setFormData(placeDetailsToFormData(details[0]));
								setSelectedPlaceId(details[0].id);
							} else {
								setSelectedPlaceId(null);
							}
						}
					}
				}

				if (mounted) {
					setLoadingState("done");
				}
			} catch (e) {
				if (mounted) {
					setError(
						e instanceof Error ? e.message : "Failed to load place data"
					);
					setLoadingState("done");
				}
			}
		};

		loadPlaceData();

		return () => {
			mounted = false;
		};
	}, [search.url, crawlUrlToPlace]);

	const handleChange = (field: string, value: string) => {
		setFormData((prev) => ({ ...prev, [field]: value }));
		if (errors[field]) {
			setErrors((prev) => {
				const newErrors = { ...prev };
				delete newErrors[field];
				return newErrors;
			});
		}
	};

	const handleSelectAlternative = (place: PlaceDetailsResponse) => {
		setFormData(placeDetailsToFormData(place));
		setSelectedPlaceId(place.id);
		setSaveError(null);
		setShowAlternativesDialog(false);
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const validationErrors = validateFormData(formData);
		setErrors(validationErrors);

		if (Object.keys(validationErrors).length > 0) {
			return;
		}

		if (!selectedPlaceId) {
			setSaveError("Select a Google place result before saving.");
			return;
		}

		if (isSaving) {
			return;
		}

		setSaveError(null);
		setIsSaving(true);

		try {
			const lat = formData.lat.trim();
			const lng = formData.lng.trim();
			const rating = formData.rating.trim();

			await savePlace({
				providerPlaceId: selectedPlaceId,
				name: formData.name.trim(),
				formattedAddress: formData.formatted_address.trim()
					? formData.formatted_address.trim()
					: undefined,
				location:
					lat && lng
						? {
								lat: Number.parseFloat(lat),
								lng: Number.parseFloat(lng),
							}
						: undefined,
				rating: rating ? Number.parseFloat(rating) : undefined,
			});

			navigate({ to: "/app/search" });
		} catch (err) {
			setSaveError(
				err instanceof Error ? err.message : "Failed to save place. Try again."
			);
		} finally {
			setIsSaving(false);
		}
	};

	const isLoading = ["crawling", "autocomplete", "fetching"].includes(
		loadingState
	);
	const showNameAndAddress =
		loadingState !== "idle" && loadingState !== "crawling";
	const showOtherFields = loadingState === "done";

	return (
		<div className="h-screen w-full overflow-y-auto">
			<div className="sticky top-0 z-10 flex items-center gap-4 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
				<button
					aria-label="Go back"
					className="flex items-center justify-center rounded-full p-2 transition-colors hover:bg-muted"
					onClick={() => {
						navigate({ to: "/app/search" });
					}}
					type="button"
				>
					<ArrowLeft className="h-5 w-5" />
				</button>
				<h1 className="font-semibold text-lg">
					{loadingState !== "done"
						? "Loading Place Details..."
						: "Add Place Manually"}
				</h1>
			</div>

			<div className="px-4 py-6">
				{error && <ErrorMessage error={error} />}
				{isLoading && <LoadingMessage state={loadingState} />}

				<form className="mx-auto max-w-2xl space-y-6" onSubmit={handleSubmit}>
					<FormField error={errors.name} id="name" label="Name" required>
						{showNameAndAddress ? (
							<Input
								id="name"
								onChange={(e) => {
									handleChange("name", e.target.value);
								}}
								placeholder="Business or place name"
								value={formData.name}
							/>
						) : (
							<Skeleton className="h-10 w-full" />
						)}
					</FormField>

					<FormField
						error={errors.formatted_address}
						id="address"
						label="Address"
					>
						{showNameAndAddress ? (
							<Textarea
								id="address"
								onChange={(e) => {
									handleChange("formatted_address", e.target.value);
								}}
								placeholder="Street address, city, state, zip code, country"
								rows={3}
								value={formData.formatted_address}
							/>
						) : (
							<Skeleton className="h-24 w-full" />
						)}
					</FormField>

					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<FormField error={errors.lat} id="lat" label="Latitude">
							{showOtherFields ? (
								<Input
									id="lat"
									onChange={(e) => {
										handleChange("lat", e.target.value);
									}}
									placeholder="e.g., 37.7749"
									type="text"
									value={formData.lat}
								/>
							) : (
								<Skeleton className="h-10 w-full" />
							)}
						</FormField>
						<FormField error={errors.lng} id="lng" label="Longitude">
							{showOtherFields ? (
								<Input
									id="lng"
									onChange={(e) => {
										handleChange("lng", e.target.value);
									}}
									placeholder="e.g., -122.4194"
									type="text"
									value={formData.lng}
								/>
							) : (
								<Skeleton className="h-10 w-full" />
							)}
						</FormField>
					</div>

					<FormField error={errors.phone} id="phone" label="Phone Number">
						{showOtherFields ? (
							<Input
								id="phone"
								onChange={(e) => {
									handleChange("phone", e.target.value);
								}}
								placeholder="e.g., +1 (555) 123-4567"
								type="tel"
								value={formData.phone}
							/>
						) : (
							<Skeleton className="h-10 w-full" />
						)}
					</FormField>

					<FormField error={errors.website} id="website" label="Website">
						{showOtherFields ? (
							<Input
								id="website"
								onChange={(e) => {
									handleChange("website", e.target.value);
								}}
								placeholder="https://example.com"
								type="url"
								value={formData.website}
							/>
						) : (
							<Skeleton className="h-10 w-full" />
						)}
					</FormField>

					<FormField
						error={errors.google_maps_uri}
						id="google_maps_uri"
						label="Google Maps Link"
					>
						{showOtherFields ? (
							<Input
								id="google_maps_uri"
								onChange={(e) => {
									handleChange("google_maps_uri", e.target.value);
								}}
								placeholder="https://maps.google.com/..."
								type="url"
								value={formData.google_maps_uri}
							/>
						) : (
							<Skeleton className="h-10 w-full" />
						)}
					</FormField>

					<FormField id="rating" label="Rating">
						{showOtherFields ? (
							<Input
								disabled
								id="rating"
								onChange={(e) => {
									handleChange("rating", e.target.value);
								}}
								placeholder="e.g., 4.5"
								type="text"
								value={formData.rating}
							/>
						) : (
							<Skeleton className="h-10 w-full" />
						)}
					</FormField>

					<div className="flex flex-col gap-3 pt-4">
						{showOtherFields && autocompleteResults.length > 1 && (
							<Button
								className="w-full"
								onClick={() => {
									setShowAlternativesDialog(true);
								}}
								type="button"
								variant="outline"
							>
								Not right? See {autocompleteResults.length - 1} other{" "}
								{autocompleteResults.length - 1 === 1
									? "suggestion"
									: "suggestions"}
							</Button>
						)}
						<div className="flex gap-3">
							<Button
								className="flex-1"
								disabled={isLoading || isSaving}
								type="submit"
							>
								{isSaving ? "Saving..." : "Save Place"}
							</Button>
							<Button
								onClick={() => {
									navigate({ to: "/app/search" });
								}}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
						</div>
						{saveError && (
							<p className="text-red-500 text-sm" role="alert">
								{saveError}
							</p>
						)}
					</div>
				</form>
			</div>

			<Dialog
				onOpenChange={setShowAlternativesDialog}
				open={showAlternativesDialog}
			>
				<DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Select a Place</DialogTitle>
						<DialogDescription>
							Choose the correct place from the suggestions below
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						{autocompleteResults.slice(1).map((place, index) => (
							<button
								className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
								key={place.id || index}
								onClick={() => {
									handleSelectAlternative(place);
								}}
								type="button"
							>
								<AlternativePlace place={place} />
							</button>
						))}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
