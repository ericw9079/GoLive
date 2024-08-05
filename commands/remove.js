const logger = require('@ericw9079/logger');
const db = require('../sqlDatabase.js');
const discordManager = require('../discordManager.js');
const cacheManager = require('../cacheManager.js');

/**
 * Remove command for GoLive
 * © ericw9079 2022
 */
module.exports = async (interaction) => {
	const action = interaction.options.getSubcommand();
	switch (action.toLowerCase()) {
		case 'channel':
			await interaction.deferReply();
			const twitchChannel = interaction.options.getString('twitch_channel');
			if (!twitchChannel.match(/[a-z_0-9]{4,25}/i)) {
				await interaction.editReply(":x: The channel entered is invalid");
				return;
			}
			try {
				const uid = await cacheManager.uid(twitchChannel.toLowerCase());
				if(uid == null){
					await interaction.editReply(`:white_check_mark: Notifications were not being posted when ${twitchChannel.toLowerCase()} goes live`);
					return;
				}
				const result = await discordManager.removeAll(uid,interaction.guildId);
				if(result){
					await interaction.editReply(`:white_check_mark: Notifications will no longer be posted when ${twitchChannel.toLowerCase()} goes live`);
				}
				else{
					await interaction.editReply(":x: Could not remove channel");
				}
			} catch (e) {
				await interaction.editReply(":x: An Error occured while removing channel");
				logger.error(e);
			}
			break;
		case 'all':
			await interaction.deferReply();
			try {
				const result = db.removeWildDiscord(`${interaction.guildId}`);
				if(result) {
					await interaction.editReply(':white_check_mark: Notifications will no longer be posted when anyone goes live');
				}
				else {
					await interaction.editReply(':white_check_mark: Notifications were not being posted when anyone goes live');
				}
			} catch (e) {
				logger.error(e);
				await interaction.editReply(':x: An Error occured while removing the channels');
			}
			break;
		default:
			logger.warn(`unknown remove action: ${action}`);
			break;
	}
}