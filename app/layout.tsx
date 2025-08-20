import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata } from "next";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { fontVariables } from "@/lib/fonts";
import { cn } from "@/lib/utils";

import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { META_THEME_COLORS } from "@/lib/config";

export const metadata: Metadata = {
	title: "Findpatch",
	description: " ", // TODO: add description
	icons: {
		icon: "/findpatch.svg",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<ConvexAuthNextjsServerProvider>
			<html lang="en" suppressHydrationWarning>
				<head>
					<script
						// biome-ignore lint/security/noDangerouslySetInnerHtml: needed for theme initialization
						dangerouslySetInnerHTML={{
							__html: `
              try {
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `,
						}}
					/>
					<meta name="theme-color" content={META_THEME_COLORS.light} />
				</head>
				<body
					className={cn(
						"text-foreground group/body overscroll-none font-sans antialiased [--footer-height:calc(var(--spacing)*14)] [--header-height:calc(var(--spacing)*14)] xl:[--footer-height:calc(var(--spacing)*24)] theme-violet bg-background",
						fontVariables,
					)}
				>
					<ConvexClientProvider>
						<ThemeProvider>
							<div className="min-h-screen flex flex-col">
								<section className="theme-container flex-1">
									{children}
									<Toaster position="top-center" richColors />
								</section>
							</div>
						</ThemeProvider>
					</ConvexClientProvider>
				</body>
			</html>
		</ConvexAuthNextjsServerProvider>
	);
}
