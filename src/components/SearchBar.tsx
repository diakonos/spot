import { motion } from "framer-motion";
import { SearchIcon } from "lucide-react";
import { useState } from "react";
import { isProbablyUrl } from "../lib/utils";
import { Input } from "./ui/input";

interface SearchBarProps extends React.ComponentProps<typeof Input> {
	containerClassName?: string;
}

export function SearchBar({
	containerClassName = "",
	className = "",
	onFocus,
	onBlur,
	...props
}: SearchBarProps) {
	const [isFocused, setIsFocused] = useState(false);
	const isUrlMode =
		typeof props.value === "string" && isProbablyUrl(props.value);

	return (
		<motion.div
			className={`flex items-center rounded-full border-muted/50 px-4 shadow-lg backdrop-blur-sm transition-all duration-200 ease-in-out ${
				isUrlMode ? "bg-blue-50/60 dark:bg-blue-950/20" : "bg-background/95"
			} ${isFocused ? "ring-2" : ""} ${
				isFocused && isUrlMode
					? "ring-sky-300/30"
					: isFocused
						? "ring-ring/20"
						: ""
			} ${containerClassName}`}
			layoutId="searchbar"
			transition={{ layout: { duration: 0.5 } }}
		>
			<SearchIcon className="h-4 w-4 text-muted-foreground" />
			<Input
				className={`background-transparent border-0 px-4 py-6 text-base shadow-none focus-visible:ring-0 ${className}`}
				onBlur={(e) => {
					setIsFocused(false);
					onBlur?.(e);
				}}
				onFocus={(e) => {
					setIsFocused(true);
					onFocus?.(e);
				}}
				placeholder="Search..."
				type="search"
				{...props}
			/>
		</motion.div>
	);
}
