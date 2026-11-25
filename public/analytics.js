(() => {
	const productionHost = "pixel-workbench-eta.vercel.app";
	const measurementId = "G-3SM7GCPP48";
	const pageTitles = new Map([["/", "Pixel Workbench · 像素工作室"]]);
	if (
		location.protocol !== "https:" ||
		location.hostname !== productionHost ||
		!/^G-[A-Z0-9]+$/.test(measurementId)
	)
		return;
	if (
		navigator.doNotTrack === "1" ||
		Reflect.get(navigator, "globalPrivacyControl") === true
	)
		return;
	function hasPrivateReferrer() {
		if (!document.referrer) return false;
		const referrer = new URL(document.referrer);
		return Boolean(
			referrer.search ||
				referrer.hash ||
				(referrer.pathname !== "/" &&
					(referrer.hostname !== productionHost ||
						!pageTitles.has(referrer.pathname))),
		);
	}

	// GA may append the actual document query to a custom page_location.
	if (location.search || location.hash || hasPrivateReferrer()) return;
	const path = location.pathname === "/index.html" ? "/" : location.pathname;
	const title = pageTitles.get(path);
	if (!title) return;
	const page = {
		page_location: `https://${productionHost}${path}`,
		page_title: title,
		page_referrer: "",
	};
	function command() {
		window.dataLayer ??= [];
		// biome-ignore lint/complexity/noArguments: Google's tag consumes arguments objects in the data layer.
		window.dataLayer.push(arguments);
	}
	command("js", new Date());
	command("config", measurementId, {
		...page,
		send_page_view: false,
		allow_google_signals: false,
		allow_ad_personalization_signals: false,
	});
	command("event", "page_view", { ...page, send_to: measurementId });
	const tag = document.createElement("script");
	tag.async = true;
	tag.referrerPolicy = "no-referrer";
	tag.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
	document.head.append(tag);
})();
