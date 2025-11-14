import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/app")({
	loader: async () => {
		const { user } = await getAuth();
		// Inject user into context
		return { user: user ?? null };
	},
});
