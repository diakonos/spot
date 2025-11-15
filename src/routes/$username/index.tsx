import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery as useConvexQuery } from "convex/react";
import { ListIcon, MapPinIcon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/$username/")({
	component: UsernameProfileRoute,
});

function UsernameProfileRoute() {
	const { username } = Route.useParams();
	const profileArgs = useMemo(
		() => (username ? { username } : "skip"),
		[username]
	);
	const profileData = useConvexQuery(api.users.getPublicProfile, profileArgs);

	if (profileData === undefined) {
		return (
			<PageContainer>
				<PageNav title={`@${username}`} />
				<div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 px-6 pt-10 text-center">
					<div className="flex size-24 items-center justify-center rounded-full border border-black/20 bg-black/10 font-bold text-4xl uppercase tracking-widest" />
				</div>
				<div className="mt-10 flex w-full flex-col items-center justify-center space-y-2">
					<Skeleton className="h-10 w-50" />
					<Skeleton className="h-5 w-50" />
				</div>
			</PageContainer>
		);
	}

	if (!profileData) {
		return (
			<PageContainer>
				<PageNav title={`@${username}`} />
				<div className="space-y-2 pt-10 text-center">
					<h1 className="font-semibold text-4xl">Profile not found</h1>
					<p className="text-muted-foreground">
						Check the username and try again.
					</p>
				</div>
			</PageContainer>
		);
	}

	const { user, viewerIsOwner } = profileData;
	const displayName = buildDisplayName(user);
	const initials = getInitials(displayName || user.username);

	return (
		<PageContainer>
			<PageNav title={`@${user.username}`} />
			<div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 px-6 pt-10 text-center">
				<div className="flex size-24 items-center justify-center rounded-full border border-black/20 bg-black/10 font-bold text-4xl uppercase tracking-widest">
					{initials}
				</div>
				<div className="space-y-2">
					<h1 className="font-semibold text-4xl">{displayName}</h1>
				</div>
				<div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
					<Link className="flex-1" params={{ username }} to="/$username/lists">
						<Button className="w-full text-lg">
							<ListIcon className="size-5" />
							{viewerIsOwner ? "My lists" : "Lists"}
						</Button>
					</Link>
					{viewerIsOwner ? (
						<Link
							className="flex-1"
							params={{ username }}
							to="/$username/spots"
						>
							<Button className="w-full text-lg" variant="primary">
								<MapPinIcon className="size-5" />
								My spots
							</Button>
						</Link>
					) : (
						<Button className="w-full text-lg" disabled variant="secondary">
							<MapPinIcon className="size-5" />
							Spots are private
						</Button>
					)}
				</div>
			</div>
		</PageContainer>
	);
}

function buildDisplayName(user: {
	firstName?: string | null;
	lastName?: string | null;
	email: string;
	username: string;
}) {
	if (user.firstName && user.lastName) {
		return `${user.firstName} ${user.lastName}`.trim();
	}
	if (user.firstName) {
		return user.firstName;
	}
	return user.email ?? user.username;
}

const INITIALS_SPLITTER_REGEX = /\s+/;

function getInitials(value: string) {
	const parts = value
		.split(INITIALS_SPLITTER_REGEX)
		.filter(Boolean)
		.slice(0, 2);
	if (parts.length === 0) {
		return value.slice(0, 2).toUpperCase();
	}
	return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}
