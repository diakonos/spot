import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSignInUrl } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/api/auth/login")({
	loader: async () => {
		const url = await getSignInUrl();
		if (!url) {
			throw new Error("Failed to get sign in URL");
		}
		throw redirect({ href: url });
	},
});
