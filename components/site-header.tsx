"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import {MainNav } from "@/components/main-nav";
import { MobileNav } from "@/components/mobile-nav";
import { ModeSwitcher } from "@/components/mode-switcher";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/config"


export function SiteHeader() {
	const router = useRouter();
	const { isAuthenticated } = useConvexAuth();
	const { signOut } = useAuthActions();

	return (
		<>
		<header className="border-grid sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
		<div className="container-wrapper">
		  <div className="container flex h-14 items-center gap-2 md:gap-4">
			<MainNav />
			<div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
			  <nav className="flex items-center gap-0.5">
				<ModeSwitcher />
			  </nav>
			</div>
		  </div>
		</div>
	  </header>
	  <MobileNav />
	  </>
		// <header className="bg-background sticky top-0 z-50 w-full">
		// 	<div className="container-wrapper 3xl:fixed:px-0 px-6">
		// 		<div className="3xl:fixed:container flex h-(--header-height) items-center gap-2 **:data-[slot=separator]:!h-4">
		// 			<MobileNav/>
		// 			<Button
		// 				asChild
		// 				variant="ghost"
		// 				className="hidden w-28 h-8 lg:flex"
		// 			>
		// 				<Link href="/">
		// 					<Icons.logo className="size-5" />
		// 					<span>{siteConfig.name}</span>
		// 				</Link>
		// 			</Button>
		// 			<MainNav items={siteConfig.navItems} className="hidden lg:flex" />
		// 			<div className="ml-auto flex items-center gap-2 md:flex-1 md:justify-end">
		// 				<ModeSwitcher />
		// 			</div>
		// 		</div>
		// 	</div>
		// </header>
		// <header className="sticky top-0 z-10 bg-background p-4 border-b-2 flex flex-row justify-between items-center">
		// 	<div className="flex items-center justify-between w-full gap-8">
		// 		<Link href="/">
		// 			<div className="flex flex-row items-center gap-2">
		// 				<div className="text-primary-foreground flex size-12 items-center justify-center rounded-md">
		// 					<Icons.logo className="size-full" />
		// 				</div>
		// 				<span className="text-2xl font-bold text-primary hidden sm:block">
		// 					Findpatch
		// 				</span>
		// 			</div>
		// 		</Link>

		// 		<div className="flex items-center gap-4">
		// 			{isAuthenticated ? (
		// 				<Button
		// 					variant="outline"
		// 					onClick={() =>
		// 						void signOut().then(() => {
		// 							router.push("/");
		// 						})
		// 					}
		// 				>
		// 					Logout
		// 				</Button>
		// 			) : (
		// 				<Button
		// 					variant="default"
		// 					size="xlg"
		// 					onClick={() => router.push("/signin")}
		// 				>
		// 					Sign Up
		// 				</Button>
		// 			)}
		// 			<ModeSwitcher />
		// 		</div>
		// 	</div>
		// </header>
	);
}
