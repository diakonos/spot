import { useEffect, useState } from "react";

const GEOLOCATION_OPTIONS: PositionOptions = {
	enableHighAccuracy: true,
	timeout: 15_000,
	maximumAge: 60_000,
};

export type UserLocation = {
	lat: number;
	lng: number;
	accuracy?: number;
};

export type UseUserLocationResult = {
	location: UserLocation | null;
	isLoading: boolean;
	error: string | null;
	isSupported: boolean;
};

export function useUserLocation(): UseUserLocationResult {
	const [location, setLocation] = useState<UserLocation | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isSupported, setIsSupported] = useState(true);

	useEffect(() => {
		let cancelled = false;

		if (typeof window === "undefined" || !("geolocation" in navigator)) {
			setIsSupported(false);
			setIsLoading(false);
			return () => {
				cancelled = true;
			};
		}

		setIsSupported(true);
		setIsLoading(true);
		navigator.geolocation.getCurrentPosition(
			(position) => {
				if (cancelled) {
					return;
				}
				setLocation({
					lat: position.coords.latitude,
					lng: position.coords.longitude,
					accuracy: position.coords.accuracy,
				});
				setError(null);
				setIsLoading(false);
			},
			(geoError) => {
				if (cancelled) {
					return;
				}
				setError(geoError.message);
				setIsLoading(false);
			},
			GEOLOCATION_OPTIONS
		);

		return () => {
			cancelled = true;
		};
	}, []);

	return {
		location,
		isLoading,
		error,
		isSupported,
	};
}
