/** biome-ignore-all lint/a11y/noStaticElementInteractions: needed for navigation */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: TODO: implement later*/
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignIn() {
	const { signIn } = useAuthActions();
	const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
	const router = useRouter();
	return (
		<div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex items-center gap-2 self-center font-medium">
					<div className="text-primary-foreground flex size-8 items-center justify-center rounded-md">
						<Image
							className="size-8"
							src="/findpatch.svg"
							alt="Findpatch logo"
							width={48}
							height={48}
						/>
					</div>
					Findpatch
				</div>
				<div className="flex flex-col gap-6">
					<Card>
						<CardHeader className="text-center">
							<CardTitle className="text-xl">Welcome back</CardTitle>
							{/* TODO: add other OAuth providers like GitHub */}
							<CardDescription>Login with your Google account</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="grid gap-6">
								<div className="flex flex-col gap-4">
									<Button
										onClick={() => void signIn("google")}
										variant="outline"
										className="w-full"
									>
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
											<title>Google</title>
											<path
												d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
												fill="currentColor"
											/>
										</svg>
										Login with Google
									</Button>
								</div>
								<div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
									<span className="bg-card text-muted-foreground relative z-10 px-2">
										Or continue with
									</span>
								</div>
								<form
									onSubmit={async (e) => {
										e.preventDefault();
										const formData = new FormData(e.target as HTMLFormElement);
										formData.set("flow", flow);

										try {
											await signIn("password", formData);
											toast.success("Logged in successfully!");
											router.push("/");
										} catch (error) {
											console.warn(error);
											toast.error("Could not login, did you mean to sign up?");
										}
									}}
								>
									<div className="grid gap-6">
										<div className="grid gap-3">
											<Label htmlFor="email">Email</Label>
											<Input
												id="email"
												type="email"
												name="email"
												placeholder="m@example.com"
												required
											/>
										</div>
										<div className="grid gap-3">
											<div className="flex items-center">
												<Label htmlFor="password">Password</Label>
												{/* TODO: implement actual forgot password functionality */}
												<div className="ml-auto text-sm underline-offset-4 hover:underline">
													Forgot your password?
												</div>
											</div>
											<Input
												id="password"
												type="password"
												name="password"
												required
											/>
										</div>
										<Button type="submit" className="w-full">
											Login
										</Button>
									</div>
								</form>
								<div className="text-center text-sm">
									{flow === "signIn"
										? "Don't have an account? "
										: "Already have an account? "}
									<span
										onClick={() =>
											setFlow(flow === "signIn" ? "signUp" : "signIn")
										}
										className="underline underline-offset-4"
									>
										{flow === "signIn" ? "Sign up instead" : "Login instead"}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
