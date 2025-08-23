"use client";

import { MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

export function MobileNav() {
	const isMobile = useIsMobile();

	return (
		<Drawer modal={false} open={isMobile}>
			<DrawerTitle className="hidden">Navigation</DrawerTitle>
			<DrawerContent className="max-h-[80svh] p-0">
				<div className="overflow-auto p-6">
					<div className="flex flex-col space-y-3">
						<div className="flex flex-col items-center space-y-2">
							<Button
								variant="ghost"
								size="icon"
								className="size-12 flex flex-col"
							>
								<MapIcon className="size-6 -mb-2" />
								<span className="text-xs text-muted-foreground">Map</span>
							</Button>
						</div>
					</div>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
