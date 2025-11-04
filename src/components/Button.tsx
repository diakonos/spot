import { cn } from "@/lib/utils";
import { Button as ShadcnButton } from "./ui/button";

export function Button({
	children,
	className,
	type = "button",
	...props
}: React.ComponentProps<typeof ShadcnButton>) {
	return (
		<ShadcnButton
			className={cn("rounded-full px-4 py-6 text-base", className)}
			type={type}
			{...props}
		>
			{children}
		</ShadcnButton>
	);
}
