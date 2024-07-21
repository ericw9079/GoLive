const LiveStatus = {
	OFFLINE: "OFFLINE",
	ONLINE: "ONLINE",
};

const NOGAME = "No Game";

const Timing = {
	ANYTIME: "Anytime",
	MORNING: "Morning",
	AFTERNOON: "Afternoon",
	NIGHT: "Night",
};

const Event = {
	LIVE: "Live",
	GAME: "Game",
};

const Change = {
	LIVE: "live",
	SILENT_LIVE: "live_silent",
	GAME: "game",
	SILENT_GAME: "game_silent",
	OFFLINE: "offline",
	NONE: "none",
};

module.exports = {
	LiveStatus,
	NOGAME,
	Timing,
	Event,
	Change
};