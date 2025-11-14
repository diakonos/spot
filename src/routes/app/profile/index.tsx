import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { ListIcon, MapPinIcon } from "lucide-react";
import { Button } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { PageNav } from "@/components/PageNav";

const FALLBACK_SIGNIN_PATH = "/api/auth/login";

export const Route = createFileRoute("/app/profile/")({
	loader: async () => {
		const [{ user }, signinLink] = await Promise.all([
			getAuth(),
			getSignInUrl(),
		]);

		if (!user) {
			throw redirect({
				href: signinLink ?? FALLBACK_SIGNIN_PATH,
			});
		}

		return { user };
	},
	component: ProfileRoute,
});

function ProfileRoute() {
	const { user } = Route.useLoaderData();
	const displayName = (
		user.firstName && user.lastName
			? `${user.firstName} ${user.lastName}`
			: (user.firstName ?? user.email ?? "User")
	).trim();
	const initials = displayName.slice(0, 2).toUpperCase();

	return (
		<PageContainer>
			<PageNav backLink="/app" title="Profile" />
			<div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 px-6 pt-10 text-center">
				<div className="flex size-24 items-center justify-center rounded-full border border-black/20 bg-black/10 font-bold text-4xl uppercase tracking-widest">
					{initials}
				</div>
				<h1 className="font-semibold text-4xl">{displayName}</h1>
				<div className="flex w-full max-w-sm space-x-3">
					<Link className="flex-1/2" to="/app/profile/lists">
						<Button className="w-full text-lg">
							<ListIcon className="size-5" />
							My lists
						</Button>
					</Link>
					<Link className="flex-1/2" to="/app/profile/spots">
						<Button className="w-full text-lg" variant="primary">
							<MapPinIcon className="size-5" />
							My spots
						</Button>
					</Link>
				</div>
			</div>
		</PageContainer>
	);
}
