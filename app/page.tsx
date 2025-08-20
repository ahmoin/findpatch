"use client";

import { SiteHeader } from "@/components/site-header";

export default function Home() {
	return (
		<div className="min-h-screen bg-background">
			<SiteHeader />

			<main className="flex flex-col h-[calc(100vh-8rem)]">
				<div className="flex-1 relative overflow-hidden">test</div>
			</main>
		</div>
	);
}
