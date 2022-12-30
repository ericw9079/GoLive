const db = require('../sqlDatabase.js');
const logger = require('@ericw9079/logger');
const { checkPerms, PermissionFlags } = require('../util.js');
const discordManager = require('../discordManager.js');

/**
 * Default command for GoLive
 * © ericw9079 2022
 */
module.exports = async (interaction) => {
	const action = interaction.options.getSubcommand();
	switch (action.toLowerCase()) {
		case 'channel':
			await interaction.deferReply();
			const channel = interaction.options.getChannel('discord_channel');
			if (channel) {
				const perm = checkPerms(channel.id, channel.guild);
				if (perm !== PermissionFlags.CANT_SEND) {
					try {
						const result = await db.addDefaultChannel(`${channel.guildId}`,`${channel.id}`);
						if (result && perm == PermissionFlags.CAN_SEND) {
						  await interaction.editReply(`:white_check_mark: Default channel set to <#${channel.id}>`);
						}
						else if (result && perm == PermissionFlags.CANT_EMBED) {
						  await interaction.editReply(`:warning: Default channel set to <#${channel.id}> but links won't be embeded`);
						}
					} catch (e) {
						await interaction.editReply(":x: Error setting default. The default channel was not set.");
						logger.error(e);
					}
				}
				else{
				  await interaction.editReply(`:x: Please ensure <@${client.user.id}> has permission to send messages in <#${channelid}>. The default channel was not set.`);
				}
			} else {
				try {
					await db.removeDefaultChannel(`${interaction.guildId}`);
					await interaction.editReply(":white_check_mark: Default channel cleared.");
				} catch(e) {
					await interaction.editReply(":x: Error clearing the default channel.");
					logger.error(e);
				}
			}
			break;
		case 'message':
			await interaction.deferReply();
			const message = interaction.options.getString('message');
			if (message) {
				try {
					const result = await discordManager.addDefault(interaction.guildId, message.trim());
					if (result) {
						await interaction.editReply(`:white_check_mark: Default Notifications will now read '${message}'`);
					}
					else {
						await interaction.editReply(":x: Could not add default");
					}
				} catch (e) {
					await interaction.editReply(":x: Error setting default message. The default message was not changed.");
					logger.error(e);
				}
			} else {
				try {
					const result = await discordManager.removeDefault(interaction.guildId);
					if (result) {
					  await interaction.editReply(':white_check_mark: Default Notification Message Reset');
					}
					else {
					  await interaction.editReply(":x: Could not reset default");
					}
				} catch (e) {
					await interaction.editReply(":x: Error resetting default message. The default message was not changed.");
					logger.error(e);
				}
			}
			break;
		default:
			logger.warn(`unknown default action: ${action}`);
			break;
	}
}