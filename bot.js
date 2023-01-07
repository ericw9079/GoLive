require('dotenv').config();
const axios = require('axios');
const { Client, GatewayIntentBits, ChannelType, PermissionsBitField, ActivityType, Partials } = require('discord.js');
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
const fs = require('fs');
const logger = require("@ericw9079/logger");
const db = require("./sqlDatabase.js");
const discordManager = require("./discordManager.js");
const cacheManager = require("./cacheManager.js");
const help = require("./help");
const statusUpdater = require('./statusUpdater.js');
const { lookupChannel, checkPerms, PermissionFlags, testMessage } = require('./util.js');

// Env Variables
const prefix = process.env.DISCORD_PREFIX;
const botId = process.env.DISCORD_CLIENT;
const botPerms = process.env.DISCORD_PERMS;
const botScopes = process.env.DISCORD_SCOPES;
const logChannel = process.env.DISCORD_LOG; // Discord log channel
const statusConfig = {
	baseURL: 'https://golive.ericw.tech',
	headers: {'X-auth-token': process.env.AUTH_TOKEN}
}
// End Env Variables

// APIs
const twitch = require('@ericw9079/twitch-api');
const statusSite = axios.create(statusConfig);
// End APIs

// Constants
const OFFLINE = "OFFLINE";
const ONLINE = "ONLINE";

const DELAY = 60000; // Time between Twitch fetches, in milliseconds
const COOLDOWN = 300000; // cooldown time between state changes (5 min)
// End Constants

let firstLogin = 0;
let notifications = [];
let interval;
let retryCount = 1;
let cooldowns = new Set();

statusUpdater.init(statusSite);

async function checkLive(uid){
  const name = await cacheManager.name(uid);
  const resp = await twitch.get(`streams?user_id=${uid}&first=1`);
  let oldStatus = await db.get(`Live:${uid}`);
  if(oldStatus == null || oldStatus == ""){
    oldStatus = OFFLINE;
  }
  if(!resp.data.data[0]){
    resp.data.data[0] = {type:""};
  }
  const newStatus = resp.data.data[0].type=="live"?ONLINE:OFFLINE;
  if(oldStatus == OFFLINE && newStatus == ONLINE && !cooldowns.has(name)){
    await cacheManager.update(uid,resp.data.data[0].user_login);
    if(!/\[.*?test.*?]/gi.test(resp.data.data[0].title)){
      sendMessage(uid,resp.data.data[0].game_name,resp.data.data[0].title,resp.data.data[0].user_name,resp.data.data[0].started_at);
    }
    else{
      logger.log("Skipping message: test flag set");
    }
  }
  if(oldStatus != newStatus){
    logger.log(`${name} status changed to: `+newStatus);
	statusUpdater.put(uid,newStatus,name);
    cooldowns.add(name);
    setTimeout((c) => {
      cooldowns.delete(c);
    }, COOLDOWN,name);
  }
  await db.setLive(uid,newStatus);
}

async function getLive(){
  try{
    const channels = await db.list("Discord");
    for(const channel of channels){
		if(!isNaN(channel)){
			await checkLive(channel);
		}
    }
    retryCount = 1;
  }
  catch (e){
    logger.error(`Twitch ran into a problem\n${e}`);
    if(retryCount < 10){
      retryCount++;
    }
  }
  if(client.user.presence.status == "dnd" && retryCount == 1){
    client.user.setPresence({ activities: [{ name: `for live channels - /help`, type: ActivityType.Watching}], status: 'online' });
  }
  else if(client.user.presence.status == "online" && retryCount > 1){
    client.user.setPresence({ activities: [{ name: `for live channels - /help`, type: ActivityType.Watching}], status: 'dnd' });
  }
  interval = setTimeout(getLive,DELAY*retryCount);
}

async function sendMessage(uid,game,title,name,startedAt=""){
  const channel = await cacheManager.name(uid);
  const channels = await db.get(`Discord:${uid}`);
  for(const guildId in channels){
    try{
      const guild = await client.guilds.fetch(guildId.replace("id",""));
      if(guild && guild.available){
        discordChannel = await channels[guildId];
        if(discordChannel){
          discordChannel = guild.channels.resolve(discordChannel);
          if(discordChannel && discordChannel.isTextBased()){
            let message = await discordManager.getMessage(uid,guildId.replace("id",""));
            if(!message){
              message = "{channel} went LIVE with {game}! Check them out at {url}";
            }
            message = message.replace("{url}",`https://twitch.tv/${channel}`).replace("{game}",game).replace("{channel}",name.replace("_","\\_")).replace("{title}",title).replace("{everyone}","@everyone");
            const perm = checkPerms(discordChannel.id,discordChannel.guild);
            if(perm !== PermissionFlags.CANT_SEND){
				discordChannel.send(message);
				notifications.push(discordChannel.id);
            }
          }
        }
      }
    }
    catch(e){
      logger.error(`Not in the guild for ${channel}`);
      console.error(e);
    }
  }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function processOwnerCommands(msg){
  const cmd = msg.content.toUpperCase().replace(prefix.toUpperCase(), "");

  if(cmd.startsWith("BL")) {
	if (msg.channel.type !== ChannelType.DM){
      if(!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages])){
        // We can't send in this channel
        if(msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)){
          // But we can react so indicate the error
          msg.react('⚠️');
        }
      }
      else{
        msg.channel.send(":x: This command must be used in a dm");
      }
      return true; // Command handled do not run main handler
    }
	const str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "BL ", "");
	const args = str.split(" ");
	const uid = Number(args[0]);
	if(uid <= 0) {
		msg.channel.send(":x: Please enter the uid to add");
	}
	else {
		const funct = async () => {
			try {
				const res = await db.addBL(`${Number(uid)}`);
				if(res) {
					msg.channel.send(`:white_check_mark: Added ${args[0]}`);
				}
				else {
					msg.channel.send(`:x: Unable to add ${args[0]}`)
				}
			}
			catch(e) {
				msg.channel.send(":x: An Error occured adding the uid");
				logger.log(e);
				console.log(e);
			}
		}
		funct();
	}
	return true; // Command handled do not run main handler
  }
  else if(cmd.startsWith("GBL")) {
	if (msg.channel.type !== ChannelType.DM){
      if(!msg.guild.me.members.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages])){
        // We can't send in this channel
        if(msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)){
          // But we can react so indicate the error
          msg.react('⚠️');
        }
      }
      else{
        msg.channel.send(":x: This command must be used in a dm");
      }
      return true; // Command handled do not run main handler
    }
	const funct = async () => {
		try {
			const res = await db.get("bl");
			if(res && res.length > 0) {
				msg.channel.send(res.join('\n'));
			}
			else {
				msg.channel.send(`:x: No uids`)
			}
		}
		catch(e) {
			msg.channel.send(":x: An Error occured getting the bl");
			logger.log(e);
			console.log(e);
		}
	}
	funct();
	return true; // Command handled do not run main handler
  }
  else if(cmd.startsWith("GUILDS")){
    if (msg.channel.type !== ChannelType.DM){
      if(!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages])){
        // We can't send in this channel
        if(msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)){
          // But we can react so indicate the error
          msg.react('⚠️');
        }
      }
      else{
        msg.channel.send(":x: This command must be used in a dm");
      }
      return true; // Command handled do not run main handler
    }
    let s = ""
    for (const entry of client.guilds.cache) {
      s += entry[1].name + "\n"
    }
    if(s){
      msg.channel.send("Bot is in:\n"+s);
    }
    else{
      msg.channel.send("Bot is not in any guilds");
    }
    return true; // Command handled do not run main handler
  }
  else if(cmd.startsWith("INVITE")){
    if (msg.channel.type !== ChannelType.DM){
      if(!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages])){
        // We can't send in this channel
        if(msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)){
          // But we can react so indicate the error
          msg.react('⚠️');
        }
      }
      else{
        msg.channel.send(":x: This command must be used in a dm");
      }
      return true; // Command handled do not run main handler
    }
    msg.channel.send(`https://discord.com/api/oauth2/authorize?client_id=${botId}&permissions=${botPerms}&scope=${botScopes}`);
    return true;
  }
  else if(cmd.startsWith("PURGE")){
    if (msg.channel.type !== ChannelType.DM){
      if(!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages])){
        // We can't send in this channel
        if(msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)){
          // But we can react so indicate the error
          msg.react('⚠️');
        }
      }
      else{
        msg.channel.send(":x: This command must be used in a dm");
      }
      return true; // Command handled do not run main handler
    }
    const funct = async () => {
      let s = "";
      const keys = await db.list("Discord");
      for(key of keys){
        const channel = key;
        const channels = await db.get("Discord:"+key);
        for(const guildId in channels){
          try{
            await client.guilds.fetch(guildId.replace("id",""));
          }
          catch{
            // The guild is unavailable remove it.
              const channelName = await cacheManager.name(channel);
              const result = await discordManager.removeAll(channel,guildId.replace("id",""));
              if(result){
                await db.removeDefaultChannel(`${guildId.replace("id","")}`);
                s += `Purged ${channelName} => ${guildId}\n`;
              }
              else{
                s += `Could not Purge ${channelName} => ${guildId}\n`;
              }
          }
        }
      }
      if(!s){
        s = "No channels were purged.";
      }
      msg.channel.send(s,{split:true});
    };
    msg.channel.send("Purging...");
    funct();
    return true; // Command handled do not run main handler
  }
  else if(cmd.startsWith("UBL")) {
	if (msg.channel.type !== ChannelType.DM){
      if(!msg.guild.members.me.permissionsIn(msg.channel).has([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.SendMessages])){
        // We can't send in this channel
        if(msg.guild.members.me.permissionsIn(msg.channel).has(PermissionsBitField.Flags.AddReactions)){
          // But we can react so indicate the error
          msg.react('⚠️');
        }
      }
      else{
        msg.channel.send(":x: This command must be used in a dm");
      }
      return true; // Command handled do not run main handler
    }
	const str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "UBL ", "");
	const args = str.split(" ");
	const uid = Number(args[0]);
	if(uid <= 0) {
		msg.channel.send(":x: Please enter the uid to remove");
	}
	else {
		const funct = async () => {
			try {
				await db.removeBL(`${Number(uid)}`);
				msg.channel.send(`:white_check_mark: Removed ${args[0]}`);
			}
			catch(e) {
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
}

client.on("ready", () => {
	if(firstLogin !== 1) {
	  firstLogin = 1;
	  logger.log("Discord client connected successfully.");
	  client.user.setPresence({ activities: [{ name: `for live channels - /help`, type: ActivityType.Watching}], status: 'online' });
	  
	  //Initiate the twitch fetch loop
	  start();
	}
	else {
	  logger.log("Discord client re-connected successfully.");
	  getLive();
	}

});

client.once("ready", async () => {
	const channel = client.channels.cache.get(logChannel);
	try {
		const webhooks = await channel.fetchWebhooks();
		let webhook = webhooks.find(wh => wh.token);
		if(!webhook) {
			webhook = await channel.createWebhook("GoLive Logging", {reason: "GoLive logging"});
		}
		logger.init(webhook);
	}
	catch (error) {
		logger.error("Error trying to configure discord logger");
		console.log(error);
	}
});

client.on("disconnect", (event) => {
	if(event.code !== 1000) {
	  logger.log("Discord client disconnected with reason: " + event.reason + " (" + event.code + ").");

	  if(event.code === 4004) {
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
	if(!fs.existsSync(`./commands/${commandName.toLowerCase()}.js`)) return;
	try {
		await require(`./commands/${commandName.toLowerCase()}.js`)(interaction);
	} catch (e) {
		logger.error(e);
	}
});

client.on("messageCreate", (msg) => {
	if(msg.author !== client.user && !msg.guildId) {
		// DM message from someone else
		if(msg.content.toUpperCase().startsWith(prefix.toUpperCase()) && msg.author.id === process.env.OWNER_ID) {
			processOwnerCommands(msg);
		}
	}
	else{
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

function start(){
	getLive();
}

logger.log("Attempting Discord Login");
client.login(process.env.DISCORD_TOKEN);
