import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { Button as PrimaryButton } from "@/components/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type CreateListDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess?: (payload: {
		listId: Id<"place_lists">;
		name: string;
		description?: string;
	}) => void;
};

export function CreateListDialog({
	open,
	onOpenChange,
	onSuccess,
}: CreateListDialogProps) {
	const createList = useMutation(api.lists.createList);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!open) {
			setName("");
			setDescription("");
			setError(null);
			setIsSubmitting(false);
		}
	}, [open]);

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const trimmedName = name.trim();
		const trimmedDescription = description.trim();
		if (!trimmedName) {
			setError("Enter a list name");
			return;
		}
		setIsSubmitting(true);
		setError(null);
		try {
			const listId = await createList({
				name: trimmedName,
				description: trimmedDescription ? trimmedDescription : undefined,
			});
			onSuccess?.({
				listId,
				name: trimmedName,
				description: trimmedDescription ? trimmedDescription : undefined,
			});
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create list");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create a new list</DialogTitle>
					<DialogDescription>
						Organize your favorite spots into personalized lists.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<label className="font-medium text-sm" htmlFor="list-name">
							List name
						</label>
						<Input
							autoFocus
							id="list-name"
							onChange={(event) => setName(event.target.value)}
							placeholder="e.g. Favorite coffee shops"
							value={name}
						/>
					</div>
					<div className="space-y-2">
						<label className="font-medium text-sm" htmlFor="list-description">
							Description{" "}
							<span className="text-muted-foreground">(optional)</span>
						</label>
						<Textarea
							id="list-description"
							onChange={(event) => setDescription(event.target.value)}
							placeholder="Add some details about this list"
							value={description}
						/>
					</div>
					{error && <p className="text-destructive text-sm">{error}</p>}
					<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
						<PrimaryButton
							className="sm:flex-1"
							disabled={isSubmitting}
							onClick={() => onOpenChange(false)}
							type="button"
						>
							Cancel
						</PrimaryButton>
						<PrimaryButton
							className="sm:flex-1"
							disabled={isSubmitting}
							type="submit"
						>
							{isSubmitting ? "Creating…" : "Create list"}
						</PrimaryButton>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
