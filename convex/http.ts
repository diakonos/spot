import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
	path: "/api/workos/webhooks",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		// Get raw body and signature header
		const body = await req.text();
		const signature = req.headers.get("workos-signature");

		if (!signature) {
			return new Response(JSON.stringify({ error: "Missing signature" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		try {
			// Call the webhook handler action
			await ctx.runAction(internal.workos.webhooks.handleWorkOSWebhook, {
				payload: body,
				sigHeader: signature,
			});

			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (error) {
			// If signature verification failed, return 400
			if (error instanceof Error && error.message.includes("signature")) {
				return new Response(JSON.stringify({ error: "Invalid signature" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Other errors return 500
			return new Response(
				JSON.stringify({ error: "Webhook processing failed" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}
	}),
});

export default http;
