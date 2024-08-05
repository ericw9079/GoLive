const logger = require('@ericw9079/logger');
const db = require('../sqlDatabase.js');
const discordManager = require('../discordManager.js');
const cacheManager = require('../cacheManager.js');

/**
 * Unignore command for GoLive
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
		const uid = await cacheManager.uid(twitchChannel.toLowerCase());
		if(uid == null || ((await db.get(`Discord:${uid}`))[`id${interaction.guildId}`] !== undefined && (await db.get(`Discord:^${uid}`))[`id${interaction.guildId}`] === undefined)){
			interaction.editReply(`:x: ${twitchChannel.toLowerCase()} is not being ignored.`);
			return;
		}
		const result = await discordManager.removeAll(uid, interaction.guildId);
		if(result){
		  await interaction.editReply(`:white_check_mark: No longer ignoring notifications from ${twitchChannel.toLowerCase()}`);
		}
		else{
			await interaction.editReply(":x: Could not unignore channel");
		}
	} catch (e) {
		await interaction.editReply(":x: An Error occured while unignoring the channel.");
		logger.error(e);
	}
}