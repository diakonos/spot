"use node";

import { WorkOS } from "@workos-inc/node";
import type { HttpRouter } from "convex/server";
import { createLogger } from "../../src/lib/logger";
import { internal } from "../_generated/api";
import { httpAction } from "../_generated/server";

const logger = createLogger("convex/workos/webhooks");

export function registerWorkOSWebhooks(http: HttpRouter) {
	http.route({
		path: "/api/workos/webhooks",
		method: "POST",
		handler: httpAction(async (ctx, req) => {
			const signature = req.headers.get("workos-signature");
			if (!signature) {
				return new Response(JSON.stringify({ error: "Missing signature" }), {
					status: 400,
					headers: { "Content-Type": "application/json" },
				});
			}

			// Validate environment variables
			const workosApiKey = process.env.WORKOS_API_KEY;
			if (!workosApiKey) {
				throw new Error("Missing WORKOS_API_KEY environment variable");
			}
			const workosWebhookSecret = process.env.WORKOS_WEBHOOK_SECRET;
			if (!workosWebhookSecret) {
				throw new Error("Missing WORKOS_WEBHOOK_SECRET environment variable");
			}

			try {
				const body = await req.json();
				const rawBody = JSON.stringify(body);
				const truncatedPayload =
					rawBody.length > 2000
						? `${rawBody.slice(0, 2000)}...[truncated]`
						: rawBody;
				logger.debug("Received webhook payload", {
					signaturePresent: Boolean(signature),
					payloadPreview: truncatedPayload,
				});

				// Verify and construct event using WorkOS SDK
				const workos = new WorkOS(workosApiKey);
				const event = await workos.webhooks.constructEvent({
					payload: body,
					sigHeader: signature,
					secret: workosWebhookSecret,
				});
				logger.debug("Verified webhook event", {
					eventType: event.event,
					data: event.data,
				});

				const eventType = event.event;
				if (eventType === "user.created" || eventType === "user.updated") {
					// Extract user information
					const workosId = event.data.id;
					const email = event.data.email;
					const firstName = event.data.firstName ?? undefined;
					const lastName = event.data.lastName ?? undefined;

					if (!email) {
						throw new Error("No email found in user data");
					}

					// Upsert user in Convex
					const userId = await ctx.runMutation(
						internal.users.upsertFromWorkOS,
						{
							workosId,
							email,
							firstName,
							lastName,
						}
					);
					logger.debug("Upserted user from WorkOS", {
						eventType,
						workosId,
						email,
						userId,
					});

					// Update WorkOS external_id with our Convex user id
					const workosClient = new WorkOS(workosApiKey);
					await workosClient.userManagement.updateUser({
						userId: workosId,
						externalId: userId,
					});
					logger.debug("Updated WorkOS user externalId", {
						workosId,
						externalId: userId,
					});
				} else if (eventType === "user.deleted") {
					// Delete user from Convex
					const workosId = event.data.id;
					await ctx.runMutation(internal.users.deleteByWorkOSId, {
						workosId,
					});
					logger.debug("Deleted Convex user via WorkOS event", {
						eventType,
						workosId,
					});
				}

				return new Response(JSON.stringify({ success: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			} catch (error) {
				logger.error("Webhook processing error", error);
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
}
