"use client"
import { Button } from "@/components/ui/button";
import firebase from "firebase/compat/app";
import "firebase/compat/auth"
import "firebase/compat/auth"
import { config } from "@/lib/config";
import { useRouter } from 'next/navigation';
import { useUser } from "../providers";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import { Separator } from "@radix-ui/react-dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import Image from 'next/image'
import { customFetch } from "@/lib/utils";
import LoadingScreen from "@/components/LoadingScreen";
import { ArrowRight, Loader2, Radio } from 'lucide-react'

firebase.initializeApp(config.firebaseConfig)
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.NONE);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" })

export default function Page() {
	const { toast } = useToast();
	const { user, isLoading, login } = useUser();
	const router = useRouter();

	const [isSignIn, setSignIn] = useState(true);
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const showLoadingScreen = useMemo(() => isLoading || isAuthenticating, [isAuthenticating, isLoading]);

	useEffect(() => {
		if(user && !isLoading) {
			router.replace('/home');
		}
	}, [user, isLoading, router])

	async function authWithGoogle() {
		try {
			setIsAuthenticating(true);
			const { user } = await auth.signInWithPopup(provider);
			setSession(user);
		} catch (error) {
			console.error(error);
			toast({
				title: "Error occured while trying to authenticate using google"
			})
		}
	}

	async function authWithEmailAndPassword() {
		if (email == null || email.trim() == "" || password == null || password.trim() == "") {
			toast({
				title: "Email or Password not given"
			})
			return;
		}

		try {
			setIsAuthenticating(true);
			if (isSignIn) {
				const { user } = await firebase.auth().signInWithEmailAndPassword(email, password)
				setSession(user);
			} else {
				const { user } = await firebase.auth().createUserWithEmailAndPassword(email, password);
				setSession(user);
			}
		} catch (error: any) {
			const errorCode = error.code;
			let errorMessage = error.message;

			switch (errorCode) {
				case "auth/email-already-in-use":
					errorMessage = "The email address is already in use by another account.";
					break;
				case "auth/invalid-email":
					errorMessage = "The email address is invalid.";
					break;
				case "auth/weak-password":
					errorMessage = "The password is too weak.";
					break;
				case "auth/invalid-credential":
					errorMessage = "Account not found";
					break;
				default:
					break;
			}

			toast({
				title: errorMessage,
				variant: 'destructive'
			})
			setIsAuthenticating(false);
		}
	}

	async function setSession(user: firebase.User | null) {
		if (!user) throw "User not found";

		const idToken = await user?.getIdToken();

		customFetch({
			pathName: 'session',
			method: 'POST',
			body: { idToken }
		}).then(() => {
			auth.signOut();
			login();
		})
	}

	return (
		<div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden p-3 sm:p-4 lg:p-6">
			<div className="pointer-events-none absolute inset-0 overflow-hidden">
				<div className="absolute left-[-5rem] top-[-6rem] h-72 w-72 rounded-full bg-cyan-400/18 blur-[120px]" />
				<div className="absolute right-[-8rem] top-1/3 h-96 w-96 rounded-full bg-blue-400/16 blur-[150px]" />
				<div className="absolute bottom-[-8rem] left-1/3 h-80 w-80 rounded-full bg-indigo-400/12 blur-[140px]" />
			</div>
			<div className="relative mx-auto flex w-full max-w-5xl items-center justify-center">
				{showLoadingScreen && <LoadingScreen/>}
				<Card className="app-panel grid w-full max-w-[980px] max-h-[calc(100dvh-1.5rem)] overflow-hidden border-0 p-0 sm:max-h-[calc(100dvh-2rem)] lg:max-h-[calc(100dvh-3rem)] lg:grid-cols-[1.04fr_0.96fr]">
					<div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-8 text-white lg:flex xl:p-10">
						<div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-r from-transparent via-cyan-300/6 to-cyan-200/10 blur-md" />
						<div className="pointer-events-none absolute inset-y-8 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
						<div>
							<div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-1.5 text-sm font-medium text-cyan-200">
								<Radio className="h-3.5 w-3.5" />
								Mesh networking, built into chat
							</div>
							<h1 className="mt-6 font-heading text-4xl font-bold leading-tight xl:mt-8 xl:text-5xl">
								One connection.
								<br />
								<span className="bg-gradient-to-r from-cyan-300 via-blue-300 to-indigo-300 bg-clip-text text-transparent">
									Everyone online.
								</span>
							</h1>
							<p className="mt-5 max-w-md text-sm leading-6 text-slate-300 xl:mt-6 xl:text-base xl:leading-7">
								Secure chat, AI assistance, and the first step toward a peer-to-peer mesh network that keeps people connected.
							</p>
						</div>
						<p className="max-w-sm text-sm leading-6 text-slate-400">
							Sign {isSignIn ? 'in' : 'up'} to continue into the app and pick up your conversations where you left off.
						</p>
					</div>
					<div className="relative overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_32%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.94))] p-5 text-slate-100 sm:p-7 lg:p-8">
						<div className="pointer-events-none absolute inset-0">
							<div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent" />
							<div className="absolute inset-y-0 right-0 w-px bg-white/5" />
							<div className="absolute bottom-10 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />
						</div>
						<div className="relative mx-auto flex w-full max-w-[372px] flex-col justify-center lg:min-h-[620px]">
							<CardHeader className="flex flex-col items-center justify-center space-y-2.5 px-0 pt-0">
								<div className="inline-flex items-center rounded-full border border-cyan-400/35 bg-cyan-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-200">
									Welcome to Hoplio
								</div>
								<CardTitle className="app-gradient-text text-center text-3xl font-semibold tracking-tight sm:text-4xl">Hoplio</CardTitle>
								<CardDescription className="max-w-sm text-center text-sm text-slate-300 sm:text-base">Sign {isSignIn ? 'in' : 'up'} to supercharge your conversations</CardDescription>
							</CardHeader>
							<CardContent className="my-6 flex flex-col items-center space-y-3.5 px-0 sm:my-7">
								<Button onClick={authWithGoogle} disabled={isAuthenticating} className="h-11 w-full gap-2 rounded-2xl border border-white/12 bg-white/8 text-slate-100 shadow-[0_18px_40px_-24px_rgba(8,47,73,0.8)] hover:bg-white/12 sm:h-12" variant='outline'>
									{isAuthenticating ? <Loader2 className="h-4 w-4 animate-spin"/> : (
										<Image
											className="rounded-full"
											src={'/google_logo.webp'}
											width={20}
											height={20}
											alt="Google logo"
										/>
									)}
									<span>{isSignIn ? "Continue" : "Sign Up"} With Google</span>
								</Button>
								<div className="flex w-full items-center justify-center space-x-3 overflow-hidden rounded-xl">
									<Separator className="h-[1px] w-1/2 bg-gradient-to-r from-transparent via-cyan-300/60 to-cyan-300/20" />
									<p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 sm:text-sm">or</p>
									<Separator className="h-[1px] w-1/2 bg-gradient-to-l from-transparent via-cyan-300/60 to-cyan-300/20" />
								</div>
								<Input disabled={isAuthenticating} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter Email" className="h-12 rounded-2xl border-white/10 bg-white/6 px-4 text-sm text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-[3.25rem] sm:text-base" />
								<Input disabled={isAuthenticating} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter Password" className="h-12 rounded-2xl border-white/10 bg-white/6 px-4 text-sm text-white placeholder:text-slate-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-[3.25rem] sm:text-base" />
								<Button disabled={isAuthenticating} onClick={authWithEmailAndPassword} className="h-12 w-full rounded-2xl text-sm font-semibold shadow-[0_20px_50px_-22px_rgba(34,211,238,0.55)] sm:h-[3.25rem] sm:text-base">
									{isAuthenticating ? (
										<>
											<Loader2 className="mr-2 h-4 w-4 animate-spin"/>
											Processing...
										</>
									) : (
										<>
											<span>{isSignIn ? "Continue" : "Sign Up"}</span>
											<ArrowRight className="ml-2 h-4 w-4" />
										</>
									)}
								</Button>
								<p className="max-w-[320px] text-center text-xs leading-5 text-slate-400 sm:leading-6">By continuing, you agree to our Terms and Privacy Policy.</p>
							</CardContent>
							<CardFooter className="flex flex-row items-center justify-center space-x-2 px-0 pb-0 pt-1 sm:pt-2">
								<i className="text-center text-[12px] text-slate-400">{isSignIn ? "Don't have an account?" : "Already have an account?"}</i>
								<Button onClick={() => setSignIn(prevState => !prevState)} variant='link' className="p-0 text-cyan-300 hover:text-cyan-200">{isSignIn ? "Create account" : "Sign in"}</Button>
							</CardFooter>
						</div>
					</div>
				</Card>
			</div>
		</div>
	)
}
