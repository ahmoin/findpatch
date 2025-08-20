import Link from "next/link";

export function SiteFooter() {
	return (
		<footer className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
				<div className="text-center text-sm text-muted-foreground">
					Made by{" "}
					<Link
						href="https://ahmoin.com"
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium text-foreground hover:text-primary transition-colors"
					>
						Ahsan Moin (@ahmoin)
					</Link>
				</div>
			</div>
		</footer>
	);
}
