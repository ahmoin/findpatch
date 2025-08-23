"use client";

import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

export function MobileNav() {
	const isMobile = useIsMobile();

	return (
		<Drawer modal={false} open={isMobile}>
			<DrawerTitle className="hidden">Navigation</DrawerTitle>
			<DrawerTrigger asChild>
				<Button
					variant="ghost"
					className="size-8 gap-4 px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
						strokeWidth="1.5"
						stroke="currentColor"
						className="!size-6"
					>
						<title>Toggle Menu</title>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M3.75 9h16.5m-16.5 6.75h16.5"
						/>
					</svg>
					<span className="sr-only">Toggle Menu</span>
				</Button>
			</DrawerTrigger>
			<DrawerContent className="max-h-[80svh] p-0">
				<div className="overflow-auto p-6">
					<div className="flex flex-col space-y-3">nav items here</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
