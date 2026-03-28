"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Hotjar from "@hotjar/browser";

const HOTJAR_SITE_ID = 6678650;
const HOTJAR_VERSION = 6;

export default function HotjarTracker() {
	const pathname = usePathname();

	useEffect(() => {
		if (process.env.NODE_ENV !== "production") {
			return;
		}

		Hotjar.init(HOTJAR_SITE_ID, HOTJAR_VERSION);
	}, []);

	useEffect(() => {
		if (process.env.NODE_ENV !== "production" || !pathname) {
			return;
		}

		Hotjar.stateChange(pathname);
	}, [pathname]);

	return null;
}
