const db = require('../sqlDatabase.js');
const logger = require('@ericw9079/logger');
const discordManager = require('../discordManager.js');
const cacheManager = require('../cacheManager.js');
const { testMessage } = require('../util.js');
const { Event, Timing } = require('../enums');

/**
 * Message command for GoLive
 * © ericw9079 2022
 */
module.exports = async (interaction) => {
	const action = interaction.options.getSubcommand();
	const twitchChannel = interaction.options.getString('twitch_channel');
	const timing = interaction.options.getString('timing') || Timing.ANYTIME;
	const eventFor = interaction.options.getString('event') || Event.LIVE;
	if (!twitchChannel.match(/[a-z_0-9]{4,25}/i)) {
		await interaction.reply(":x: The channel entered is invalid");
		return;
	}
	switch (action.toLowerCase()) {
		case 'set':
			await interaction.deferReply();
			try {
				const uid = await cacheManager.uid(twitchChannel);
				const channel = await discordManager.getChannel(uid, interaction.guildId);
				if (channel === undefined) {
					await interaction.editReply(":x: This server is not receiving notifications for this channel. The message was not changed");
					return;
				}
				if(uid === process.env.OWNER_CHANNEL && interaction.user.id !== process.env.OWNER_ID){
					await interaction.editReply(":x: Only the bot owner can change the message for this channel");
					return;
				}
				const message = interaction.options.getString('message');
				if (message) {
					const result = await discordManager.addMessage(uid, interaction.guildId, message.trim(), eventFor, timing);
					if (result) {
						await interaction.editReply(`:white_check_mark: Notifications for ${eventFor} events from ${twitchChannel.toLowerCase()} ${timing !== Timing.ANYTIME ? `in the ${timing}` : 'unless otherwise specified'}  will now read "${message}"`);
					} else {
						await interaction.editReply(":x: Could not set message");
					}
				}
				else {
					const result = await discordManager.removeMessage(uid, interaction.guildId, eventFor, timing);
					if (result) {
						const currentChannelMessage = await discordManager.getMessage(uid, interaction.guildId, eventFor, Timing.ANYTIME, false);
						const currentMessage = await discordManager.getMessage(uid, interaction.guildId, eventFor, Timing.ANYTIME);
						if (currentChannelMessage) {
							await interaction.editReply(`:white_check_mark: Notification Message Reset to "${currentChannelMessage}" for ${eventFor} events in the ${timing} from ${twitchChannel.toLowerCase()}`);
						} else if (currentMessage) {
							await interaction.editReply(`:white_check_mark: Notification Message Reset to server default for Live event from ${twitchChannel.toLowerCase()}`);
						} else if (eventFor !== Event.LIVE) {
							await interaction.editReply(`:white_check_mark: Notifications disabled for ${eventFor} events from ${twitchChannel.toLowerCase()}`);
						} else {
							await interaction.editReply(`:white_check_mark: Live Notification Message Reset for ${twitchChannel.toLowerCase()}`);
						}
					} else{
						await interaction.editReply(":x: Could not reset message");
					}
				}
			} catch (e) {
				await interaction.editReply(":x: An Error Occured while setting the message");
				logger.error(e);
			}
			break;
		case 'test':
			await interaction.deferReply();
			try {
				const uid = await cacheManager.uid(twitchChannel.toLowerCase());
				const channel = await discordManager.getChannel(uid, interaction.guildId);
				if(channel === undefined){
					await interaction.editReply(":x: This Channel is not linked with this server");
					return;
				}
				interaction.editReply(await testMessage(twitchChannel.toLowerCase(), interaction.channel, eventFor, timing));
			} catch (e) {
				await interaction.editReply(":x: An Error Occured while testing the message");
				logger.error(e);
			}
			break;
		default:
			logger.warn(`unknown message action: ${action}`);
			break;
	}
}