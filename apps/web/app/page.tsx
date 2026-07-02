"use client"
import firebase from "firebase/compat/app";
import "firebase/compat/auth"
import { useRouter } from 'next/navigation';
import { config } from "@/lib/config";
import { useUser } from "@/app/providers";
import { Button } from "@/components/ui/button";
import {
	Shield, Users, ArrowRight, Globe, Lock, Bot,
	Search, Clock, Radio, Wifi, Check,
	ChevronDown, Menu, X
} from "lucide-react";
import { useEffect, useRef, useState, useCallback } from "react";

firebase.initializeApp(config.firebaseConfig)
const provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" })

const MESH_NODES = [
	{ x: 20, y: 20 }, { x: 45, y: 12 }, { x: 70, y: 22 }, { x: 88, y: 15 },
	{ x: 12, y: 45 }, { x: 38, y: 42 }, { x: 62, y: 38 }, { x: 82, y: 45 },
	{ x: 25, y: 68 }, { x: 50, y: 65 }, { x: 75, y: 70 }, { x: 55, y: 88 },
];

const MESH_EDGES: [number, number][] = [
	[0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 6], [3, 7],
	[4, 5], [5, 6], [6, 7], [4, 8], [5, 9], [6, 10], [7, 10],
	[8, 9], [9, 10], [9, 11], [8, 11],
];

const GATEWAY_NODE = 6;

function useInView(threshold = 0.15) {
	const ref = useRef<HTMLDivElement | null>(null);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const obs = new IntersectionObserver(
			([entry]) => { if (entry!.isIntersecting) setInView(true); },
			{ threshold }
		);
		obs.observe(el);
		return () => obs.disconnect();
	}, [threshold]);

	return [ref, inView] as const;
}

function MeshNetwork({ className }: { className?: string }) {
	return (
		<svg className={className} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
			<defs>
				<radialGradient id="glow" cx="50%" cy="50%" r="50%">
					<stop offset="0%" stopColor="hsl(195, 85%, 55%)" stopOpacity="0.5" />
					<stop offset="100%" stopColor="hsl(195, 85%, 55%)" stopOpacity="0" />
				</radialGradient>
				<radialGradient id="gwGlow" cx="50%" cy="50%" r="50%">
					<stop offset="0%" stopColor="hsl(160, 80%, 50%)" stopOpacity="0.7" />
					<stop offset="100%" stopColor="hsl(160, 80%, 50%)" stopOpacity="0" />
				</radialGradient>
			</defs>

			{MESH_EDGES.map(([a, b], i) => (
				<line key={`e${i}`}
					x1={MESH_NODES[a]!.x} y1={MESH_NODES[a]!.y}
					x2={MESH_NODES[b]!.x} y2={MESH_NODES[b]!.y}
					stroke="hsl(195, 85%, 55%)" strokeWidth="0.18" opacity="0.12">
					<animate attributeName="opacity" values="0.08;0.28;0.08"
						dur={`${3 + (i % 5) * 0.7}s`} begin={`${i * 0.15}s`} repeatCount="indefinite" />
				</line>
			))}

			{MESH_EDGES.slice(0, 10).map(([a, b], i) => (
				<circle key={`p${i}`} r="0.3" fill="hsl(195, 85%, 65%)" opacity="0">
					<animateMotion dur={`${2.5 + i * 0.3}s`} begin={`${i * 0.5}s`} repeatCount="indefinite"
						path={`M${MESH_NODES[a]!.x},${MESH_NODES[a]!.y} L${MESH_NODES[b]!.x},${MESH_NODES[b]!.y}`} />
					<animate attributeName="opacity" values="0;0.6;0"
						dur={`${2.5 + i * 0.3}s`} begin={`${i * 0.5}s`} repeatCount="indefinite" />
				</circle>
			))}

			{MESH_NODES.map((n, i) => (
				<g key={`n${i}`}>
					<circle cx={n.x} cy={n.y}
						r={i === GATEWAY_NODE ? "2.2" : "1.3"}
						fill={i === GATEWAY_NODE ? "url(#gwGlow)" : "url(#glow)"}>
						<animate attributeName="r"
							values={i === GATEWAY_NODE ? "2;3.2;2" : "1;1.6;1"}
							dur={`${3 + i * 0.15}s`} repeatCount="indefinite" />
					</circle>
					<circle cx={n.x} cy={n.y} r="0.45"
						fill={i === GATEWAY_NODE ? "hsl(160, 80%, 50%)" : "hsl(195, 85%, 55%)"} />
				</g>
			))}

			<circle cx={MESH_NODES[GATEWAY_NODE]!.x} cy={MESH_NODES[GATEWAY_NODE]!.y}
				r="2.5" fill="none" stroke="hsl(160, 80%, 50%)" strokeWidth="0.12" opacity="0.3">
				<animate attributeName="r" values="2;4;2" dur="3.5s" repeatCount="indefinite" />
				<animate attributeName="opacity" values="0.3;0.05;0.3" dur="3.5s" repeatCount="indefinite" />
			</circle>
		</svg>
	);
}

const FEATURES = [
	{
		icon: Lock,
		title: "End-to-End Encrypted",
		desc: "Every message is encrypted on your device before it leaves. Not even we can read your conversations.",
		iconColor: "text-cyan-500",
		iconBg: "bg-cyan-500/10",
	},
	{
		icon: Bot,
		title: "AI Assistant",
		desc: "Built-in AI that helps you draft messages, summarize long threads, and generate contextual smart replies.",
		iconColor: "text-blue-500",
		iconBg: "bg-blue-500/10",
	},
	{
		icon: Users,
		title: "Group Conversations",
		desc: "Create rooms, manage members, assign roles, and collaborate with your people securely.",
		iconColor: "text-indigo-500",
		iconBg: "bg-indigo-500/10",
	},
	{
		icon: Search,
		title: "Semantic Search",
		desc: "Find messages by meaning, not just keywords. Ask natural questions about your entire chat history.",
		iconColor: "text-cyan-500",
		iconBg: "bg-cyan-500/10",
	},
	{
		icon: Clock,
		title: "Scheduled Messages",
		desc: "Compose now, deliver later. Perfect for different time zones and asynchronous teams.",
		iconColor: "text-blue-500",
		iconBg: "bg-blue-500/10",
	},
	{
		icon: Shield,
		title: "Cross-Platform",
		desc: "Web and mobile with full feature parity. Your experience stays consistent everywhere you go.",
		iconColor: "text-indigo-500",
		iconBg: "bg-indigo-500/10",
	},
];

const ROADMAP = [
	{ label: "Secure Chat Platform", status: "done" as const, desc: "Real-time messaging with groups, reactions, edits, and file sharing." },
	{ label: "End-to-End Encryption", status: "done" as const, desc: "Device-level encryption across web and mobile clients." },
	{ label: "AI Intelligence Layer", status: "done" as const, desc: "AI assistant, smart replies, and semantic search integrated natively." },
	{ label: "Mesh Networking Protocol", status: "active" as const, desc: "Peer-to-peer device discovery and local mesh formation." },
	{ label: "Internet Sharing via Mesh", status: "planned" as const, desc: "Route internet traffic through mesh-connected gateway devices." },
	{ label: "Offline-First Architecture", status: "planned" as const, desc: "Full functionality without any internet connection within the mesh." },
];

export default function Home() {
	const router = useRouter();
	const { user } = useUser();
	const [scrolled, setScrolled] = useState(false);
	const [mobileMenu, setMobileMenu] = useState(false);

	const [heroRef, heroInView] = useInView(0.1);
	const [visionRef, visionInView] = useInView();
	const [featuresRef, featuresInView] = useInView();
	const [roadmapRef, roadmapInView] = useInView();

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 20);
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const navigate = useCallback(() => {
		router.push(user ? "/home" : "/auth");
	}, [user, router]);

	const scrollTo = useCallback((id: string) => {
		document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
		setMobileMenu(false);
	}, []);

	return (
		<div className="relative min-h-screen bg-background text-foreground overflow-x-hidden">

			{/* ── Navbar ── */}
			<nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
				? "bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm"
				: "bg-transparent"
				}`}>
				<div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
					<span className="text-xl font-bold font-heading bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent select-none">
						hoplio
					</span>

					<div className="hidden md:flex items-center gap-8">
						{(["vision", "features", "roadmap"] as const).map((id) => (
							<button key={id} onClick={() => scrollTo(id)}
								className="text-sm text-muted-foreground hover:text-foreground transition-colors capitalize">
								{id}
							</button>
						))}
						<Button onClick={navigate} size="sm"
							className="bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-medium rounded-lg">
							{user ? "Open App" : "Get Started"}
						</Button>
					</div>

					<button className="md:hidden p-2 text-foreground" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Menu">
						{mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
					</button>
				</div>

				{mobileMenu && (
					<div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border px-6 py-4 flex flex-col gap-3 animate-slide-up">
						{(["vision", "features", "roadmap"] as const).map((id) => (
							<button key={id} onClick={() => scrollTo(id)}
								className="text-sm text-left text-muted-foreground hover:text-foreground capitalize">
								{id}
							</button>
						))}
						<Button onClick={navigate} size="sm"
							className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-medium rounded-lg">
							{user ? "Open App" : "Get Started"}
						</Button>
					</div>
				)}
			</nav>

			{/* ── Hero ── */}
			<section ref={heroRef} className="relative min-h-screen flex items-center justify-center pt-16">
				<div className="absolute inset-0">
					<MeshNetwork className="absolute inset-0 w-full h-full opacity-40 dark:opacity-20" />
					<div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />
					<div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(600px,90vw)] aspect-square bg-cyan-500/8 rounded-full blur-[120px]" />
				</div>

				<div className={`relative z-10 max-w-4xl mx-auto px-6 text-center transition-all duration-1000 ${heroInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
					}`}>
					<div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-sm font-medium">
						<Radio className="w-3.5 h-3.5" />
						Mesh networking — actively building
					</div>

					<h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold font-heading leading-[1.05] mb-6 tracking-tight">
						One connection.{" "}
						<span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
							Everyone online.
						</span>
					</h1>

					<p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
						Hoplio is building a peer-to-peer mesh network where a single device
						with internet keeps the entire network connected. End-to-end encrypted,
						AI-powered, and designed for a world where connectivity shouldn&apos;t be
						a privilege.
					</p>

					<div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
						<Button onClick={navigate} size="lg"
							className="px-8 py-6 text-base font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-900 rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-[1.02]">
							{user ? "Continue to Chat" : "Get Started"}
							<ArrowRight className="w-4 h-4 ml-2" />
						</Button>
						<Button onClick={() => scrollTo("vision")} variant="ghost" size="lg"
							className="px-8 py-6 text-base text-muted-foreground hover:text-foreground rounded-xl">
							Learn more
							<ChevronDown className="w-4 h-4 ml-2" />
						</Button>
					</div>
				</div>
			</section>

			{/* ── Vision: How Mesh Works ── */}
			<section id="vision" ref={visionRef} className="relative py-24 md:py-32 px-6">
				<div className={`max-w-6xl mx-auto transition-all duration-1000 delay-100 ${visionInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
					}`}>
					<div className="text-center mb-16 md:mb-20">
						<p className="text-sm font-medium text-cyan-500 dark:text-cyan-400 uppercase tracking-widest mb-4">
							The Vision
						</p>
						<h2 className="text-3xl md:text-5xl font-bold font-heading mb-6">
							Internet for the mesh, by the mesh
						</h2>
						<p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
							Traditional apps die when you lose connectivity. Hoplio is different —
							devices form a local mesh, and when any single device finds internet,
							it shares that connection with everyone.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-12">
						<div className="relative text-center group">
							<div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors duration-300">
								<Radio className="w-7 h-7 text-cyan-500" />
							</div>
							<div className="text-xs font-mono text-cyan-500/70 mb-2">01</div>
							<h3 className="text-xl font-bold font-heading mb-3">Form the mesh</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Nearby devices discover each other and create a peer-to-peer mesh
								network. No central server required for local communication.
							</p>
							<div className="hidden md:block absolute top-8 -right-3 lg:-right-6 w-6 lg:w-12 border-t border-dashed border-cyan-500/30" />
						</div>

						<div className="relative text-center group">
							<div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors duration-300">
								<Globe className="w-7 h-7 text-blue-500" />
							</div>
							<div className="text-xs font-mono text-blue-500/70 mb-2">02</div>
							<h3 className="text-xl font-bold font-heading mb-3">One finds internet</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Any device in the mesh with internet access becomes the gateway,
								routing traffic for the entire network automatically.
							</p>
							<div className="hidden md:block absolute top-8 -right-3 lg:-right-6 w-6 lg:w-12 border-t border-dashed border-blue-500/30" />
						</div>

						<div className="text-center group">
							<div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors duration-300">
								<Wifi className="w-7 h-7 text-indigo-500" />
							</div>
							<div className="text-xs font-mono text-indigo-500/70 mb-2">03</div>
							<h3 className="text-xl font-bold font-heading mb-3">Everyone&apos;s online</h3>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Internet access propagates through the mesh. Every connected device
								can chat, browse, and sync — through a single shared connection.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* ── Features: What's Built Today ── */}
			<section id="features" ref={featuresRef} className="relative py-24 md:py-32 px-6 bg-muted/30">
				<div className={`max-w-6xl mx-auto transition-all duration-1000 delay-100 ${featuresInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
					}`}>
					<div className="text-center mb-16 md:mb-20">
						<p className="text-sm font-medium text-cyan-500 dark:text-cyan-400 uppercase tracking-widest mb-4">
							Built Today
						</p>
						<h2 className="text-3xl md:text-5xl font-bold font-heading mb-6">
							The foundation is already solid
						</h2>
						<p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
							While we build toward full mesh networking, Hoplio already ships a
							private, intelligent chat platform with the features that matter.
						</p>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
						{FEATURES.map((f, i) => (
							<div key={i}
								className="p-6 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group">
								<div className={`w-10 h-10 mb-4 rounded-lg ${f.iconBg} flex items-center justify-center`}>
									<f.icon className={`w-5 h-5 ${f.iconColor}`} />
								</div>
								<h3 className="text-lg font-semibold font-heading mb-2">{f.title}</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ── Roadmap ── */}
			<section id="roadmap" ref={roadmapRef} className="relative py-24 md:py-32 px-6">
				<div className={`max-w-3xl mx-auto transition-all duration-1000 delay-100 ${roadmapInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
					}`}>
					<div className="text-center mb-16">
						<p className="text-sm font-medium text-cyan-500 dark:text-cyan-400 uppercase tracking-widest mb-4">
							Roadmap
						</p>
						<h2 className="text-3xl md:text-5xl font-bold font-heading mb-6">
							Where we&apos;re headed
						</h2>
						<p className="text-muted-foreground max-w-xl mx-auto text-lg leading-relaxed">
							Every milestone brings us closer to a world where losing your
							internet doesn&apos;t mean losing your connection.
						</p>
					</div>

					<div className="relative">
						<div className="absolute left-[23px] top-2 bottom-2 w-px bg-gradient-to-b from-cyan-500/50 via-blue-500/50 to-transparent" />

						{ROADMAP.map((item, i) => (
							<div key={i} className="relative pl-16 pb-10 last:pb-0">
								<div className={`absolute left-3.5 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center ${item.status === "done"
									? "bg-cyan-500 border-cyan-500"
									: item.status === "active"
										? "bg-blue-500 border-blue-500 animate-pulse"
										: "bg-background border-muted-foreground/30"
									}`}>
									{item.status === "done" && <Check className="w-3 h-3 text-slate-900" />}
								</div>

								<div>
									<div className="flex flex-wrap items-center gap-3 mb-1.5">
										<h3 className="font-semibold font-heading text-[15px]">{item.label}</h3>
										<span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${item.status === "done"
											? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
											: item.status === "active"
												? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
												: "bg-muted text-muted-foreground"
											}`}>
											{item.status === "done" ? "Complete" : item.status === "active" ? "In Progress" : "Planned"}
										</span>
									</div>
									<p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* ── Final CTA ── */}
			<section className="relative py-24 md:py-32 px-6">
				<div className="absolute inset-0 overflow-hidden pointer-events-none">
					<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(500px,80vw)] aspect-square bg-cyan-500/5 rounded-full blur-[100px]" />
				</div>
				<div className="relative max-w-2xl mx-auto text-center">
					<h2 className="text-3xl md:text-5xl font-bold font-heading mb-6">
						Join us in building<br className="hidden sm:block" /> the mesh.
					</h2>
					<p className="text-muted-foreground text-lg mb-10 leading-relaxed">
						Hoplio is open and evolving. Start chatting today and be part of the
						network when mesh goes live.
					</p>
					<Button onClick={navigate} size="lg"
						className="px-10 py-6 text-base font-semibold bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-900 rounded-xl shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300 hover:scale-[1.02]">
						{user ? "Open Hoplio" : "Get Started Free"}
						<ArrowRight className="w-4 h-4 ml-2" />
					</Button>
				</div>
			</section>

			{/* ── Footer ── */}
			<footer className="border-t border-border/50 py-8 px-6">
				<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
					<span className="text-sm font-heading font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent select-none">
						hoplio
					</span>
					<p className="text-sm text-muted-foreground">
						Building connectivity that doesn&apos;t quit.
					</p>
				</div>
			</footer>
		</div>
	);
}
