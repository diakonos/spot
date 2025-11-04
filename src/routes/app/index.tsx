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
			<div className="h-full w-full">
				<MapComponent />
			</div>
			<div className="absolute bottom-0 left-0 flex w-full justify-center bg-linear-to-b from-transparent to-black/30 px-4 pt-4">
				<SearchBar
					containerClassName="w-full mb-8 max-w-md"
					onClick={() => navigate({ to: "/app/search" })}
				/>
			</div>
		</div>
	);
}
