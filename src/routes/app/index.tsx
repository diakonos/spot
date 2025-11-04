import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { motion } from "framer-motion";
import { ListIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/Button";
import MapComponent from "../../components/Map";

export const Route = createFileRoute("/app/")({
	component: RouteComponent,
});

function RouteComponent() {
	const { user } = useAuth();

	return (
		<div className="h-screen w-full">
			<motion.div
				className="absolute top-0 left-0 h-full w-full"
				layoutId="map"
			>
				<MapComponent />
			</motion.div>
			<div className="relative h-18 bg-linear-to-t from-transparent to-black/30">
				{user && (
					<div className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white p-3 shadow-lg">
						{user.firstName?.charAt(0).toUpperCase()}
					</div>
				)}
			</div>
			<div className="absolute bottom-0 left-0 flex w-full flex-col justify-center gap-4 bg-linear-to-b from-transparent to-black/30 px-4 py-4">
				<Link to="/app/search">
					<motion.div layoutId="searchbar">
						<Button
							className="w-full text-muted-foreground shadow-lg"
							variant="inputStyle"
						>
							<SearchIcon className="h-8 w-8" /> Search for spots
						</Button>
					</motion.div>
				</Link>
				<Button className="shadow-lg" variant="primary">
					<SparklesIcon className="h-8 w-8" /> Save new spot from link
				</Button>
				<Link to="/app/my-spots">
					<motion.div layoutId="my-spots">
						<Button className="w-full shadow-lg">
							<ListIcon className="h-8 w-8" /> View all my spots
						</Button>
					</motion.div>
				</Link>
			</div>
		</div>
	);
}
