import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/app")({
	loader: async () => {
		const { user } = await getAuth();
		return { user: user ?? null };
	},
	component: AppLayout,
});
