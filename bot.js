require('dotenv').config();
const axios = require('axios');
const { Client, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS,Intents.FLAGS.GUILD_MESSAGES,Intents.FLAGS.DIRECT_MESSAGES] });
const db = require("./sqlDatabase.js");
const discordManager = require("./discordManager.js");
const cacheManager = require("./cacheManager.js");
const help = require("./help");
const logger = require("./logger.js");
const debugLogger = require("./debugLogger.js");
const statusUpdater = require('./statusUpdater.js');

// Env Variables
const clientId = process.env.TWITCH_ID;
const clientSecret = process.env.TWITCH_SECRET;
const prefix = process.env.DISCORD_PREFIX;
const botId = process.env.DISCORD_CLIENT;
const botPerms = process.env.DISCORD_PERMS;
const botScopes = process.env.DISCORD_SCOPES;
const logChannel = process.env.DISCORD_LOG; // Discord log channel
const statusConfig = {
	baseURL: 'https://golive.epicboy.repl.co',
	headers: {'X-auth-token': process.env.AUTH_TOKEN}
}
// End Env Variables

// APIs
const twitch = axios.create();
const statusSite = axios.create(statusConfig);
// End APIs

// Constants
const OFFLINE = "OFFLINE";
const ONLINE = "ONLINE";

const CANT_SEND = 0;
const CANT_EMBED = -1;
const CAN_SEND = 1;

const DELAY = 60000; // Time between Twitch fetches, in milliseconds
const COOLDOWN = 300000; // cooldown time between state changes (5 min)
// End Constants

let firstLogin = 0;
let notifications = [];
let interval;
let retryCount = 1;
let cooldowns = new Set();
let errMsg = "";

//require("./deploy-commands.js");

statusUpdater.init(statusSite);

function checkPerms(channel,guild){
  const perms = guild.me.permissionsIn(channel);
    if(perms.has(['VIEW_CHANNEL','SEND_MESSAGES','EMBED_LINKS'])){
      return CAN_SEND;
    }
    if(perms.has(['VIEW_CHANNEL','SEND_MESSAGES'])){
      return CANT_EMBED;
    }
    return CANT_SEND;
}

async function getToken(){
	const res = await twitch.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`);
	twitch.defaults.headers.common['Authorization'] = "Bearer "+res.data.access_token;
}

async function lookupChannel(channelName){
  try{
		await twitch.head('https://id.twitch.tv/oauth2/validate');
	}
	catch(error){
		await getToken();
	}
  const resp = await twitch.get(`https://api.twitch.tv/helix/search/channels?query=${channelName}&first=1`);
  if(resp.data.data[0] && resp.data.data[0].broadcaster_login == channelName.toLowerCase()){
    const bl = await db.get("bl");
    if(bl.includes(resp.data.data[0].id)){
      throw new Error("Bl");
    }
    return resp.data.data[0];
  }
  return false;
}

async function checkLive(uid){
  const name = await cacheManager.name(uid);
  try{
	await twitch.head('https://id.twitch.tv/oauth2/validate');
  }
  catch(error){
	await getToken();
  }
  const resp = await twitch.get(`https://api.twitch.tv/helix/streams?user_id=${uid}&first=1`);
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
    client.user.setPresence({ activities: [{ name: `for live channels - ${prefix}help`, type: 'WATCHING'}], status: 'online' });
  }
  else if(client.user.presence.status == "online" && retryCount > 1){
    client.user.setPresence({ activities: [{ name: `for live channels - ${prefix}help`, type: 'WATCHING'}], status: 'dnd' });
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
          if(discordChannel && discordChannel.isText()){
            let message = await discordManager.getMessage(uid,guildId.replace("id",""));
            if(!message){
              message = "{channel} went LIVE with {game}! Check them out at {url}";
            }
            message = message.replace("{url}",`https://twitch.tv/${channel}`).replace("{game}",game).replace("{channel}",name.replace("_","\\_")).replace("{title}",title).replace("{everyone}","@everyone");
            const perm = checkPerms(discordChannel.id,discordChannel.guild);
            if(perm !== CANT_SEND){
			  let messages = await discordChannel.messages.fetch();
			  let mentions = message.match(/<?@[&!]?(?:\d+>|here|everyone)/i);
			  if(mentions == null) {
				mentions = [];
			  }
			  messages = messages.filter((msg) => {
				return msg.createdTimestamp >= Date.parse(startedAt) && (mentions.length == 0 || mentions.some(element => msg.content.includes(element))) && msg.content.includes(`https://twitch.tv/${channel}`);
			  });
			  if(messages.size == 0) {
				discordChannel.send(message);
				notifications.push(discordChannel.id);
			  }
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

async function testMessage(twitchChannel,channel){
  if(channel && channel.isText()){
    let message = await discordManager.getMessage(await cacheManager.uid(twitchChannel),channel.guild.id);
    if(!message){
      message = "{channel} went LIVE with {game}! Check them out at {url}";
    }
    message = message.replace("{url}",`https://twitch.tv/${twitchChannel}`).replace("{game}","Test Game").replace("{channel}",twitchChannel.replace("_","\\_")).replace("{title}","Test Message").replace("{everyone}","@everyone");
    const postChannel = await discordManager.getChannel(await cacheManager.uid(twitchChannel),channel.guild.id);
    const perm = checkPerms(postChannel,channel.guild);
    let permResult = "";
    if(perm === CAN_SEND){
      permResult = ":white_check_mark: Can Send Messages\n";
    }
    else if(perm === CANT_EMBED){
      permResult = ":warning: Links won't be embeded\n";
    }
    else if(perm === CANT_SEND){
      permResult = ":x: Can't send Messages\n"
    }
    channel.send(permResult+message,{disableMentions:"all"});
  }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function parseDiscordCommand(msg) {
  const cmd = msg.content.toUpperCase().replace(prefix.toUpperCase(), "");

  if(msg.author.bot === true) {
    return;
  }

  if(msg.author.id === process.env.OWNER_ID && processOwnerCommands(msg)){
    return;
  }

  if (msg.channel.type === "DM"){
    // We should always have send message perms in a DM.
    msg.channel.send(":x: This command must be used in a server.");
    return;
  }

  if(!msg.guild.me.permissionsIn(msg.channel).has(['VIEW_CHANNEL','SEND_MESSAGES'])){
    // We can't send in this channel
    if(msg.guild.me.permissionsIn(msg.channel).has('ADD_REACTIONS')){
      // But we can react so indicate the error
      msg.react('⚠️');
    }
    return;
  }

  if(!msg.member.permissionsIn(msg.channel).has("MANAGE_GUILD") && msg.author.id !== process.env.OWNER_ID){
    return;
  }

  if(msg.channel.type !== "GUILD_TEXT"){
    msg.channel.send(":x: This command must be used in a text channel.");
    return;
  }

  if(cmd.startsWith("ADD")) {
    const str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "ADD ", "");
    const args = str.split(" ");
    if(!args[0] || args[0] == prefix.toUpperCase() + "ADD"){
      msg.channel.send(":x: Please specify the twitch channel.");
      return;
    }
    if(!args[1]){
      args[1] = "";
    }
    if(!args[0].match(/[a-z_0-9]{4,25}/i) && args[0] != "*"){
      msg.channel.send(":x: The channel entered is invalid");
        return;
    }
    const id = args[1].replace("<#","").replace(">","");
	if(args[0] == "*") {
		// Wildcard Add
		db.get("DefaultChannel:"+msg.guild.id).then((defaultChannelId) => {
			defaultChannelId = defaultChannelId.replace("id","");
			let channelobj = null;
			if(id) {
			  channelobj = msg.guild.channels.resolve(id);
			}
			if(channelobj === null && defaultChannelId){
			  channelobj = msg.guild.channels.resolve(defaultChannelId);
			  if(channelobj === null){
				msg.channel.send(":warning: The default channel does not exist");
			  }
			}
			if(channelobj === null) {
			  channelobj = msg.channel;
			}
			if(channelobj !== undefined && channelobj !== null && channelobj.isText()) {
			  const channelid = channelobj.id;
			  const perm = checkPerms(channelid,channelobj.guild)
			  if(perm !== CANT_SEND){
				db.addWildDiscord(`${msg.guild.id}`,`${channelid}`).then((result)=>{
				  if(result && perm == CAN_SEND){
					msg.channel.send(`:white_check_mark: Notifications will be sent to <#${channelid}> when anyone (*) goes live`);
				  }
				  else if(result && perm == CANT_EMBED){
					msg.channel.send(`:warning: Notifications will be sent to <#${channelid}> when anyone (*) goes live but links won't be embeded`);
				  }
				}).catch((e) => {
					msg.channel.send(":x: Error adding channels.");
					logger.error(e);
					console.log(e);
				});
			  }
			  else{
				  msg.channel.send(`:x: Please ensure <@${client.user.id}> has permission to send messages in <#${channelid}>. The channels were not added.`);
				}
			}
			else {
			  msg.channel.send(":x: Failed to identify the channel you specified.");
			}
		}).catch((e) => {
			msg.channel.send(":x: Getting default channel. The channels were not added.");
			logger.error(e);
			console.log(e);
		});
	}
	else {
		// Normal Channel Add
		lookupChannel(args[0]).then((resp) => {
		  if(resp === false){
			msg.channel.send(":x: Could not resolve twitch channel.");
			return;
		  }
		  const uid = resp.id;
		  db.get("DefaultChannel:"+msg.guild.id).then((defaultChannelId) => {
			let channelobj = null;
			if(id) {
			  channelobj = msg.guild.channels.resolve(id);
			}
			if(channelobj === null && defaultChannelId){
			  channelobj = msg.guild.channels.resolve(defaultChannelId);
			  if(channelobj === null){
				msg.channel.send(":warning: The default channel does not exist");
			  }
			}
			if(channelobj === null) {
			  channelobj = msg.channel;
			}
			if(channelobj !== undefined && channelobj !== null && channelobj.isText()) {
			  const channelid = channelobj.id;
			  const perm = checkPerms(channelid,channelobj.guild)
			  if(perm !== CANT_SEND){
				discordManager.addChannel(uid,msg.guild.id,channelid).then((result)=>{
				  if(result && perm == CAN_SEND){
					msg.channel.send(`:white_check_mark: Notifications will be sent to <#${channelid}> when ${args[0].toLowerCase()} goes live`);
					cacheManager.update(uid,args[0]);
				  }
				  else if(result && perm == CANT_EMBED){
						msg.channel.send(`:warning: Notifications will be sent to <#${channelid}> when ${args[0].toLowerCase()} goes live but links won't be embeded`);
						cacheManager.update(uid,args[0]);
				  }
				  else{
						msg.channel.send(`:x: Not enough space to add ${args[0].toLowerCase()}, use ${prefix}availablelist to list the channels that can be added.`);
				  }
				}).catch((e) => {
					msg.channel.send(":x: Error adding channel.");
					logger.error(e);
					console.log(e);
				});
			  }
			  else{
					msg.channel.send(`:x: Please ensure <@${client.user.id}> has permission to send messages in <#${channelid}>. The channel was not added.`);
				}
			}
			else {
				msg.channel.send(":x: Failed to identify the channel you specified.");
			}
		  }).catch((e) => {
			msg.channel.send(":x: Error getting default channel. The channel was not added.");
			logger.error(e);
			console.log(e);
		  });
		}).catch((e) => {
			msg.channel.send(":x: An Error occured while adding the channel.");
		});
	}
  }
  else if(cmd.startsWith("REMOVE")) {
    const str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "REMOVE ", "");
    if(!str.match(/[a-z_0-9]{4,25}/i) && str != "*"){
		msg.channel.send(":x: The channel entered is invalid");
        return;
    }
	if(str == "*") {
		// Wildcard Remove
		db.removeWildDiscord(`${msg.guild.id}`).then((result) => {
			if(result) {
				msg.channel.send(`:white_check_mark: Notifications will no longer be posted when anyone (*) goes live`);
				return;
			}
			else {
				msg.channel.send(`:white_check_mark: Notifications were not being posted when anyone (*) goes live`);
				return;
			}
		}).catch((e) => {
			logger.error(e);
			console.error(e);
			msg.channel.send(`:x: An Error occured while removing the channel`);
			return;
		});
	}
	else {
		// Normal Channel Remove
		cacheManager.uid(str.toLowerCase()).then((uid) => {
		  if(uid == null){
			msg.channel.send(`:white_check_mark: Notifications were not being posted when ${str.toLowerCase()} goes live`);
			return;
		  }
		  discordManager.removeAll(uid,msg.guild.id).then((result) => {
			if(result){
			  msg.channel.send(`:white_check_mark: Notifications will no longer be posted when ${str.toLowerCase()} goes live`);
			}
			else{
				msg.channel.send(":x: Could not remove Channel");
			}
		  }).catch((e) => {
			msg.channel.send(":x: Error removing channel. The channel was not removed.");
			logger.error(e);
			console.log(e);
		  });
		}).catch((e) => {
			msg.channel.send(":x: Error resolving channel. The channel was not removed.");
			logger.error(e);
			console.log(e);
		});
	}
  }
  else if(cmd.startsWith("IGNORE")) {
	const str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "IGNORE ", "");
    const args = str.split(" ");
    if(!args[0] || args[0] == prefix.toUpperCase() + "IGNORE"){
      msg.channel.send(":x: Please specify the twitch channel.");
      return;
    }
    if(!args[1]){
      args[1] = "";
    }
    if(!args[0].match(/[a-z_0-9]{4,25}/i)){
      msg.channel.send(":x: The channel entered is invalid");
        return;
    }
	lookupChannel(args[0]).then((resp) => {
	  if(resp === false){
		msg.channel.send(":x: Could not resolve twitch channel.");
		return;
	  }
	  const uid = resp.id;
	  db.ignoreDiscord(uid,`${msg.guild.id}`).then((result) => {
		  msg.channel.send(`:white_check_mark: Now ignoring notifications from ${args[0].toLowerCase()}`);
		  cacheManager.update(uid,args[0]);
	  }).catch((e) => {
		  msg.channel.send(":x: An Error occured while ignoring the channel.");
		  logger.error(e);
		  console.error(e);
	  });
	}).catch((e) => {
		msg.channel.send(":x: An Error occured while ignoring the channel.");
	});
  }
  else if (cmd.startsWith("UNIGNORE")) {
	const str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "UNIGNORE ", "");
    if(!str.match(/[a-z_0-9]{4,25}/i) || str == "*"){
		msg.channel.send(":x: The channel entered is invalid");
        return;
    }
	cacheManager.uid(str.toLowerCase()).then((uid) => {
	  if(uid == null){
		msg.channel.send(`:x: ${str.toLowerCase()} was not being ignored.`);
		return;
	  }
	  discordManager.removeAll(uid,msg.guild.id).then((result) => {
		if(result){
		  msg.channel.send(`:white_check_mark: No longer ignoring notifications from ${str.toLowerCase()}`);
		}
		else{
			msg.channel.send(":x: Could not unignore channel");
		}
	  }).catch((e) =>{
		  msg.channel.send(":x: An Error occured while unignoring the channel.");
		  logger.error(e);
		  console.error(e)
	  });
	}).catch((e) => {
		msg.channel.send(":x: An Error occured while unignoring the channel.");
		logger.error(e);
		console.error(e);
	});
  }
  else if(cmd.startsWith("MSG") || cmd.startsWith("MESSAGE")){
    const str = msg.content.toUpperCase().replace(new RegExp(`${escapeRegExp(prefix)}(?:msg |message )`,'i'), "");
    const args = str.split(" ");
    if(!args[0] || (new RegExp(`${escapeRegExp(prefix)}(?:msg |message )`,'i')).test(args[0])){
      msg.channel.send(":x: Please specify the twitch channel.");
      return;
    }
    if(!args[0].match(/[a-z_0-9]{4,25}/i)){
      msg.channel.send(":x: The channel entered is invalid");
        return;
    }
    cacheManager.uid(args[0].toLowerCase()).then((uid) => {
      discordManager.getChannel(uid,msg.guild.id).then(channel => {
        if(channel === undefined){
          msg.channel.send(":x: This Channel is not linked with this server. The message was not changed.");
          return;
        }
        if(uid == process.env.OWNER_CHANNEL && msg.author.id !== process.env.OWNER_ID){
          msg.channel.send(":x: Only the bot owner can change the message for this channel");
          return;
        }
        const message = msg.content.replace(new RegExp(`${escapeRegExp(prefix)}(?:msg|message) [a-z_0-9]{4,25} ?`,'i'),"");
        if(message){
          discordManager.addMessage(uid,msg.guild.id,message.trim()).then((result)=>{
            if(result){
              msg.channel.send(`:white_check_mark: Notifications for ${args[0].toLowerCase()} will now read '${message}'`);
            }
            else{
              msg.channel.send(":x: Could not set message");
            }
          }).catch((e) => {
			msg.channel.send(":x: Error setting message. The message was not changed.");
			logger.error(e);
			console.log(e);
		  });
        }
        else{
          discordManager.removeMessage(uid,msg.guild.id,message.trim()).then((result)=>{
            if(result){
              discordManager.getMessage(uid,msg.guild.id).then((message)=>{
                if(message){
                  msg.channel.send(`:white_check_mark: Notification Message Reset to server default for ${args[0].toLowerCase()}`);
                }
                else{
                  msg.channel.send(`:white_check_mark: Notification Message Reset for ${args[0].toLowerCase()}`);
                }
			  }).catch((e) => {
				msg.channel.send(":x: Error getting server default message. The message was changed.");
				logger.error(e);
				console.log(e);
			  });
            }
            else{
              msg.channel.send(":x: Could not reset message");
            }
          }).catch((e) => {
			msg.channel.send(":x: Error resetting message. The message was not changed.");
			logger.error(e);
			console.log(e);
		  });
        }
      }).catch((e) => {
		msg.channel.send(":x: Error fetching channel. The message was not changed.");
		logger.error(e);
		console.log(e);
	  });
    }).catch((e) =>{
		msg.channel.send(":x: Error resolving channel. The message was not changed.");
		logger.error(e);
		console.log(e);
	});
  }
  else if(cmd.startsWith("DEFAULTCHANNEL")){
    const str = msg.content.replace(new RegExp(`${escapeRegExp(prefix)}defaultchannel ?`,'i'),"");
    const args = str.split(" ");
    if(!args[0]){
      args[0] = "";
    }
    const id = args[0].replace("<#","").replace(">","");
    if(id === "") {
      db.removeDefaultChannel(`${msg.guild.id}`).then(()=> {
        msg.channel.send(":white_check_mark: Default channel cleared.")
      }).catch((e) => {
		msg.channel.send(":x: Error clearing the default channel.");
		logger.error(e);
		console.log(e);
	  });
    }
    else {
      const channelobj = msg.guild.channels.resolve(id);
      if(channelobj !== undefined && channelobj.isText()) {
        const channelid = channelobj.id;
        const guildid = channelobj.guild.id;
        const perm = checkPerms(channelid,channelobj.guild);
        if(perm !== CANT_SEND){
          db.addDefaultChannel(`${guildid}`,`${channelid}`).then(() => {
            if(perm == CAN_SEND){
              msg.channel.send(`:white_check_mark: Default channel set to <#${channelid}>`);
            }
            else if(result && perm == CANT_EMBED){
              msg.channel.send(`:warning: Default channel set to <#${channelid}> but links won't be embeded`);
            }
          }).catch((e) => {
			msg.channel.send(":x: Error setting default. The default channel was not set.");
			logger.error(e);
			console.log(e);
		  });
        }
        else{
          msg.channel.send(`:x: Please ensure <@${client.user.id}> has permission to send messages in <#${channelid}>. The default channel was not set.`);
        }
      }
    }
  }
  else if(cmd.startsWith("DEFAULT")){
    const message = msg.content.replace(new RegExp(`${escapeRegExp(prefix)}default ?`,'i'),"");
    if(message){
      discordManager.addDefault(msg.guild.id,message.trim()).then((result)=>{
        if(result){
          msg.channel.send(`:white_check_mark: Default Notifications will now read '${message}'`);
        }
        else{
          msg.channel.send(":x: Could not add default");
        }
      }).catch((e) => {
		msg.channel.send(":x: Error setting default message. The default message was not changed.");
		logger.error(e);
		console.log(e);
	  });
    }
    else{
      discordManager.removeDefault(msg.guild.id).then((result)=>{
        if(result){
          msg.channel.send(`:white_check_mark: Default Notification Message Reset`);
        }
        else{
          msg.channel.send(":x: Could not reset default");
        }
      }).catch((e) => {
		msg.channel.send(":x: Error resetting default message. The default message was not changed.");
		logger.error(e);
		console.log(e);
	  });
    }
  }
  else if(cmd.startsWith("LIST")){
    const funct = async () => {
      const guildId = msg.guild.id;
      let s = "";
	  let ignoreList = "";
	  try {
		  const keys = await db.list("Discord");
		  for(key of keys){
			const guilds = await db.get(`Discord:${key}`);
			if(!guilds[`id${guildId}`]) continue;
			if(key == "*") continue;
			if(`${key}`.startsWith("^")) {
				const name = (await cacheManager.name(key.substring(1))).replace("_","\\_");
				ignoreList += `${name}\n`;
			}
			else {
				const channel = await discordManager.getChannel(key,guildId);
				if(channel !== undefined){
				  const name = (await cacheManager.name(key)).replace("_","\\_");
				  const msg  = await discordManager.getMessage(key,guildId,false);
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
		  console.log(e);
	  }
      msg.channel.send(s);
    };
    funct();
  }
  else if(cmd.startsWith("HELP")){
    const str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "HELP ", "");
    const args = str.split(" ");
    const helpEmbed = help(args[0]);
    msg.channel.send({ embeds: [helpEmbed]});
  }
  else if(cmd.startsWith("TESTMSG") || cmd.startsWith("TSTMSG") || cmd.startsWith("TESTMESSAGE") || cmd.startsWith("TSTMESSAGE")){
    const str = msg.content.toUpperCase().replace(new RegExp(`${escapeRegExp(prefix)}(?:te?stmsg |te?stmessage )`,'i'), "");
    const args = str.split(" ");
    if(!args[0] || args[0].match(new RegExp(`${escapeRegExp(prefix)}(?:te?stmsg|te?stmessage)`,'i'))){
      msg.channel.send(":x: Please specify the twitch channel.");
      return;
    }
    if(!args[0].match(/[a-z_0-9]{4,25}/i)){
      msg.channel.send(":x: The channel entered is invalid");
        return;
    }
    cacheManager.uid(args[0].toLowerCase()).then((uid) => {
      discordManager.getChannel(uid,msg.guild.id).then(channel => {
        if(channel === undefined){
          msg.channel.send(":x: This Channel is not linked with this server.");
          return;
        }
        testMessage(args[0].toLowerCase(),msg.channel);
      }).catch((e) => {
		msg.channel.send(":x: Error getting test message.");
		logger.error(e);
		console.log(e);
	  });
    }).catch((e) => {
		msg.channel.send(":x: Error resolving channel.");
		logger.error(e);
		console.log(e);
	});
  }
  else if(cmd.startsWith("AVAILABLELIST") || cmd.startsWith("ALIST") || cmd.startsWith("AL")){
    const funct = async () => {
      const guildId = msg.guild.id;
      let s = "";
	  try {
		  const keys = await db.list("Discord");
		  for(key of keys){
			const channel = await discordManager.getChannel(key,guildId);
			const name = await cacheManager.name(key);
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
		  s += `They can be added with ${prefix}add`;
	  }
	  catch(e) {
		s = ":x: Error getting list of available channels";
		logger.error(e);
		console.error(e);
	  }
      msg.channel.send(s,{split:true});
    };
    funct();
  }
}

function processOwnerCommands(msg){
  const cmd = msg.content.toUpperCase().replace(prefix.toUpperCase(), "");

  if(cmd.startsWith("BL")) {
	if (msg.channel.type !== "DM"){
      if(!msg.guild.me.permissionsIn(msg.channel).has(['VIEW_CHANNEL','SEND_MESSAGES'])){
        // We can't send in this channel
        if(msg.guild.me.permissionsIn(msg.channel).has('ADD_REACTIONS')){
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
	if (msg.channel.type !== "DM"){
      if(!msg.guild.me.permissionsIn(msg.channel).has(['VIEW_CHANNEL','SEND_MESSAGES'])){
        // We can't send in this channel
        if(msg.guild.me.permissionsIn(msg.channel).has('ADD_REACTIONS')){
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
    if (msg.channel.type !== "DM"){
      if(!msg.guild.me.permissionsIn(msg.channel).has(['VIEW_CHANNEL','SEND_MESSAGES'])){
        // We can't send in this channel
        if(msg.guild.me.permissionsIn(msg.channel).has('ADD_REACTIONS')){
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
    if (msg.channel.type !== "DM"){
      if(!msg.guild.me.permissionsIn(msg.channel).has(['VIEW_CHANNEL','SEND_MESSAGES'])){
        // We can't send in this channel
        if(msg.guild.me.permissionsIn(msg.channel).has('ADD_REACTIONS')){
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
    if (msg.channel.type !== "DM"){
      if(!msg.guild.me.permissionsIn(msg.channel).has(['VIEW_CHANNEL','SEND_MESSAGES'])){
        // We can't send in this channel
        if(msg.guild.me.permissionsIn(msg.channel).has('ADD_REACTIONS')){
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
	if (msg.channel.type !== "DM"){
      if(!msg.guild.me.permissionsIn(msg.channel).has(['VIEW_CHANNEL','SEND_MESSAGES'])){
        // We can't send in this channel
        if(msg.guild.me.permissionsIn(msg.channel).has('ADD_REACTIONS')){
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
    client.user.setPresence({ activities: [{ name: `for live channels - ${prefix}help`, type: 'WATCHING'}], status: 'online' });
    client.users.fetch(process.env.OWNER_ID).then((user) => {
      user.createDM().then((channel) => {
        db.setLogger(channel);
      }).catch((e)=>{logger.error(e)});
    }).catch((e)=>{logger.error(e)});
	  
	  //Initiate the twitch fetch loop
	  start();
	}
	else {
	  logger.log("Discord client re-connected successfully.");
	  getLive();
	}

  if(errMsg != "") {
    client.users.fetch(process.env.OWNER_ID).then((user) => {
      user.createDM().then((channel) => {
        channel.send(`**ERROR:** ${errMsg}`);
        errMsg = "";
      }).catch((e)=>{logger.error(e)});
    }).catch((e)=>{logger.error(e)});
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
    errMsg = "Discord client disconnected with reason: " + event.reason + " (" + event.code + ").";

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
  errMsg = `Discord client error '${err.code}' (${err.message}).`;
	clearInterval(interval);
	client.destroy();
	setTimeout(() => { client.login(); }, 6000);
});

client.on('interactionCreate', interaction => {
	if (!interaction.isCommand()) return;
	console.log(interaction);
});

client.on("messageCreate", (msg) => {
	if(msg.author !== client.user) {
	  if(msg.content.toUpperCase().startsWith(prefix.toUpperCase())) {
		  if(msg.content.toUpperCase() === `${prefix.toUpperCase()}PING`){
			const pingA = Date.now() - msg.createdTimestamp;
			msg.channel.send(':information_source: Pong!').then((message) =>{
			  const pingB = Date.now() - message.createdTimestamp;
			  const pingAB = pingA + pingB;
			  message.edit(`:information_source: Pong! - Time taken **${pingAB}ms**`);
			});
		  }
		  else{
				parseDiscordCommand(msg);
		  }
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
	twitch.defaults.headers.common['Client-ID'] = clientId;
	getLive();
}

//client.on("debug", debugLogger.log);

logger.log("Attempting Discord Login");
client.login(process.env.DISCORD_TOKEN);
