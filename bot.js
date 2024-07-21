require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, ActivityType, Partials } = require('discord.js');
const fs = require('fs');
const logger = require("@ericw9079/logger");
const twitch = require('@ericw9079/twitch-api');
const db = require("./sqlDatabase.js");
const discordManager = require("./discordManager.js");
const cacheManager = require("./cacheManager.js");
const messageFormatter = require('./messageFormatter.js');
const help = require("./help.js");
const { checkPerms, PermissionFlags, getTiming } = require('./util.js');
const { LiveStatus: { OFFLINE, ONLINE }, NOGAME, Event, Change } = require('./enums');

const client = new Client({ 
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.DirectMessages,
	],
	partials: [
		Partials.Channel
	],
});

// Env Variables
const prefix = process.env.DISCORD_PREFIX;
const botId = process.env.DISCORD_CLIENT;
const botPerms = process.env.DISCORD_PERMS;
const botScopes = process.env.DISCORD_SCOPES;
const logChannel = process.env.DISCORD_LOG; // Discord log channel
// End Env Variables

// Constants
const DELAY = 60000; // Time between Twitch fetches, in milliseconds
const COOLDOWN = 300000; // cooldown time between state changes (5 min)
// End Constants

let firstLogin = 0;
const notifications = [];
let interval;
let retryCount = 1;
const cooldowns = new Set();

const sendMessage = async (uid, eventFor, data) => {
  const channels = await db.get(`Discord:${uid}`);
  for (const guildId in channels) {
    try {
		const guild = await client.guilds.fetch(guildId.replace("id",""));
		if (guild && guild.available) {
			discordChannel = await channels[guildId];
			if (discordChannel) {
				discordChannel = guild.channels.resolve(discordChannel);
				if (discordChannel && discordChannel.isTextBased()) {
					let message = await discordManager.getMessage(uid, guildId.replace("id",""), eventFor, getTiming());
					if (!message) {
						message = "{channel} went LIVE with {game}! Check them out at {url}";
					}
					message = messageFormatter.format(message, {
						...data,
						game: data.game_name,
						channel: data.user_name,
					});
					const perm = checkPerms(discordChannel.id, discordChannel.guild);
					if (perm !== PermissionFlags.CANT_SEND) {
						discordChannel.send(message);
						notifications.push(discordChannel.id);
					}
				}
			}
		}
    } catch (e) {
		const channel = await cacheManager.name(uid);
		logger.error(`Error fetching guild ${guildId} (requested by ${channel})`);
		console.error(e);
    }
  }
};

const getChange = async (uid, data) => {
	const [oldStatus, oldGame] = await db.get(`Live:${uid}`);
	const newStatus = data?.type == "live" ? ONLINE : OFFLINE;
	const newGame = data?.game_name || NOGAME;
	let change = Change.NONE;
	if (oldStatus !== newStatus) {
		change = newStatus === ONLINE ? Change.LIVE : Change.OFFLINE;
	} else if (newStatus === ONLINE && oldGame !== newGame) {
		change = Change.GAME;
	}
	if (/\[.*?test.*?]/gi.test(data?.title)) {
		if (change === Change.LIVE) {
			change = Change.SILENT_LIVE;
		} else if (change === Change.GAME) {
			change = Change.SILENT_GAME;
		}
    }
	return change;
};

const checkLive = async (uid) => {
	const { data } = await twitch.get(`streams?user_id=${uid}&first=1`);
	const channelData = data.data[0];
	const change = await getChange(uid, channelData);
	switch (change) {
		case Change.LIVE:
			sendMessage(uid, Event.LIVE, data);
		case Change.SILENT_LIVE:
			logger.log(`${channelData.user_login} status changed to: ${ONLINE}`);
			if (change === Change.SILENT_LIVE) {
				logger.log("Skipping message: test flag set");
			}
			cooldowns.add(uid);
			setTimeout((c) => {
				cooldowns.delete(c);
			}, COOLDOWN, uid);
			break;
		case Change.GAME:
			sendMessage(uid, Event.GAME, data);
		case Change.SILENT_GAME:
			logger.log(`${channelData.user_login} game changed to: ${channelData.game_name}`);
			if (change === Change.SILENT_GAME) {
				logger.log("Skipping message: test flag set");
			}
			cooldowns.add(uid);
			setTimeout((c) => {
				cooldowns.delete(c);
			}, COOLDOWN, uid);
			break;
		case Change.OFFLINE:
			const name = await cacheManager.name(uid);
			logger.log(`${channelData.user_login} status changed to: ${ONLINE}`);
			if (change === Change.SILENT_LIVE) {
				logger.log("Skipping message: test flag set");
			}
			cooldowns.add(uid);
			setTimeout((c) => {
				cooldowns.delete(c);
			}, COOLDOWN, uid);
			break;
	}
	if (![Change.OFFLINE, Change.NONE].includes(change)) {
		await cacheManager.update(uid, channelData.user_login);
		await db.setLive(uid, ONLINE, channelData.game_name);
	} else if (change === Change.OFFLINE) {
		const [ _, oldGame ] = await db.get(`Live:${uid}`);
		await db.setLive(uid, OFFLINE, oldGame);
	}
};

const getLive = async () => {
	try {
		const channels = await db.list("Discord");
		for (const channel of channels) {
			if (!isNaN(channel)) {
				await checkLive(channel);
			}
		}
		retryCount = 1;
	} catch (e) {
		logger.error('Twitch ran into a problem\n', e);
		if (retryCount < 10) {
			retryCount++;
		}
	}
	if (client.user.presence.status == "dnd" && retryCount == 1) {
		client.user.setPresence({ activities: [{ name: `for live channels - /help`, type: ActivityType.Watching }], status: 'online' });
	} else if (client.user.presence.status == "online" && retryCount > 1) {
		client.user.setPresence({ activities: [{ name: `for live channels - /help`, type: ActivityType.Watching }], status: 'dnd' });
	}
	interval = setTimeout(getLive, DELAY*retryCount);
};

const processOwnerCommands = (msg) => {
	const cmd = msg.content.toUpperCase().replace(prefix.toUpperCase(), "");

	if (cmd.startsWith("BL")) {
		if (msg.channel.type !== ChannelType.DM) {
			if (!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
				// We can't send in this channel
				if (msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)) {
					// But we can react so indicate the error
					msg.react('⚠️');
				}
			} else {
				msg.channel.send(":x: This command must be used in a dm");
			}
			return true; // Command handled do not run main handler
		}
		const str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "BL ", "");
		const args = str.split(" ");
		const uid = Number(args[0]);
		if (uid <= 0) {
			msg.channel.send(":x: Please enter the uid to add");
		} else {
			const funct = async () => {
				try {
					const res = await db.addBL(`${Number(uid)}`);
					if (res) {
						msg.channel.send(`:white_check_mark: Added ${args[0]}`);
					} else {
						msg.channel.send(`:x: Unable to add ${args[0]}`)
					}
				} catch (e) {
					msg.channel.send(":x: An Error occured adding the uid");
					logger.log(e);
					console.log(e);
				}
			};
			funct();
		}
		return true; // Command handled do not run main handler
	} else if (cmd.startsWith("GBL")) {
		if (msg.channel.type !== ChannelType.DM) {
			if (!msg.guild.me.members.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
				// We can't send in this channel
				if (msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)) {
					// But we can react so indicate the error
					msg.react('⚠️');
				}
			} else {
				msg.channel.send(":x: This command must be used in a dm");
			}
			return true; // Command handled do not run main handler
		}
		const funct = async () => {
			try {
				const res = await db.get("bl");
				if (res && res.length > 0) {
					msg.channel.send(res.join('\n'));
				} else {
					msg.channel.send(`:x: No uids`)
				}
			} catch(e) {
				msg.channel.send(":x: An Error occured getting the bl");
				logger.log(e);
				console.log(e);
			}
		};
		funct();
		return true; // Command handled do not run main handler
	} else if (cmd.startsWith("GUILDS")) {
		if (msg.channel.type !== ChannelType.DM) {
			if (!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
				// We can't send in this channel
				if (msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)) {
					// But we can react so indicate the error
					msg.react('⚠️');
				}
			} else {
				msg.channel.send(":x: This command must be used in a dm");
			}
			return true; // Command handled do not run main handler
		}
		let s = ""
		for (const entry of client.guilds.cache) {
			s += entry[1].name + "\n"
		}
		if (s) {
			msg.channel.send("Bot is in:\n" + s);
		} else{
			msg.channel.send("Bot is not in any guilds");
		}
		return true; // Command handled do not run main handler
	} else if (cmd.startsWith("INVITE")) {
		if (msg.channel.type !== ChannelType.DM) {
			if (!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
				// We can't send in this channel
				if (msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)) {
					// But we can react so indicate the error
					msg.react('⚠️');
				}
			} else {
				msg.channel.send(":x: This command must be used in a dm");
			}
			return true; // Command handled do not run main handler
		}
		msg.channel.send(`https://discord.com/api/oauth2/authorize?client_id=${botId}&permissions=${botPerms}&scope=${botScopes}`);
		return true;
	} else if (cmd.startsWith("PURGE")) {
		if (msg.channel.type !== ChannelType.DM) {
			if (!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
				// We can't send in this channel
				if (msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)) {
					// But we can react so indicate the error
					msg.react('⚠️');
				}
			} else {
				msg.channel.send(":x: This command must be used in a dm");
			}
			return true; // Command handled do not run main handler
		}
		const funct = async () => {
			let s = "";
			const keys = await db.list("Discord");
			for (key of keys) {
				const channel = key;
				const channels = await db.get("Discord:"+key);
				for (const guildId in channels) {
					try{
						await client.guilds.fetch(guildId.replace("id",""));
					} catch {
						// The guild is unavailable remove it.
						const channelName = await cacheManager.name(channel);
						const result = await discordManager.removeAll(channel, guildId.replace("id",""));
						if (result) {
							await db.removeDefaultChannel(`${guildId.replace("id","")}`);
							s += `Purged ${channelName} => ${guildId}\n`;
						} else {
							s += `Could not Purge ${channelName} => ${guildId}\n`;
						}
					}
				}
			}
			if (!s) {
				s = "No channels were purged.";
			}
			msg.channel.send(s,{ split:true });
		};
		msg.channel.send("Purging...");
		funct();
		return true; // Command handled do not run main handler
	} else if (cmd.startsWith("UBL")) {
		if (msg.channel.type !== ChannelType.DM) {
			if (!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])) {
				// We can't send in this channel
				if (msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)) {
					// But we can react so indicate the error
					msg.react('⚠️');
				}
			} else {
				msg.channel.send(":x: This command must be used in a dm");
			}
			return true; // Command handled do not run main handler
		}
		const str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "UBL ", "");
		const args = str.split(" ");
		const uid = Number(args[0]);
		if (uid <= 0) {
			msg.channel.send(":x: Please enter the uid to remove");
		} else {
			const funct = async () => {
				try {
					await db.removeBL(`${Number(uid)}`);
					msg.channel.send(`:white_check_mark: Removed ${args[0]}`);
				}
				catch (e) {
					msg.channel.send(":x: An Error occured adding the uid");
					logger.log(e);
					console.log(e);
				}
			}
			funct();
		}
		return true; // Command handled do not run main handler
	}
	return false; // Command not handled revert to main handler
};


const start = () => {
	getLive();
}

client.on("ready", () => {
	if (firstLogin !== 1) {
	  firstLogin = 1;
	  logger.log("Discord client connected successfully.");
	  client.user.setPresence({ activities: [{ name: `for live channels - /help`, type: ActivityType.Watching }], status: 'online' });
	  
	  //Initiate the twitch fetch loop
	  start();
	} else {
	  logger.log("Discord client re-connected successfully.");
	  getLive();
	}

});

client.once("ready", async () => {
	const channel = client.channels.cache.get(logChannel);
	try {
		const webhooks = await channel.fetchWebhooks();
		let webhook = webhooks.find(wh => wh.token);
		if (!webhook) {
			webhook = await channel.createWebhook("GoLive Logging", {reason: "GoLive logging"});
		}
		logger.init(webhook);
	} catch (error) {
		logger.error("Error trying to configure discord logger");
		console.log(error);
	}
});

client.on("disconnect", (event) => {
	if (event.code !== 1000) {
	  logger.log("Discord client disconnected with reason: " + event.reason + " (" + event.code + ").");

	  if (event.code === 4004) {
		  logger.log("Please double-check the configured token and try again.");
		  process.exit();
		  return;
	  }

	  logger.log("Attempting to reconnect in 6s...");
	  clearInterval(interval);
	  setTimeout(() => { client.login(); }, 6000);
	}
});

client.on("error", (err) => {
	logger.log(`Discord client error '${err.code}' (${err.message}). Attempting to reconnect in 6s...`);
	clearInterval(interval);
	client.destroy();
	setTimeout(() => { client.login(); }, 6000);
});

client.on('interactionCreate', async (interaction) => {
	if (!interaction.isCommand()) return;
	const commandName = interaction.commandName;
	if (!fs.existsSync(`./commands/${commandName.toLowerCase()}.js`)) return;
	try {
		await require(`./commands/${commandName.toLowerCase()}.js`)(interaction);
	} catch (e) {
		logger.error(e);
	}
});

client.on("messageCreate", (msg) => {
	if (msg.author !== client.user && !msg.guildId) {
		// DM message from someone else
		if (msg.content.toUpperCase().startsWith(prefix.toUpperCase()) && msg.author.id === process.env.OWNER_ID) {
			processOwnerCommands(msg);
		}
	} else{
		if (msg.crosspostable && notifications.includes(msg.channel.id)) {
			msg.crosspost();
			notifications.splice(notifications.indexOf(msg.channel.id), 1);
		}
	}
});

client.on("guildCreate", (guild) => {
	client.users.fetch(process.env.OWNER_ID).then((user) => {
      user.createDM().then((channel) => {
		channel.send(`Joined ${guild.name}`);
      }).catch((e)=>{logger.error(e)});
    }).catch((e)=>{logger.error(e)});
	logger.log(`Joined ${guild.name}`);
});

client.on("guildDelete", (guild) => {
	client.users.fetch(process.env.OWNER_ID).then((user) => {
      user.createDM().then((channel) => {
		channel.send(`Left ${guild.name}`);
      }).catch((e)=>{logger.error(e)});
    }).catch((e)=>{logger.error(e)});
	logger.log(`Left ${guild.name}`);
});

process.on("exit",  () => {
	logger.log("Shutting down");
	client.destroy();
});

logger.log("Attempting Discord Login");
client.login(process.env.DISCORD_TOKEN);
