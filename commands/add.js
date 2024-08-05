const logger = require('@ericw9079/logger');
const db = require('../sqlDatabase.js');
const { checkPerms, lookupChannel, PermissionFlags } = require('../util.js');
const discordManager = require('../discordManager.js');
const cacheManager = require('../cacheManager.js');

/**
 * Add command for GoLive
 * © ericw9079 2022
 */
module.exports = async (interaction) => {
	const action = interaction.options.getSubcommand();
	const channel = interaction.options.getChannel('discord_channel');
	let replied = false; // The defer will already handle the initial reply this will swtich between editReply and followUp
	switch (action.toLowerCase()) {
		case 'channel':
			await interaction.deferReply();
			const twitchChannel = interaction.options.getString('twitch_channel');
			if (!twitchChannel.match(/[a-z_0-9]{4,25}/i)) {
				await interaction.editReply(":x: The channel entered is invalid");
				return;
			}
			try {
				const twitchData = await lookupChannel(twitchChannel);
				if(!twitchData){
					await interaction.editReply(":x: Could not resolve twitch channel.");
					return;
				}
				if (channel) {
					// User provided a channel
					const perm = checkPerms(channel.id,channel.guild);
					if(perm !== PermissionFlags.CANT_SEND){
						const result = await discordManager.addChannel(twitchData.id,interaction.guildId, channel.id);
						if(result && perm == PermissionFlags.CAN_SEND){
							await interaction.editReply(`:white_check_mark: Notifications will be sent to <#${channel.id}> when ${twitchChannel.toLowerCase()} goes live`);
							cacheManager.update(twitchData.id, twitchData.broadcaster_login);
						}
						else if(result && perm == PermissionFlags.CANT_EMBED){
							await interaction.editReply(`:warning: Notifications will be sent to <#${channel.id}> when ${twitchChannel.toLowerCase()} goes live but links won't be embeded`);
							cacheManager.update(twitchData.id, twitchData.broadcaster_login);
						}
						else{
							await interaction.editReply(`:x: Not enough space to add ${twitchChannel.toLowerCase()}, use \`/list available\` to list the channels that can be added.`);
						}
					}
					else{
						await interaction.editReply(`:x: Please ensure <@${interaction.client.user.id}> has permission to send messages in <#${channel.id}>. The channel was not added.`);
					}
				}
				else {
					// No Channel Provided
					const defaultChannelID = await db.get("DefaultChannel:"+interaction.guildId);
					let channelObj = null;
					if (defaultChannelID) {
						channelObj = interaction.guild.channels.resolve(defaultChannelID);
						if(channelObj === null){
							await interaction.editReply(":warning: The default channel could not be found");
							replied = true; // Use followUp for the next reply so we don't overwrite the warning
						}
					}
					if (!channelObj) {
						// Default either isn't defined or couldn't be found in guild
						channelObj = interaction.channel;
					}
					if(channelObj && channelObj.isTextBased()) {
						const perm = checkPerms(channelObj.id,channelObj.guild);
						if(perm !== PermissionFlags.CANT_SEND){
							const result = await discordManager.addChannel(twitchData.id,interaction.guildId, channelObj.id);
							if(result && perm == PermissionFlags.CAN_SEND){
								if (replied) {
									await interaction.followUp(`:white_check_mark: Notifications will be sent to <#${channelObj.id}> when ${twitchChannel.toLowerCase()} goes live`);
								} else {
									await interaction.editReply(`:white_check_mark: Notifications will be sent to <#${channelObj.id}> when ${twitchChannel.toLowerCase()} goes live`);
								}
								cacheManager.update(twitchData.id, twitchChannel);
							}
							else if(result && perm == PermissionFlags.CANT_EMBED){
								if (replied) {
									await interaction.followUp(`:warning: Notifications will be sent to <#${channelObj.id}> when ${twitchChannel.toLowerCase()} goes live but links won't be embeded`);
								} else {
									await interaction.editReply(`:warning: Notifications will be sent to <#${channelObj.id}> when ${twitchChannel.toLowerCase()} goes live but links won't be embeded`);
								}
								cacheManager.update(twitchData.id, twitchChannel);
							}
							else{
								if (replied) {
									await interaction.followUp(`:x: Not enough space to add ${twitchChannel.toLowerCase()}, use \`/list available\` to list the channels that can be added.`);
								} else {
									await interaction.editReply(`:x: Not enough space to add ${twitchChannel.toLowerCase()}, use \`/list available\` to list the channels that can be added.`);
								}
							}
						}
						else{
							if (replied) {
								await interaction.followUp(`:x: Please ensure <@${interaction.client.user.id}> has permission to send messages in <#${channelObj.id}>. The channel was not added.`);
							} else {
								await interaction.editReply(`:x: Please ensure <@${interaction.client.user.id}> has permission to send messages in <#${channelObj.id}>. The channel was not added.`);
							}
						}
					}
					else {
						if (replied) {
							await interaction.followUp(":x: Failed to identify the channel you specified.");
						} else {
							await interaction.editReply(":x: Failed to identify the channel you specified.");
						}
					}
				}
			} catch (e) {
				if (e.message !== "Bl") logger.error(e);
				if (replied) {
					await interaction.followUp(":x: An Error occured while adding the channel");
				} else {
					await interaction.editReply(":x: An Error occured while adding the channel");
				}
			}
			break;
		case 'all':
			await interaction.deferReply();
			if (channel) {
				// User provided a channel
				const perm = checkPerms(channel.id,channel.guild);
				if(perm !== PermissionFlags.CANT_SEND){
					try {
						const result = db.addWildDiscord(`${channel.guildId}`,`${channel.id}`);
						if(result && perm == PermissionFlags.CAN_SEND){
							await interaction.editReply(`:white_check_mark: Notifications will be sent to <#${channel.id}> when anyone goes live`);
						}
						else if(result && perm == PermissionFlags.CANT_EMBED){
							await interaction.editReply(`:warning: Notifications will be sent to <#${channel.id}> when anyone goes live but links won't be embeded`);
						}
					}
					catch (e) {
						await interaction.editReply(":x: Error adding channels.");
						logger.error(e);
					}
				}
				else {
					interaction.editReply(`:x: Please ensure <@${interaction.client.user.id}> has permission to see and send messages in <#${channel.id}>. The channels were not added.`);
				}
			}
			else {
				// No channel provided
				try {
					const defaultChannelID = await db.get("DefaultChannel:"+interaction.guildId);
					let channelObj = null;
					if (defaultChannelID) {
						channelObj = interaction.guild.channels.resolve(defaultChannelID);
						if(channelObj === null){
							await interaction.editReply(":warning: The default channel could not be found");
							replied = true; // Use followUp for the next reply so we don't overwrite the warning
						}
					}
					if (!channelObj) {
						// Default either isn't defined or couldn't be found in guild
						channelObj = interaction.channel;
					}
					if(channelObj && channelObj.isTextBased()) {
						const perm = checkPerms(channelObj.id,channelObj.guild);
						if(perm !== PermissionFlags.CANT_SEND){
							const result = db.addWildDiscord(`${channelObj.guildId}`,`${channelObj.id}`);
							if(result && perm == PermissionFlags.CAN_SEND){
								if (replied) {
									await interaction.followUp(`:white_check_mark: Notifications will be sent to <#${channelObj.id}> when anyone goes live`);
								} else {
									await interaction.editReply(`:white_check_mark: Notifications will be sent to <#${channelObj.id}> when anyone goes live`);
								}
							}
							else if(result && perm == PermissionFlags.CANT_EMBED){
								if (replied) {
									await interaction.followUp(`:warning: Notifications will be sent to <#${channelObj.id}> when anyone goes live but links won't be embeded`);
								} else {
									await interaction.editReply(`:warning: Notifications will be sent to <#${channelObj.id}> when anyone goes live but links won't be embeded`);
								}
							}
						}
						else {
							if (replied) {
								await interaction.followUp(`:x: Please ensure <@${interaction.client.user.id}> has permission to see and send messages in <#${channelObj.id}>. The channels were not added.`);
							} else {
								await interaction.editReply(`:x: Please ensure <@${interaction.client.user.id}> has permission to see and send messages in <#${channelObj.id}>. The channels were not added.`);
							}
						}
					}
					else {
						if (replied) {
							await interaction.followUp(":x: Failed to identify the channel you specified");
						} else {
							await interaction.editReply(":x: Failed to identify the channel you specified");
						}
					}
				} catch (e) {
					if(replied) {
						interaction.followUp(":x: Error adding channels");
					} else {
						interaction.editReply(":x: Error adding channels");
					}
					logger.error(e);
				}
			}
			break;
		default:
			logger.warn(`unknown add action: ${action}`);
			break;
	}
}