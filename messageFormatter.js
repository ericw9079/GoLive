const format = (message, data) => {
	if (!data) {
		throw new Error('data argument required');
	}
	if (!data.channel) {
		throw new Error('channel property in data argument required');
	}
	if (!data.game) {
		throw new Error('game property in data argument required');
	}
	if (!data.title) {
		throw new Error('title property in data arument required');
	}
	if (!data.name) {
		throw new Error('name property in data arument required');
	}
	return message.replace("{url}", `https://twitch.tv/${data.channel}`).replace("{game}", data.game).replace("{channel}", data.name.replace("_", "\\_")).replace("{title}", data.title).replace("{everyone}", "@everyone");
};

module.exports = {
	format,
};