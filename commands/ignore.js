const db = require('../sqlDatabase.js');
const logger = require('@ericw9079/logger');
const cacheManager = require('../cacheManager.js');
const { lookupChannel } = require('../util.js');

/**
 * Ignore command for GoLive
 * © ericw9079 2022
 */
module.exports = async (interaction) => {
	const twitchChannel = interaction.options.getString('twitch_channel');
	if (!twitchChannel.match(/[a-z_0-9]{4,25}/i)) {
		await interaction.reply(":x: The channel entered is invalid");
		return;
	}
	try {
		await interaction.deferReply();
		const resp = await lookupChannel(twitchChannel);
		if(resp === false){
			await interaction.editReply(":x: Could not resolve twitch channel.");
			return;
		}
		const uid = resp.id;
		const result = await db.ignoreDiscord(uid,`${interaction.guildId}`);
		await interaction.editReply(`:white_check_mark: Now ignoring notifications from ${twitchChannel.toLowerCase()}`);
		cacheManager.update(uid, twitchChannel);
	} catch (e) {
		interaction.editReply(":x: An Error occured while ignoring the channel.");
		if (e.message !== "Bl") logger.error(e);
	}
}