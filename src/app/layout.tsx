import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";

const displayFont = Cormorant_Garamond({
	variable: "--font-display",
	subsets: ["latin"],
	weight: ["500", "600", "700"],
});

const bodyFont = Manrope({
	variable: "--font-body",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "优秀雅思 - 全真AI口语模拟考试&剑雅IELTS真题复习平台",
	description: "雅思全科备考落地页，聚合口语陪练、最新题库预览与真实考试节奏训练。",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${displayFont.variable} ${bodyFont.variable} antialiased`}>
				<ClerkProvider>{children}</ClerkProvider>
			</body>
		</html>
	);
}
