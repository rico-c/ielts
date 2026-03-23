"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const CHATWAY_SCRIPT_ID = "chatway-widget-script";
const CHATWAY_SRC = "https://cdn.chatway.app/widget.js?id=fetdWRB5NXoe";

export default function ChatwayWidget() {
	const pathname = usePathname();

	useEffect(() => {
		if (pathname?.startsWith("/dashboard")) {
			return;
		}

		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		let idleCallbackId: number | undefined;

		const loadScript = () => {
			if (document.getElementById(CHATWAY_SCRIPT_ID)) {
				return;
			}

			const script = document.createElement("script");
			script.id = CHATWAY_SCRIPT_ID;
			script.src = CHATWAY_SRC;
			script.async = true;
			document.body.appendChild(script);
		};

		if (typeof window.requestIdleCallback === "function") {
			idleCallbackId = window.requestIdleCallback(loadScript, { timeout: 6000 });
		} else {
			timeoutId = globalThis.setTimeout(loadScript, 3500);
		}

		return () => {
			if (idleCallbackId !== undefined && typeof window.cancelIdleCallback === "function") {
				window.cancelIdleCallback(idleCallbackId);
			}

			if (timeoutId !== undefined) {
				globalThis.clearTimeout(timeoutId);
			}
		};
	}, [pathname]);

	return null;
}
