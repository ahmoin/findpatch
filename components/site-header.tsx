"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/icons";
import { ModeSwitcher } from "@/components/mode-switcher";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
	const router = useRouter();
	const { isAuthenticated } = useConvexAuth();
	const { signOut } = useAuthActions();

	return (
		<header className="sticky top-0 z-10 bg-background p-4 border-b-2 flex flex-row justify-between items-center">
			<div className="flex items-center justify-between w-full gap-8">
				<Link href="/">
					<div className="flex flex-row items-center gap-2">
						<div className="text-primary-foreground flex size-12 items-center justify-center rounded-md">
							<Icons.logo className="size-full" />
						</div>
						<span className="text-2xl font-bold text-primary hidden sm:block">
							Findpatch
						</span>
					</div>
				</Link>

				<div className="flex items-center gap-4">
					{isAuthenticated ? (
						<Button
							variant="outline"
							onClick={() =>
								void signOut().then(() => {
									router.push("/");
								})
							}
						>
							Logout
						</Button>
					) : (
						<Button
							variant="default"
							size="xlg"
							onClick={() => router.push("/signin")}
						>
							Sign Up
						</Button>
					)}
					<ModeSwitcher />
				</div>
			</div>
		</header>
	);
}
