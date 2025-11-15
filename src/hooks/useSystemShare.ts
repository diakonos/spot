import { useCallback } from "react";

export type SharePayload = {
	text?: string;
	url?: string;
	title?: string;
};

type ShareMethod = "share" | "clipboard";

export type ShareResult =
	| {
			ok: true;
			method: ShareMethod;
	  }
	| {
			ok: false;
			method: ShareMethod;
			error?: unknown;
	  };

type ShareFn = (payload: SharePayload) => Promise<ShareResult>;

const buildShareData = (payload: SharePayload): ShareData => {
	const shareData: ShareData = {};
	if (payload.title) {
		shareData.title = payload.title;
	}
	if (payload.text) {
		shareData.text = payload.text;
	}
	if (payload.url) {
		shareData.url = payload.url;
	}
	return shareData;
};

const canUseSystemShare = (shareData: ShareData) => {
	if (
		typeof navigator === "undefined" ||
		typeof navigator.share !== "function"
	) {
		return false;
	}

	if (typeof navigator.canShare === "function") {
		return navigator.canShare(shareData);
	}

	return true;
};

const copyToClipboard = async (text: string) => {
	if (typeof navigator === "undefined") {
		throw new Error("Clipboard unavailable in this environment");
	}

	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
	}
};

export function useSystemShare(): ShareFn {
	const share = useCallback<ShareFn>(async (payload) => {
		const hasShareableContent = Boolean(payload.text ?? payload.url);

		if (!hasShareableContent) {
			return {
				ok: false,
				method: "share",
				error: new Error("Either text or url must be provided to share."),
			};
		}

		const shareData = buildShareData(payload);

		if (canUseSystemShare(shareData)) {
			try {
				await navigator.share(shareData);
				return { ok: true, method: "share" };
			} catch (error) {
				return { ok: false, method: "share", error };
			}
		}

		const textToCopy = payload.text ?? payload.url ?? "";

		try {
			await copyToClipboard(textToCopy);
			return { ok: true, method: "clipboard" };
		} catch (error) {
			return { ok: false, method: "clipboard", error };
		}
	}, []);

	return share;
}
