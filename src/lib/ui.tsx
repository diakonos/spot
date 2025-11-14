import { cn } from "./utils";

export const cardClassNames = (className = "") =>
	cn(
		"rounded-3xl border border-slate-100 bg-white p-5 shadow-md transition-shadow hover:shadow-lg",
		className
	);
