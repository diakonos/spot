import { render } from "@react-email/render";
import * as Sentry from "@sentry/tanstackstart-react";
import { createServerFn } from "@tanstack/react-start";
import { Resend } from "resend";
import { z } from "zod";
import { ItineraryEmail } from "./emailTemplates/ItineraryEmail";

export const emailItinerary = createServerFn({
	method: "POST",
})
	.inputValidator(
		z.object({
			email: z.string(),
			countryName: z.string(),
			itinerary: z.string(),
		})
	)
	.handler(async ({ data }) => {
		const { email, countryName, itinerary } = data;

		return await Sentry.startSpan({ name: "Email itinerary" }, async () => {
			const resend = new Resend(process.env.RESEND_API_KEY);

			const emailHtml = await render(
				ItineraryEmail({ countryName, itinerary })
			);

			const result = await resend.emails.send({
				from: process.env.RESEND_FROM_EMAIL || "no-reply@spot.justinling.tech",
				to: email,
				subject: `Your ${countryName} Travel Itinerary`,
				html: emailHtml,
			});

			if (result.error) {
				Sentry.captureException(new Error(result.error.message));
				throw new Error(result.error.message || "Failed to send email");
			}

			return {
				success: true,
				messageId: result.data?.id,
			};
		});
	});
