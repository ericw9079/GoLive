const db = require('./sqlDatabase.js');
const cacheManager = require('./cacheManager.js');
const statusUpdater = require('./statusUpdater.js');


async function addChannel(twitch,guild,channel){
  let channels = await db.list("Discord");
  if(channels.filter((channel)=>!isNaN(channel)).length >= 700 && !channels.includes(twitch)){
    // Rate limit imposed by Twitch
    return false;
  }
  await db.addDiscord(twitch,`${guild}`,`${channel}`);
  return true;
}

async function removeChannel(twitch,discord){
	await db.removeDiscord(twitch,`${discord}`);
	let value = await db.get("Discord:"+twitch);
	console.log(value);
	if(Object.entries(value).length == 0){
		await db.removeLive(`${twitch}`);
		await cacheManager.remove(twitch);
		await statusUpdater.delete(twitch);
	}
	return true;
}

async function addMessage(twitch,guild,message){
	await db.addMessage(twitch,`${guild}`,message);
	return true;
}

async function removeMessage(twitch,discord){
	await db.removeMessage(twitch,`${discord}`);
	return true;
}

async function addDefault(guild,message){
  await db.addDefaultMessage(`${guild}`,message);
  return true;
}

async function removeDefault(discord){
  await db.removeDefaultMessage(`${discord}`);
  return true;
}

async function getMessage(twitch,discord,global=true){
  let value = await db.get("Message:"+twitch);
  if(!discord.startsWith('id')){
    discord = 'id'+discord;
  }
  if(global){
    let global = await db.get("Default"+discord);
    return value[discord]?value[discord]:global;
  }
  return value[discord];
}

async function getChannel(twitch,discord){
  let value = await db.get("Discord:"+twitch);
  if(!discord.startsWith('id')){
    discord = 'id'+discord;
  }
  return value[discord];
}

async function removeAll(twitch,discord){
  let t1 = await removeChannel(twitch,discord);
  let t2 = await removeMessage(twitch,discord);
  return t1 && t2;
}

module.exports = {
  addChannel:addChannel,
  removeChannel:removeChannel,
  addMessage:addMessage,
  removeMessage:removeMessage,
  addDefault:addDefault,
  removeDefault:removeDefault,
  getMessage:getMessage,
  getChannel:getChannel,
  removeAll:removeAll,
}