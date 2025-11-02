import { createFileRoute, useNavigate } from "@tanstack/react-router";
import MapComponent from "../../components/Map";
import { SearchBar } from "../../components/SearchBar";

export const Route = createFileRoute("/app/")({
	component: RouteComponent,
});

function RouteComponent() {
	const navigate = useNavigate();
	return (
		<div className="relative h-screen w-full">
			<div className="absolute right-0 left-0 z-10 flex h-full w-full max-w-md items-end justify-center px-4">
				<SearchBar
					containerClassName="w-full mb-8"
					onClick={() => navigate({ to: "/app/search" })}
				/>
			</div>
			<div className="h-full w-full">
				<MapComponent />
			</div>
		</div>
	);
}
