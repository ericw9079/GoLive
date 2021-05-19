const axios = require('axios');
const keepAlive = require('./server');
const Discord = require("discord.js");
const client = new Discord.Client();
const db = require("./database");
const discordManager = require("./discordManager");
const help = require("./help");
const logger = require("./logger.js");

discordManager.init(db);

const clientId = process.env.TWITCH_ID;
const clientSecret = process.env.TWITCH_SECRET;
const prefix = process.env.DISCORD_PREFIX;
const botId = process.env.DISCORD_CLIENT;
const botPerms = process.env.DISCORD_PERMS;
const botScopes = process.env.DISCORD_SCOPES;

const OFFLINE = "OFFLINE";
const ONLINE = "ONLINE";

const CANT_SEND = 0;
const CANT_EMBED = -1;
const CAN_SEND = 1;

const DELAY = 60000; // Time between Twitch fetches, in milliseconds
const COOLDOWN = 300000; // cooldown time between state changes (5 min)
//const mentions = /<?@[&!]?(?:\d+>|here|everyone)/i // Regular expression for determing if there was an attempted ping

var firstLogin = 0;
var notifications = [];
var interval;

var cooldowns = new Set();

/*db.list().then(async (keys)=>{
  for(let key in keys){
    let value = await db.get(keys[key],"");
    console.log(keys[key]," => ",value);
  }
});*/

function checkPerms(channel,guild){
  let perms = guild.me.permissionsIn(channel);
    if(perms.has(['VIEW_CHANNEL','SEND_MESSAGES','EMBED_LINKS'])){
      return CAN_SEND;
    }
    if(perms.has(['VIEW_CHANNEL','SEND_MESSAGES'])){
      return CANT_EMBED;
    }
    return CANT_SEND;
}

async function getToken(){
	let res = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`);
	axios.defaults.headers.common['Authorization'] = "Bearer "+res.data.access_token;
	logger.log("Fetched new Access Token");
}

async function checkLive(channel){
	try{
		let res = await axios.head('https://id.twitch.tv/oauth2/validate');
	}
	catch(error){
		await getToken();
	}
	let resp = await axios.get(`https://api.twitch.tv/helix/search/channels?query=${channel}&first=1`);
  let oldStatus = await db.get(`Live:${channel}`,OFFLINE);
  if(oldStatus == null || oldStatus == ""){
    oldStatus = OFFLINE;
  }
  let newStatus = resp.data.data[0].is_live?ONLINE:OFFLINE;
  if(oldStatus == OFFLINE && newStatus == ONLINE && !cooldowns.has(channel)){
    let gameResp = await axios.get(`https://api.twitch.tv/helix/games?id=${resp.data.data[0].game_id}`);
    logger.log("Sending Message");
    sendMessage(channel,gameResp.data.data[0].name,resp.data.data[0].title,resp.data.data[0].display_name);
  }
  if(oldStatus != newStatus){
    logger.log(`${channel} status changed to: `+newStatus);
    cooldowns.add(channel);
    setTimeout((c) => {
      cooldowns.delete(c);
    }, COOLDOWN,channel);
  }
  await db.set(`Live:${channel}`,newStatus);
}

async function getLive(){
  try{
    let channels = await db.list("Discord:");
    for(let channel of channels){
      await checkLive(channel.substring(8));
    }
  }
  catch (e){
    logger.error("Twitch ran into a problem");
    client.users.fetch(process.env.OWNER_ID).then((user) => {
      user.createDM().then((channel) => {
        channel.send(`Twitch ran into a problem:\n${e}`);
      }).catch((e1)=>{logger.error(e1)});
    }).catch((e2)=>{logger.error(e2)});
  }
  interval = setTimeout(getLive,DELAY);
}

async function sendMessage(channel,game,title,name){
  let channels = await db.get(`Discord:${channel}`);
  for(let guildId in channels){
    try{
      let guild = await client.guilds.fetch(guildId.replace("id",""));
      if(guild && guild.available){
        discordChannel = await channels[guildId];
        if(discordChannel){
          discordChannel = guild.channels.resolve(discordChannel);
          if(discordChannel && discordChannel.isText()){
            let message = await discordManager.getMessage(channel,guildId.replace("id",""));
            if(!message){
              message = "{channel} went LIVE with {game}! Check them out at {url}";
            }
            message = message.replace("{url}",`https://twitch.tv/${channel}`).replace("{game}",game).replace("{channel}",name).replace("{title}",title).replace("{everyone}","@everyone");
            let perm = checkPerms(discordChannel.id,discordChannel.guild);
            if(perm !== CANT_SEND){
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

async function testMessage(twitchChannel,channel){
  if(channel && channel.isText()){
    let message = await discordManager.getMessage(twitchChannel,channel.guild.id);
    if(!message){
      message = "{channel} went LIVE with {game}! Check them out at {url}";
    }
    message = message.replace("{url}",`https://twitch.tv/${twitchChannel}`).replace("{game}","Test Game").replace("{channel}",twitchChannel).replace("{title}","Test Message").replace("{everyone}","@everyone");
    let postChannel = await discordManager.getChannel(twitchChannel,channel.guild.id);
    let perm = checkPerms(postChannel,channel.guild);
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

function parseDiscordCommand(msg) {
  var cmd = msg.content.toUpperCase().replace(prefix.toUpperCase(), "");

  if(msg.author.bot === true) {
    return;
  }

  if(msg.author.id === process.env.OWNER_ID && processOwnerCommands(msg)){
    return;
  }

  if (msg.channel.type === "dm"){
    // We should always have send message perms in a dm.
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

  if(msg.channel.type !== "text"){
    msg.channel.send(":x: This command must be used in a text channel.");
    return;
  }

  if(cmd.startsWith("ADD")) {
    let str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "ADD ", "");
    let args = str.split(" ");
    if(!args[0]){
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
    var id = args[1].replace("<#","").replace(">","");

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
        let channelid = channelobj.id;
        let perm = checkPerms(channelid,channelobj.guild)
        if(perm !== CANT_SEND){
          discordManager.addChannel(args[0].toLowerCase(),msg.guild.id,channelid).then((result)=>{
            if(result && perm == CAN_SEND){
              msg.channel.send(`:white_check_mark: Notifications will be sent to <#${channelid}> when ${args[0].toLowerCase()} goes live`);
            }
            else if(result && perm == CANT_EMBED){
              msg.channel.send(`:warning: Notifications will be sent to <#${channelid}> when ${args[0].toLowerCase()} goes live but links won't be embeded`);
            }
            else{
              msg.channel.send(`:x: Not enough space to add ${args[0].toLowerCase()}, use ${prefix}availablelist to list the channels that can be added.`);
            }
          });
        }
        else{
            msg.channel.send(`:x: Please ensure <@${client.user.id}> has permission to send messages in <#${channelid}>. The channel was not added.`);
          }
      }
      else {
        msg.channel.send(":x: Failed to identify the channel you specified.");
      }
    });
  }
  else if(cmd.startsWith("REMOVE")) {
    var str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "REMOVE ", "");
    if(!str.match(/[a-z_0-9]{4,25}/i)){
      msg.channel.send(":x: The channel entered is invalid");
        return;
    }
    discordManager.removeAll(str.toLowerCase(),msg.guild.id).then((result) => {
      if(result){
        msg.channel.send(`:white_check_mark: Notifications will no longer be posted when ${str.toLowerCase()} goes live`);
      }
      else{
          msg.channel.send(":x: Could not remove Channel");
      }
    });
  }
  else if(cmd.startsWith("MSG") || cmd.startsWith("MESSAGE")){
    var str = msg.content.toUpperCase().replace(new RegExp(`${prefix}(?:msg |message )`,'i'), "");
    let args = str.split(" ");
    if(!args[0]){
      msg.channel.send(":x: Please specify the twitch channel.");
      return;
    }
    if(!args[0].match(/[a-z_0-9]{4,25}/i)){
      msg.channel.send(":x: The channel entered is invalid");
        return;
    }
    discordManager.getChannel(args[0].toLowerCase(),msg.guild.id).then(channel => {
      if(channel === undefined){
        msg.channel.send(":x: This Channel is not linked with this server. The message was not changed.");
        return;
      }
      let message = msg.content.replace(new RegExp(`${prefix}(?:msg|message) [a-z_0-9]{4,25} ?`,'i'),"");
      if(message){
        discordManager.addMessage(args[0].toLowerCase(),msg.guild.id,message.trim()).then((result)=>{
          if(result){
            msg.channel.send(`:white_check_mark: Notifications for ${args[0].toLowerCase()} will now read '${message}'`);
          }
          else{
            msg.channel.send(":x: Could not add message");
          }
        });
      }
      else{
        discordManager.removeMessage(args[0].toLowerCase(),msg.guild.id,message.trim()).then((result)=>{
          if(result){
            discordManager.getMessage(str.toLowerCase(),msg.guild.id).then((message)=>{
              if(message){
                msg.channel.send(`:white_check_mark: Notification Message Reset to server default for ${str.toLowerCase()}`);
              }
              else{
                msg.channel.send(`:white_check_mark: Notification Message Reset for ${str.toLowerCase()}`);
              }
            });
          }
          else{
            msg.channel.send(":x: Could not remove message");
          }
        });
      }
    });
  }
  else if(cmd.startsWith("DEFAULTCHANNEL")){
    let str = msg.content.replace(new RegExp(`${prefix}defaultchannel ?`,'i'),"");
    let args = str.split(" ");
    if(!args[0]){
      args[0] = "";
    }
    var id = args[0].replace("<#","").replace(">","");

    if(id === "") {
      db.delete("DefaultChannel:"+msg.guild.id).then(()=> {
        msg.channel.send(":white_check_mark: Default channel cleared.")
      });
    }
    else {
      let channelobj = msg.guild.channels.resolve(id);
      if(channelobj !== undefined && channelobj.isText()) {
        let channelid = channelobj.id;
        let guildid = channelobj.guild.id;
        let perm = checkPerms(channelid,channelobj.guild)
        if(perm !== CANT_SEND){
          db.set("DefaultChannel:"+guildid,"id"+channelid).then(() => {
            if(perm == CAN_SEND){
              msg.channel.send(`:white_check_mark: Default channel set to <#${channelid}>`);
            }
            else if(result && perm == CANT_EMBED){
              msg.channel.send(`:warning: Default channel set to <#${channelid}> but links won't be embeded`);
            }
          });
        }
        else{
          msg.channel.send(`:x: Please ensure <@${client.user.id}> has permission to send messages in <#${channelid}>. The default channel was not set.`);
        }
      }
    }
  }
  else if(cmd.startsWith("DEFAULT")){
    let message = msg.content.replace(new RegExp(`${prefix}default ?`,'i'),"");
    if(message){
      discordManager.addDefault(msg.guild.id,message.trim()).then((result)=>{
        if(result){
          msg.channel.send(`:white_check_mark: Default Notifications will now read '${message}'`);
        }
        else{
          msg.channel.send(":x: Could not add default");
        }
      });
    }
    else{
      discordManager.removeDefault(msg.guild.id).then((result)=>{
        if(result){
          msg.channel.send(`:white_check_mark: Default Notification Message Reset`);
        }
        else{
          msg.channel.send(":x: Could not remove default");
        }
      });
    }
  }
  else if(cmd.startsWith("LIST")){
    let funct = async () => {
      let guildId = msg.guild.id;
      let s = "";
      let keys = await db.list("Discord:")
      for(key of keys){
        let channel = await discordManager.getChannel(key.replace("Discord:",""),guildId);
        if(channel !== undefined){
          let msg = await discordManager.getMessage(key.replace("Discord:",""),guildId,false);
          if(msg){
            s += `${key.replace("Discord:","")} (in <#${channel}> with custom message)\n`;
          }
          else{
            s += `${key.replace("Discord:","")} (in <#${channel}>)\n`;
          }
        }
      }
      if(!s){
        s = "This server is not receiving notifications for any channels";
      }
      else{
        s = "This server is receiving notifications when the following channels go live on twitch:\n"+s;
      }
      msg.channel.send(s)
    };
    funct();
  }
  else if(cmd.startsWith("HELP")){
    let str = msg.content.toUpperCase().replace(prefix.toUpperCase() + "HELP ", "");
    let args = str.split(" ");
    let helpEmbed = help(args[0]);
    msg.channel.send(helpEmbed);
  }
  else if(cmd.startsWith("TESTMSG") || cmd.startsWith("TSTMSG") || cmd.startsWith("TESTMESSAGE") || cmd.startsWith("TSTMESSAGE")){
    var str = msg.content.toUpperCase().replace(new RegExp(`${prefix}(?:te?stmsg |te?stmessage )`,'i'), "");
    let args = str.split(" ");
    if(!args[0] || args[0].match(new RegExp(`${prefix}(?:te?stmsg|te?stmessage)`,'i'))){
      msg.channel.send(":x: Please specify the twitch channel.");
      return;
    }
    if(!args[0].match(/[a-z_0-9]{4,25}/i)){
      msg.channel.send(":x: The channel entered is invalid");
        return;
    }
    discordManager.getChannel(args[0].toLowerCase(),msg.guild.id).then(channel => {
      if(channel === undefined){
        msg.channel.send(":x: This Channel is not linked with this server.");
        return;
      }
      testMessage(args[0].toLowerCase(),msg.channel);
    });
  }
  else if(cmd.startsWith("AVAILABLELIST") || cmd.startsWith("ALIST") || cmd.startsWith("AL")){
    let funct = async () => {
      let guildId = msg.guild.id;
      let s = "";
      let keys = await db.list("Discord:")
      for(key of keys){
        let channel = await discordManager.getChannel(key.replace("Discord:",""),guildId);
        if(channel === undefined){
          s += `> ${key.replace("Discord:","")}\n`;
        }
      }
      if(!s){
        s = "This server is receiving notifications for all the channels GoLive is monitoring";
        if(keys.length < 300){
          s += " and there is space for more.";
        }
        else{
          s += ".";
        }
      }
      else{
        if(keys.length < 300){
          s = "The following channels are being monitored by GoLive and there is space for more:\n"+s;
        }
        else{
          s = "The following channels are being monitored by GoLive and can be added:\n"+s;
        }
      }
      s += `They can be added with ${prefix}add`;
      msg.channel.send(s,{split:true});
    };
    funct();
  }
}

function processOwnerCommands(msg){
  var cmd = msg.content.toUpperCase().replace(prefix.toUpperCase(), "");

  if(cmd.startsWith("PURGE")){
    if (msg.channel.type !== "dm"){
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
    let funct = async () => {
      let s = "";
      let keys = await db.list("Discord:");
      for(key of keys){
        let channel = key.replace("Discord:","");
        let channels = await db.get(key);
        for(let guildId in channels){
          try{
            let guild = await client.guilds.fetch(guildId.replace("id",""));
          }
          catch{
            // The guild is unavailable remove it.
              let result = await discordManager.removeAll(channel,guildId);
              if(result){
                await db.delete("DefaultChannel:"+guildId);
                s += `Purged ${channel} => ${guildId}\n`;
              }
              else{
                s += `Could not Purge ${channel} => ${guildId}\n`;
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
  else if(cmd.startsWith("INVITE")){
    if (msg.channel.type !== "dm"){
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
  return false; // Command not handled revert to main handler
}

client.on("ready", () => {
	if(firstLogin !== 1) {
	  firstLogin = 1;
	  logger.log("Discord client connected successfully.");
    client.user.setActivity(`for live channels - ${prefix}help`,{ type: 'WATCHING' });
    client.users.fetch(process.env.OWNER_ID).then((user) => {
      user.createDM().then((channel) => {
        logger.log("db logger connected");
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

client.on("message", (msg) => {
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
    if (msg.channel.type === 'news' && notifications.includes(msg.channel.id)) {
      msg.crosspost().then(() => logger.log('Crossposted message')).catch(logger.error);
      notifications.splice(notifications.indexOf(msg.channel.id), 1);
    }
  }
});

process.on("exit",  () => {
	client.destroy();
});

function start(){
	axios.defaults.headers.common['Client-ID'] = clientId;
	getLive();
}

keepAlive();

client.login();