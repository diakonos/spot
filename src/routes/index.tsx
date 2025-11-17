import { createFileRoute, Link } from "@tanstack/react-router";
import {
	getSignInUrl,
	getSignUpUrl,
} from "@workos/authkit-tanstack-react-start";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { Bookmark, Share2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
	component: App,
	loader: async () => ({
		signinLink: await getSignInUrl(),
		signupLink: await getSignUpUrl(),
	}),
});

function App() {
	const { user, loading, signOut } = useAuth();
	const isAuthenticated = Boolean(user);
	const greeting = user?.firstName || user?.email?.split("@")[0] || "traveler";
	const { signinLink, signupLink } = Route.useLoaderData();

	const features = [
		{
			text: "Never lose track of cool places you see online.",
			icon: Bookmark,
		},
		{
			text: "Easily share your favorite spots from your latest vacation.",
			icon: Share2,
		},
		{
			text: "Create travel itineraries in seconds based on the places you or your friends have saved.",
			icon: Sparkles,
		},
	];

	return (
		<div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-300 text-slate-900">
			<div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8">
				<header className="flex items-center justify-between gap-4">
					<Link className="flex items-center gap-2" to="/">
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
							<span className="font-semibold text-lg">S</span>
						</div>
						<span className="font-semibold text-slate-800">Spotted</span>
					</Link>

					<div className="flex flex-wrap items-center gap-3">
						{isAuthenticated ? (
							<>
								<span className="text-slate-500 text-sm">Hi, {greeting}</span>
								<Link
									className="rounded-full bg-slate-900 px-4 py-1.5 font-semibold text-sm text-white transition hover:bg-slate-800"
									to="/app"
								>
									Open app
								</Link>
								<button
									className="rounded-full border border-slate-200 px-4 py-1.5 font-medium text-slate-600 text-sm transition hover:bg-slate-100"
									disabled={loading}
									onClick={() => signOut({ returnTo: "/" })}
									type="button"
								>
									{loading ? "Signing out..." : "Sign out"}
								</button>
							</>
						) : (
							<>
								<a
									className="font-semibold text-slate-500 text-sm transition hover:text-slate-800"
									href={signinLink}
								>
									Sign in
								</a>
								<a
									className="rounded-full bg-slate-900 px-4 py-1.5 font-semibold text-sm text-white transition hover:bg-slate-800"
									href={signupLink}
								>
									Sign up
								</a>
							</>
						)}
					</div>
				</header>

				<main className="flex flex-1 items-center justify-center">
					<section className="mx-auto flex max-w-3xl flex-col items-center gap-10 py-10 text-center">
						<div className="space-y-4">
							<h1 className="font-semibold text-6xl tracking-tight sm:text-8xl">
								Spotted
							</h1>
							<p className="mx-auto max-w-2xl text-slate-600 text-xl sm:text-2xl">
								Spotted is the best way to create and share travel itineraries.
							</p>
						</div>

						<div className="grid w-full gap-4 sm:grid-cols-3">
							{features.map((feature) => (
								<div
									className="flex flex-col items-start rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
									key={feature.text}
								>
									<div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/5 text-slate-900">
										<feature.icon className="h-4 w-4" />
									</div>
									<p className="mt-3 text-slate-700 text-sm">{feature.text}</p>
								</div>
							))}
						</div>

						<div className="flex flex-wrap items-center justify-center gap-3">
							{isAuthenticated ? (
								<Link
									className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 font-semibold text-sm text-white shadow-sm transition hover:bg-slate-800"
									to="/app"
								>
									Open Spotted
								</Link>
							) : (
								<a
									className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-2.5 font-semibold text-sm text-white shadow-sm transition hover:bg-slate-800"
									href={signupLink}
								>
									Start planning
								</a>
							)}
						</div>
					</section>
				</main>
			</div>
		</div>
	);
}
