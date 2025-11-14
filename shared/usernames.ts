export const RESERVED_USERNAMES = new Set<string>([
	"admin",
	"api",
	"app",
	"auth",
	"login",
	"logout",
	"me",
	"profile",
	"settings",
	"signup",
	"spots",
	"lists",
	"search",
]);

export type UsernameValidationResult =
	| { ok: true; username: string }
	| { ok: false; username: string; reason: string };

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 30;

export function normalizeUsername(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");
}

const alphanumericRegex = /^[a-z0-9-]+$/;
const hyphenRegex = /^-|-$/;

export function validateUsername(input: string): UsernameValidationResult {
	const username = normalizeUsername(input);

	if (!username) {
		return {
			ok: false,
			username,
			reason: "Use letters or numbers in your username.",
		};
	}

	if (username.length < USERNAME_MIN_LENGTH) {
		return {
			ok: false,
			username,
			reason: `Usernames must be at least ${USERNAME_MIN_LENGTH} characters.`,
		};
	}

	if (username.length > USERNAME_MAX_LENGTH) {
		return {
			ok: false,
			username,
			reason: `Usernames must be under ${USERNAME_MAX_LENGTH + 1} characters.`,
		};
	}

	if (!alphanumericRegex.test(username)) {
		return {
			ok: false,
			username,
			reason: "Only lowercase letters, numbers, and hyphens are allowed.",
		};
	}

	if (hyphenRegex.test(username)) {
		return {
			ok: false,
			username,
			reason: "Usernames can't start or end with a hyphen.",
		};
	}

	if (RESERVED_USERNAMES.has(username)) {
		return {
			ok: false,
			username,
			reason: "That username is reserved.",
		};
	}

	return { ok: true, username };
}
