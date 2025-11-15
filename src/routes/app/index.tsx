import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { AnimatePresence, motion } from "framer-motion";
import {
	CircleUserRoundIcon,
	PlusIcon,
	SearchIcon,
	SparkleIcon,
	XIcon,
} from "lucide-react";
import { type FormEvent, useCallback, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Input } from "@/components/ui/input";
import { useMapViewState } from "@/context/MapViewContext";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import type { MapMarker } from "@/types/geospatial";
import MapComponent from "../../components/Map";

export const Route = createFileRoute("/app/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { user } = useAuth();
	const { profile } = useCurrentProfile();
	const { mode, highlight, setHighlight } = useMapViewState();
	const navigate = useNavigate();
	const [saveOptionsOpen, setSaveOptionsOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");
	const [linkError, setLinkError] = useState<string | null>(null);
	const [showLinkForm, setShowLinkForm] = useState(false);
	const linkInputRef = useRef<HTMLInputElement>(null);

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

	const handleManualAdd = () => {
		navigate({ to: "/app/search" });
	};

	const handleSaveSpotClick = () => {
		setShowLinkForm(false);
		setLinkUrl("");
		setLinkError(null);
		setSaveOptionsOpen(true);
	};

	const handleSaveViaLinkClick = () => {
		if (!showLinkForm) {
			setShowLinkForm(true);
		}
		requestAnimationFrame(() => {
			linkInputRef.current?.focus();
		});
	};

	const handleLinkSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmed = linkUrl.trim();
		if (!trimmed) {
			return;
		}

		try {
			new URL(trimmed);
		} catch {
			setLinkError("Enter a valid URL");
			return;
		}

		navigate({
			to: "/app/place/manual",
			search: { url: trimmed },
		});
		handleCloseSaveOptions();
	};

	const handleCloseSaveOptions = useCallback(() => {
		setSaveOptionsOpen(false);
		setLinkUrl("");
		setLinkError(null);
		setShowLinkForm(false);
	}, []);

	const handleMapTap = useCallback(() => {
		if (saveOptionsOpen) {
			handleCloseSaveOptions();
		}
	}, [handleCloseSaveOptions, saveOptionsOpen]);

	const profileLink = profile?.username
		? "/$username"
		: "/app/onboarding/username";
	const profileLinkParams = profile?.username
		? { username: profile.username }
		: undefined;
	const profileLinkTo = user ? profileLink : "/api/auth/login";

	return (
		<div className="h-screen w-full">
			<motion.div
				className="absolute top-0 left-0 h-full w-full"
				layoutId="map"
			>
				<MapComponent
					highlightProviderPlaceId={highlight?.providerPlaceId}
					mode={mode}
					onMapTap={handleMapTap}
					onMarkerSelect={handleMarkerSelect}
				/>
			</motion.div>
			<div className="absolute top-0 right-0 left-0 z-10 w-full bg-linear-to-b from-black/30 to-transparent px-4 py-4">
				<div className="mx-auto flex flex-col gap-3 sm:max-w-lg">
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
								{highlight.providerPlaceId ? (
									<Link
										className="truncate font-semibold text-sm text-primary hover:underline"
										params={{ placeid: highlight.providerPlaceId }}
										to="/app/place/$placeid"
									>
										{highlight.name?.trim() || "Highlighted place"}
									</Link>
								) : (
									<p className="truncate font-semibold text-sm">
										{highlight.name?.trim() || "Highlighted place"}
									</p>
								)}
								<p className="truncate text-muted-foreground text-xs">
									{highlight.name ? "View details" : highlight.providerPlaceId}
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
			<div className="absolute bottom-0 left-0 flex w-full flex-col items-center justify-center gap-4 bg-linear-to-b from-transparent to-black/30 px-4 pt-4 pb-12">
				<div className="flex w-full justify-center">
					<AnimatePresence initial={false} mode="wait">
						{saveOptionsOpen ? (
							<motion.div
								animate={{ opacity: 1, y: 0 }}
								className="flex w-full max-w-md flex-col gap-3"
								exit={{ opacity: 0, y: 48 }}
								initial={{ opacity: 0, y: 48 }}
								key="expanded-save"
								transition={{ duration: 0.2, ease: "circInOut" }}
							>
								{!showLinkForm && (
									<Button
										className="w-full shadow-lg"
										onClick={handleManualAdd}
										variant="secondary"
									>
										<SearchIcon className="size-4" />
										Add manually
									</Button>
								)}
								<div
									className={`rounded-3xl bg-white/90 shadow-xl backdrop-blur-sm transition-all ${showLinkForm ? "p-4" : "p-0"}`}
								>
									<div className="flex flex-col gap-3">
										<form onSubmit={handleLinkSubmit}>
											<AnimatePresence initial={false} mode="wait">
												{showLinkForm && (
													<motion.div
														animate={{ opacity: 1, y: 0 }}
														className="mb-4 flex flex-col gap-2"
														exit={{ opacity: 0, y: 12 }}
														initial={{ opacity: 0, y: 12 }}
														transition={{ duration: 0.2, ease: "easeOut" }}
													>
														<Input
															onChange={(event) => {
																setLinkUrl(event.target.value);
																if (linkError) {
																	setLinkError(null);
																}
															}}
															placeholder="https://example.com/contact"
															ref={linkInputRef}
															type="url"
															value={linkUrl}
														/>
														{linkError && (
															<p className="text-red-500 text-sm">
																{linkError}
															</p>
														)}
													</motion.div>
												)}
											</AnimatePresence>
											<Button
												className="w-full"
												onClick={
													showLinkForm ? undefined : handleSaveViaLinkClick
												}
												type={showLinkForm ? "submit" : "button"}
												variant="primary"
											>
												<SparkleIcon className="size-4" />
												{showLinkForm ? "Continue" : "Paste a link"}
											</Button>
										</form>
									</div>
								</div>
								<button
									className="text-center font-bold text-red-500 text-sm underline-offset-4 hover:underline"
									onClick={handleCloseSaveOptions}
									type="button"
								>
									Cancel
								</button>
							</motion.div>
						) : (
							<motion.div
								animate={{ opacity: 1, y: 0 }}
								className="flex w-full max-w-xl gap-3"
								exit={{ opacity: 0, y: 48 }}
								initial={{ opacity: 0, y: 48 }}
								key="collapsed-save"
								transition={{ duration: 0.2, ease: "circInOut" }}
							>
								<Button
									className="inline-flex flex-1/2 shadow-lg"
									onClick={handleSaveSpotClick}
									variant="primary"
								>
									<PlusIcon className="size-6" /> Save spot
								</Button>
								<Link
									className="inline-flex flex-1/2"
									params={profileLinkParams}
									to={profileLinkTo}
								>
									<Button className="w-full shadow-lg">
										<CircleUserRoundIcon className="size-5" /> Profile
									</Button>
								</Link>
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</div>
	);
}
