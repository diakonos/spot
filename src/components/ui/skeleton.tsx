import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn("animate-pulse rounded-3xl bg-slate-200", className)}
			data-slot="skeleton"
			{...props}
		/>
	);
}

export { Skeleton };
