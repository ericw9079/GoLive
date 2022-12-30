const db = require('../sqlDatabase.js');
const logger = require('@ericw9079/logger');
const discordManager = require('../discordManager.js');
const cacheManager = require('../cacheManager.js');

/**
 * List command for GoLive
 * © ericw9079 2022
 */
module.exports = async (interaction) => {
	const action = interaction.options.getSubcommand();
	const guildId = interaction.guildId;
	let s = "";
	switch (action.toLowerCase()) {
		case 'current':
			await interaction.deferReply();
			let ignoreList = "";
			try {
				const keys = await db.list("Discord");
				for(key of keys){
					const guilds = await db.get(`Discord:${key}`);
					if(!guilds[`id${guildId}`]) continue;
					if(key == "*") continue;
					if(`${key}`.startsWith("^")) {
						const name = (await cacheManager.name(key) ?? '').replace("_","\\_");
						ignoreList += `${name}\n`;
					}
					else {
						const channel = await discordManager.getChannel(key, guildId);
						if(channel !== undefined){
							const name = (await cacheManager.name(key)).replace("_","\\_");
							const msg  = await discordManager.getMessage(key, guildId, false);
							if(msg){
								s += `${name} (in <#${channel}> with custom message)\n`;
							}
							else{
								s += `${name} (in <#${channel}>)\n`;
							}
						}
					}
				}
				if(!s){
					s = "This server is not receiving notifications for any channels\n";
				}
				else{
					s = "This server is receiving notifications when the following channels go live on twitch:\n"+s;
				}
				if(ignoreList) {
					s += "And explicitly ignoring notifications from:\n"+ignoreList;
				}
			}
			catch(e) {
				s = ":x: Error fetching channel list";
				logger.error(e);
			}
			await interaction.editReply(s);
			break;
		case 'available':
			await interaction.deferReply();
			try {
				const keys = await db.list("Discord");
				for(key of keys){
					const channel = await discordManager.getChannel(key, guildId);
					const name = (await cacheManager.name(key) ?? '').replace("_","\\_");
					if(channel === undefined){
						s += `> ${name}\n`;
					}
				}
				if(!s){
					s = "This server is receiving notifications for all the channels GoLive is monitoring";
					if(keys.filter((channel)=>!isNaN(channel)).length < 700){
						s += " and there is space for more.";
					}
					else{
						s += ".";
					}
				}
				else{
					if(keys.filter((channel)=>!isNaN(channel)).length < 700){
						s = "The following channels are being monitored by GoLive and there is space for more:\n"+s;
					}
					else{
						s = "The following channels are being monitored by GoLive and can be added:\n"+s;
					}
				}
				s += 'They can be added with /add';
			}
			catch(e) {
				s = ":x: Error getting list of available channels";
				logger.error(e);
			}
			await interaction.editReply(s);
			break;
		default:
			logger.warn(`unknown list action: ${action}`);
			break;
	}
}