import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

export default function Devtools() {
	return (
		<TanStackDevtools
			config={{
				position: "bottom-right",
				requireUrlFlag: true,
				urlFlag: "devtools",
			}}
			plugins={[
				{
					name: "Tanstack Router",
					render: <TanStackRouterDevtoolsPanel />,
				},
				{
					name: "React Query",
					render: <ReactQueryDevtoolsPanel />,
				},
			]}
		/>
	);
}
