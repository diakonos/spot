import {
	type LinkProps,
	useCanGoBack,
	useRouter,
} from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useCallback } from "react";
import { Button } from "./Button";

export type PageNavProps = {
	backLink?: LinkProps["to"];
	backLinkParams?: LinkProps["params"];
	onBack?: () => void | Promise<void>;
	title?: string;
	rightButton?: React.ReactNode;
};

export function PageNav({
	backLink,
	backLinkParams,
	onBack,
	title,
	rightButton,
}: PageNavProps) {
	const canGoBack = useCanGoBack();
	const router = useRouter();

	const handleBack = useCallback(() => {
		if (onBack) {
			onBack();
		} else if (backLink) {
			router.navigate({ to: backLink, params: backLinkParams });
		} else if (canGoBack) {
			router.history.back();
		} else {
			router.navigate({ to: "/" });
		}
	}, [onBack, canGoBack, router, backLink, backLinkParams]);

	return (
		<div className="flex w-full items-center justify-center p-4">
			<Button
				className="mr-auto flex items-center gap-2 hover:bg-slate-200"
				onClick={handleBack}
				variant="ghost"
			>
				<ArrowLeftIcon className="size-5" />
				Back
			</Button>
			{title && <h1 className="font-semibold text-lg">{title}</h1>}
			{rightButton ? (
				<div className="ml-auto">{rightButton}</div>
			) : (
				<button
					className="pointer-events-none ml-auto flex items-center gap-2 font-semibold opacity-0"
					onClick={handleBack}
					type="button"
				>
					<ArrowLeftIcon className="size-5" />
					Spacer
				</button>
			)}
		</div>
	);
}
