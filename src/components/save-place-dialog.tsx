import { Link } from "@tanstack/react-router";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { ListPlus, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CreateListDialog } from "@/components/create-list-dialog";
import { Button as InlineButton } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Button as PrimaryButton } from "./Button";

type SavePlaceDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	providerPlaceId: string;
	placeName?: string;
	savedPlaceId: Id<"saved_places"> | null;
	username?: string;
	onSavedPlaceCleared?: () => void;
};

type ListItem = {
	_id: Id<"place_lists">;
	name: string;
	slug: string;
	description?: string;
	visibility: "private" | "public";
	itemCount: number;
	isMember: boolean;
	entryId: Id<"place_list_entries"> | null;
};

export function SavePlaceDialog({
	open,
	onOpenChange,
	providerPlaceId,
	placeName,
	savedPlaceId,
	username,
	onSavedPlaceCleared,
}: SavePlaceDialogProps) {
	const [selectedListIds, setSelectedListIds] = useState<Id<"place_lists">[]>(
		[]
	);
	const [statusMessage, setStatusMessage] = useState<{
		type: "success" | "error";
		message: string;
	} | null>(null);
	const [showUnsaveConfirm, setShowUnsaveConfirm] = useState(false);
	const [isSavingLists, setIsSavingLists] = useState(false);
	const [isUnsaveLoading, setIsUnsaveLoading] = useState(false);
	const [isCreateListDialogOpen, setIsCreateListDialogOpen] = useState(false);
	const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

	const listsData = useConvexQuery(
		api.lists.getListsWithSavedPlaceState,
		open ? { providerPlaceId } : "skip"
	);

	const setSavedPlaceLists = useMutation(api.lists.setSavedPlaceLists);
	const unsaveSavedPlace = useMutation(api.places.unsaveSavedPlace);

	useEffect(() => {
		if (!open) {
			setHasInitializedSelection(false);
			return;
		}
		if (!listsData || hasInitializedSelection) {
			return;
		}
		const initialSelection = listsData.lists
			.filter((list) => list.isMember)
			.map((list) => list._id);
		setSelectedListIds(initialSelection);
		setHasInitializedSelection(true);
	}, [hasInitializedSelection, listsData, open]);

	const isLoadingLists = open && listsData === undefined;
	const lists: ListItem[] = useMemo(
		() => (listsData ? listsData.lists : []),
		[listsData]
	);

	const handleDialogOpenChange = (nextOpen: boolean) => {
		if (!nextOpen) {
			setStatusMessage(null);
			setShowUnsaveConfirm(false);
			setSelectedListIds([]);
			setIsCreateListDialogOpen(false);
			setHasInitializedSelection(false);
		}
		onOpenChange(nextOpen);
	};

	const handleToggleList = (listId: Id<"place_lists">, checked: boolean) => {
		setStatusMessage(null);
		setSelectedListIds((prev) => {
			if (checked) {
				if (prev.includes(listId)) {
					return prev;
				}
				return [...prev, listId];
			}
			return prev.filter((id) => id !== listId);
		});
	};

	const handleConfirm = async () => {
		if (!savedPlaceId) {
			setStatusMessage({
				type: "error",
				message: "Save this spot before assigning it to lists.",
			});
			return;
		}
		setIsSavingLists(true);
		setStatusMessage(null);
		try {
			const uniqueListIds = Array.from(new Set(selectedListIds));
			await setSavedPlaceLists({
				savedPlaceId,
				listIds: uniqueListIds,
			});
			setStatusMessage({
				type: "success",
				message: "Lists updated.",
			});
		} catch (error) {
			setStatusMessage({
				type: "error",
				message:
					error instanceof Error
						? error.message
						: "Unable to update lists. Try again.",
			});
		} finally {
			setIsSavingLists(false);
		}
	};

	const handleConfirmUnsave = async () => {
		if (!savedPlaceId) {
			setShowUnsaveConfirm(false);
			return;
		}
		setIsUnsaveLoading(true);
		setStatusMessage(null);
		try {
			await unsaveSavedPlace({ savedPlaceId });
			onSavedPlaceCleared?.();
			setSelectedListIds([]);
			setShowUnsaveConfirm(false);
			handleDialogOpenChange(false);
		} catch (error) {
			setStatusMessage({
				type: "error",
				message:
					error instanceof Error
						? error.message
						: "Unable to unsave this place.",
			});
		} finally {
			setIsUnsaveLoading(false);
		}
	};

	const emptyStateLink = username
		? { to: "/$username/lists" as const, params: { username } }
		: { to: "/app/onboarding/username" as const, params: undefined };

	return (
		<Dialog onOpenChange={handleDialogOpenChange} open={open}>
			<DialogContent
				className="sm:max-w-lg"
				onOpenAutoFocus={(event) => event.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle className="text-center">Saved!</DialogTitle>
					<DialogDescription>
						Optionally also save{" "}
						{placeName ? <strong>{placeName}</strong> : "this place"} to a list.
					</DialogDescription>
					{savedPlaceId && (
						<InlineButton
							className="absolute top-2 left-2 text-red-500 hover:text-red-600"
							onClick={() => setShowUnsaveConfirm(true)}
							size="sm"
							variant="ghost"
						>
							<Trash2 className="h-4 w-4" />
							Unsave
						</InlineButton>
					)}
				</DialogHeader>

				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<p className="font-semibold text-sm">Your lists</p>
						<InlineButton
							disabled={isLoadingLists}
							onClick={() => setIsCreateListDialogOpen(true)}
							size="sm"
							variant="outline"
						>
							<ListPlus className="h-4 w-4" />
							New list
						</InlineButton>
					</div>
					{isLoadingLists && (
						<div className="flex items-center gap-2 text-muted-foreground text-sm">
							<Loader2 className="h-4 w-4 animate-spin" />
							Loading your lists…
						</div>
					)}

					{!isLoadingLists && lists.length === 0 && (
						<div className="rounded-lg border border-dashed p-4 text-sm">
							<p className="font-medium">You don&apos;t have any lists yet.</p>
							<p className="mt-1 text-muted-foreground">
								Create your first list now or manage them from your lists page.
							</p>
							<div className="mt-3 flex flex-wrap gap-2">
								<InlineButton
									onClick={() => setIsCreateListDialogOpen(true)}
									size="sm"
								>
									<ListPlus className="h-4 w-4" />
									Create a list
								</InlineButton>
								<Link
									className="text-primary text-sm underline-offset-4 hover:underline"
									params={emptyStateLink.params}
									to={emptyStateLink.to}
								>
									Go to lists page
								</Link>
							</div>
						</div>
					)}

					{!isLoadingLists && lists.length > 0 && (
						<div className="max-h-64 space-y-3 overflow-y-auto pr-1">
							{lists.map((list) => {
								const checked = selectedListIds.includes(list._id);
								return (
									<div
										className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2"
										key={list._id}
									>
										<div>
											<p className="font-medium text-sm">{list.name}</p>
											<p className="text-muted-foreground text-xs">
												{list.itemCount} saved spot
												{list.itemCount === 1 ? "" : "s"}
											</p>
										</div>
										<Switch
											checked={checked}
											onCheckedChange={(value) =>
												handleToggleList(list._id, value)
											}
										/>
									</div>
								);
							})}
						</div>
					)}

					{statusMessage && (
						<div
							className={`rounded-md px-3 py-2 text-sm ${
								statusMessage.type === "success"
									? "bg-emerald-50 text-emerald-800"
									: "bg-red-50 text-red-700"
							}`}
						>
							{statusMessage.message}
						</div>
					)}
				</div>

				<DialogFooter className="gap-2 sm:justify-end">
					<PrimaryButton onClick={() => handleDialogOpenChange(false)}>
						Close
					</PrimaryButton>
					<PrimaryButton
						disabled={isSavingLists || isLoadingLists || !savedPlaceId}
						onClick={handleConfirm}
						variant="primary"
					>
						{isSavingLists ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Saving…
							</>
						) : (
							"Save"
						)}
					</PrimaryButton>
				</DialogFooter>

				{showUnsaveConfirm && (
					<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/95 p-6">
						<div className="w-full max-w-sm rounded-lg border bg-card p-5 shadow-lg">
							<p className="font-semibold">Remove this spot?</p>
							<p className="mt-1 text-muted-foreground text-sm">
								This will remove it from all of your lists and unsave it from
								your spots.
							</p>
							<div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
								<PrimaryButton
									disabled={isUnsaveLoading}
									onClick={handleConfirmUnsave}
									variant="destructive"
								>
									{isUnsaveLoading ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											Unsaving…
										</>
									) : (
										"Unsave"
									)}
								</PrimaryButton>
								<PrimaryButton onClick={() => setShowUnsaveConfirm(false)}>
									Cancel
								</PrimaryButton>
							</div>
						</div>
					</div>
				)}
			</DialogContent>
			<CreateListDialog
				onOpenChange={(value) => {
					if (!open && value) {
						return;
					}
					setIsCreateListDialogOpen(value);
				}}
				onSuccess={({ listId, name }) => {
					setSelectedListIds((prev) =>
						prev.includes(listId) ? prev : [...prev, listId]
					);
					setStatusMessage({
						type: "success",
						message: `Created “${name}.” Toggle it on and save when ready.`,
					});
				}}
				open={isCreateListDialogOpen}
			/>
		</Dialog>
	);
}
