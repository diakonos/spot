import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { getAuth, getSignInUrl } from "@workos/authkit-tanstack-react-start";
import { useQuery as useConvexQuery, useMutation } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { PageContainer } from "@/components/PageContainer";
import { Input } from "@/components/ui/input";
import { useCurrentProfile } from "@/hooks/useCurrentProfile";
import { api } from "../../../../convex/_generated/api";
import { normalizeUsername } from "../../../../shared/usernames";

const FALLBACK_SIGNIN_PATH = "/api/auth/login";

export const Route = createFileRoute("/app/onboarding/username")({
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
	component: UsernameOnboardingRoute,
});

function UsernameOnboardingRoute() {
	const navigate = useNavigate();
	const { profile, isLoading } = useCurrentProfile();
	const [input, setInput] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [touched, setTouched] = useState(false);
	const setUsername = useMutation(api.users.setUsername);

	useEffect(() => {
		if (profile?.username) {
			navigate({ to: "/app", replace: true });
		}
	}, [profile, navigate]);

	const rawCandidate = input.trim();
	const usernameCheckArgs = useMemo(() => {
		if (!rawCandidate) {
			return "skip";
		}
		return { username: rawCandidate };
	}, [rawCandidate]);

	const availability = useConvexQuery(
		api.users.usernameAvailable,
		usernameCheckArgs
	);

	const normalized = rawCandidate ? normalizeUsername(rawCandidate) : "";
	const isChecking = usernameCheckArgs !== "skip" && availability === undefined;
	const isAvailable = availability?.available ?? false;

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setTouched(true);
		if (!rawCandidate) {
			setError("Enter a username to continue.");
			return;
		}
		if (!isAvailable) {
			setError(availability?.reason ?? "Pick another username.");
			return;
		}

		try {
			setIsSubmitting(true);
			setError(null);
			await setUsername({
				desiredUsername: rawCandidate,
			});
			setSuccess("Username saved!");
			navigate({ to: "/app", replace: true });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save username");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<PageContainer>
			<div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col justify-center gap-6 px-6">
				<div>
					<p className="text-muted-foreground text-sm uppercase tracking-wide">
						Welcome to Spot
					</p>
					<h1 className="mt-2 font-semibold text-4xl">Choose your username</h1>
					<p className="mt-3 text-muted-foreground">
						Usernames create friendly profile links like spot.city/
						<span className="font-semibold">{normalized || "alex"}</span>
					</p>
				</div>
				<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
					<label
						className="font-medium text-muted-foreground text-sm uppercase tracking-wide"
						htmlFor="username"
					>
						Username
					</label>
					<Input
						autoFocus
						disabled={isSubmitting || isLoading}
						id="username"
						onBlur={() => setTouched(true)}
						onChange={(event) => {
							setInput(event.target.value);
							setError(null);
							setSuccess(null);
						}}
						placeholder="e.g. alex"
						value={input}
					/>
					<div className="min-h-[1.5rem] text-sm">
						{isChecking && <p className="text-muted-foreground">Checking…</p>}
						{!isChecking && availability?.reason && touched && (
							<p className="text-red-500">{availability.reason}</p>
						)}
						{!isChecking && isAvailable && rawCandidate && (
							<p className="text-emerald-500">
								spot.city/<span>{normalized}</span> is available
							</p>
						)}
						{error && <p className="text-red-500">{error}</p>}
						{success && <p className="text-emerald-500">{success}</p>}
					</div>
					<Button
						disabled={
							isSubmitting || !rawCandidate || isChecking || !isAvailable
						}
						type="submit"
					>
						{isSubmitting ? "Saving…" : "Save username"}
					</Button>
				</form>
			</div>
		</PageContainer>
	);
}
