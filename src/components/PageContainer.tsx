export function PageContainer({ children }: { children: React.ReactNode }) {
	return (
		<div className="min-h-screen bg-linear-to-b from-slate-100 via-white to-slate-200">
			{children}
		</div>
	);
}
