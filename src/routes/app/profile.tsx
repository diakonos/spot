import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { Button } from "@/components/Button";

const FALLBACK_SIGNIN_PATH = "/api/auth/login";

export const Route = createFileRoute("/app/profile")({
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
		<div className="min-h-screen bg-linear-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
			<div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-10 px-6 py-16 text-center">
				<div className="flex size-24 items-center justify-center rounded-full border border-white/20 bg-white/10 font-bold text-4xl uppercase tracking-widest">
					{initials}
				</div>
				<div className="space-y-2">
					<p className="text-base text-white/70">Signed in as</p>
					<h1 className="font-semibold text-4xl">{displayName}</h1>
					{user.email && <p className="text-lg text-white/80">{user.email}</p>}
				</div>
				<div className="w-full max-w-sm space-y-3">
					<Link className="block" to="/app/lists">
						<Button
							className="w-full rounded-2xl py-4 text-lg"
							variant="secondary"
						>
							View my lists
						</Button>
					</Link>
					<Link className="block" to="/app/my-spots">
						<Button
							className="w-full rounded-2xl py-4 text-lg"
							variant="primary"
						>
							View my spots
						</Button>
					</Link>
					<Link className="block" to="/app">
						<Button className="w-full rounded-2xl py-4 text-lg">
							Back to map
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
