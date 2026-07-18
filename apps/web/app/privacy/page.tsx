import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Privacy Policy — Hoplio",
	description:
		"How Hoplio handles account data, messages, device permissions, and third-party services.",
};

export default function PrivacyPolicyPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="border-b border-border/50">
				<div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
					<Link
						href="/"
						className="text-sm font-heading font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent"
					>
						hoplio
					</Link>
					<Link
						href="/"
						className="text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						Back to home
					</Link>
				</div>
			</header>

			<main className="max-w-3xl mx-auto px-6 py-12 md:py-16">
				<p className="text-sm text-muted-foreground mb-3">Legal</p>
				<h1 className="text-3xl md:text-4xl font-bold font-heading tracking-tight mb-2">
					Privacy Policy
				</h1>
				<p className="text-sm text-muted-foreground mb-10">
					Last updated: July 18, 2026
				</p>

				<div className="space-y-10 text-[15px] leading-relaxed text-foreground/90">
					<section className="space-y-3">
						<h2 className="text-xl font-semibold font-heading text-foreground">
							Overview
						</h2>
						<p>
							Hoplio (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is a
							messaging application. This policy describes how we handle
							information and which permissions the app uses on your device.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-xl font-semibold font-heading text-foreground">
							Permissions We Use
						</h2>
						<h3 className="text-base font-semibold text-foreground">
							Photos and files
						</h3>
						<p>The app may request access to photos or files on your device so you can:</p>
						<ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
							<li>Choose attachments from your library or file storage</li>
							<li>Update your profile picture</li>
						</ul>
						<p>
							We only access photos or files when you choose them from inside the
							app.
						</p>
						<h3 className="text-base font-semibold text-foreground pt-2">
							Other permissions
						</h3>
						<ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
							<li>
								<strong className="text-foreground">Internet / network</strong> —
								To send and receive messages and sync data
							</li>
							<li>
								<strong className="text-foreground">Storage (photos/files)</strong>{" "}
								— To attach and send files from your device
							</li>
							<li>
								<strong className="text-foreground">Network state</strong> — To
								detect connectivity and support offline use
							</li>
							<li>
								<strong className="text-foreground">Notifications</strong> — To
								alert you about new messages when you enable push notifications
							</li>
						</ul>
					</section>

					<section className="space-y-3">
						<h2 className="text-xl font-semibold font-heading text-foreground">
							Data We Collect and Use
						</h2>
						<ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
							<li>
								<strong className="text-foreground">Account data</strong> — Email,
								name, and profile photo you provide through sign-in or profile
								updates
							</li>
							<li>
								<strong className="text-foreground">Messages and content</strong> —
								Messages, images, and files you send through the app, stored to
								provide the service
							</li>
							<li>
								<strong className="text-foreground">Device and technical data</strong>{" "}
								— May include identifiers and crash or usage data for stability and
								improvements, depending on the services we use
							</li>
						</ul>
						<p>
							We use this data to operate the app, deliver messages, and improve the
							service. We do not sell your personal data.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-xl font-semibold font-heading text-foreground">
							Third-Party Services
						</h2>
						<p>The app may use services such as:</p>
						<ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
							<li>
								<strong className="text-foreground">Firebase</strong> —
								Authentication and backend
							</li>
							<li>
								<strong className="text-foreground">Google Sign-In</strong> — For
								signing in with your Google account
							</li>
							<li>
								<strong className="text-foreground">Firebase Cloud Messaging</strong>{" "}
								— Push notification delivery when enabled
							</li>
						</ul>
						<p>
							Their privacy policies apply to data they process on our behalf.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-xl font-semibold font-heading text-foreground">
							Your Choices
						</h2>
						<ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
							<li>You can turn off app permissions in your device settings</li>
							<li>
								You can delete your account or request data deletion by contacting
								us
							</li>
						</ul>
					</section>

					<section className="space-y-3">
						<h2 className="text-xl font-semibold font-heading text-foreground">
							Changes
						</h2>
						<p>
							We may update this policy. We will post the updated version and, where
							required, notify you through the app or store listing.
						</p>
					</section>

					<section className="space-y-3">
						<h2 className="text-xl font-semibold font-heading text-foreground">
							Contact
						</h2>
						<p>
							For privacy questions or to request access or deletion of your data,
							contact:
						</p>
						<p>
							<a
								href="mailto:anirudh.makuluri@gmail.com"
								className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
							>
								anirudh.makuluri@gmail.com
							</a>
						</p>
					</section>
				</div>
			</main>
		</div>
	);
}
