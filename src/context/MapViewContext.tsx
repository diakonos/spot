// biome-ignore lint/style/useFilenamingConvention: Shared context keeps PascalCase to mirror component imports.
import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useContext,
	useMemo,
	useState,
} from "react";
import type { MapMode } from "@/components/Map";

export type MapHighlight = {
	providerPlaceId: string;
	placeId?: string;
	name?: string;
};

type MapViewState = {
	mode: MapMode;
	setMode: Dispatch<SetStateAction<MapMode>>;
	highlight: MapHighlight | null;
	setHighlight: Dispatch<SetStateAction<MapHighlight | null>>;
};

const MapViewStateContext = createContext<MapViewState | undefined>(undefined);

export function MapViewStateProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [mode, setMode] = useState<MapMode>("all");
	const [highlight, setHighlight] = useState<MapHighlight | null>(null);

	const value = useMemo(
		() => ({ mode, setMode, highlight, setHighlight }),
		[mode, highlight]
	);

	return (
		<MapViewStateContext.Provider value={value}>
			{children}
		</MapViewStateContext.Provider>
	);
}

export function useMapViewState() {
	const context = useContext(MapViewStateContext);
	if (!context) {
		throw new Error("useMapViewState must be used within MapViewStateProvider");
	}
	return context;
}
