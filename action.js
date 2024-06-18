const title = "Fullheight Image";
let state = "active";

// This is abad code, but it works.
chrome.storage.local.get("state").then(state => {
	state = state.state;
	chrome.action.setIcon({
		path: {
			128: `icon-${state}.png`,
		},
	});
});

function shrinkImage() {
	// get first image
	const img = document.getElementsByTagName("img")[0];
	img.setAttribute(
		"style",
		`width: ${img.width}; height: ${img.height}; margin: auto;`
	);
}

function enlargeImage() {
	const img = document.getElementsByTagName("img")[0];
	img.setAttribute("style", "width: 99vw; height: 99vh; object-fit: contain;");
}

function callScript(tabId, imageFunc) {
	chrome.scripting.executeScript({
		target: { tabId },
		imageFunc,
	});
}

// add listener for action icon
chrome.action.onClicked.addListener(async function (tab) {
	const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
	const activeTab = tabs[0];
	const tabUrl = activeTab.url;
	const tabId = activeTab.id;

	if (state === "active") {
		state = "sleeping";
		chrome.action.setIcon({
			path: {
				128: "icon-sleeping.png",
			},
		});
		if (tabUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
			chrome.scripting.executeScript({
				target: { tabId },
				func: shrinkImage,
			});
		}
		chrome.action.setTitle({ title: `${title}\n(inactive)` });
		removeWebRequestListener();
	} else {
		state = "active";
		chrome.action.setIcon({
			path: {
				128: "icon-active.png",
			},
		});
		if (tabUrl.match(/\.(jpg|jpeg|png|gif)$/i)) {
			console.log("enlarge");
			chrome.scripting.executeScript({
				target: { tabId },
				func: enlargeImage,
			});
		}
		chrome.action.setTitle({ title });
		addWebRequestListener();
	}
	chrome.storage.local.set({ state });
	console.log("localstorage set");
});

function removeWebRequestListener() {
	chrome.webRequest.onCompleted.removeListener(webRequestListener);
}

function webRequestListener(details) {
	console.log("addWebRequestListener", details);
	chrome.scripting.executeScript({
		target: { tabId: details.tabId },
		func: enlargeImage,
	});
}

function addWebRequestListener() {
	chrome.webRequest.onCompleted.addListener(webRequestListener, {
		urls: ["*://*/*.jpg", "*://*/*.jpeg", "*://*/*.png", "*://*/*.gif"],
		types: ["main_frame"],
	});
}

addWebRequestListener();

chrome.action.setIcon({
	path: {
		128: "icon-active.png",
	},
});
