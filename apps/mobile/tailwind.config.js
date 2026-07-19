/** @type {import('tailwindcss').Config} */
module.exports = {
	// NOTE: Update this to include the paths to all of your component files.
	content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
	presets: [require("nativewind/preset")],
	theme: {
		container: {
			center: true,
			padding: "2rem",
			screens: {
				"2xl": "1400px",
			},
		},
		extend: {
			colors: {
				/* Duolingo-inspired fun theme (mobile) */
				border: "#E5E5E5",
				input: "#E5E5E5",
				ring: "#58CC02",
				background: "#F7F7F7",
				foreground: "#3C3C3C",
				primary: {
					DEFAULT: "#58CC02",
					foreground: "#ffffff",
				},
				secondary: {
					DEFAULT: "#FFC800",
					foreground: "#3C3C3C",
				},
				destructive: {
					DEFAULT: "#FF4B4B",
					foreground: "#ffffff",
				},
				muted: {
					DEFAULT: "#F0F0F0",
					foreground: "#777777",
				},
				accent: {
					DEFAULT: "#FFC800",
					foreground: "#3C3C3C",
				},
				popover: {
					DEFAULT: "hsl(var(--popover))",
					foreground: "hsl(var(--popover-foreground))",
				},
				card: {
					DEFAULT: "hsl(var(--card))",
					foreground: "hsl(var(--card-foreground))",
				},
			},
			borderRadius: {
				lg: "var(--radius)",
				md: "calc(var(--radius) - 2px)",
				sm: "calc(var(--radius) - 4px)",
			},
			keyframes: {
				"accordion-down": {
					from: { height: "0" },
					to: { height: "var(--radix-accordion-content-height)" },
				},
				"accordion-up": {
					from: { height: "var(--radix-accordion-content-height)" },
					to: { height: "0" },
				},
			},
			animation: {
				"accordion-down": "accordion-down 0.2s ease-out",
				"accordion-up": "accordion-up 0.2s ease-out",
			},
		},
	},
	plugins: [],
}