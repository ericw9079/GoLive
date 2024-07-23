const db = require('./sqlDatabase.js');
const cacheManager = require('./cacheManager.js');
const { Event, Timing } = require('./enums');


const addChannel = async (twitch, guild, channel) => {
  const channels = await db.list("Discord");
  if (channels.filter((channel) => !isNaN(channel)).length >= 700 && !channels.includes(twitch)) {
    // Rate limit imposed by Twitch
    return false;
  }
  await db.addDiscord(twitch,`${guild}`,`${channel}`);
  return true;
};

const removeChannel = async (twitch, discord) => {
	await db.removeDiscord(twitch,`${discord}`);
	const value = await db.get("Discord:" + twitch);
	if (Object.entries(value).length == 0) {
		await db.removeLive(`${twitch}`);
		await cacheManager.remove(twitch);
	}
	return true;
};

const addMessage = async (twitch, guild, message, eventFor = Event.LIVE, timingOf = Timing.ANYTIME) => {
	await db.addMessage(twitch,`${guild}`, message, eventFor, timingOf);
	return true;
};

const removeMessage = async (twitch, discord, eventFor = Event.LIVE, timingOf = Timing.ANYTIME) => {
	await db.removeMessage(twitch, `${discord}`, eventFor, timingOf);
	return true;
};

const addDefault = async (guild, message) => {
  await db.addDefaultMessage(`${guild}`, message);
  return true;
};

const removeDefault = async (discord) => {
  await db.removeDefaultMessage(`${discord}`);
  return true;
};

const getMessage = async (twitch, discord, eventFor = Event.LIVE, timingOf = Timing.ANYTIME, global = true) => {
  const message = await db.getMessage(twitch, `${discord}`, eventFor, timingOf);
  if (message) return message;
  if (global && eventFor === Event.LIVE) {
    const globalMessage = await db.get("Default:" + discord);
    return globalMessage;
  }
  return null;
};

const getChannel = async (twitch, discord) => {
  const value = await db.get("Discord:" + twitch);
  if (!discord.startsWith('id')) {
    discord = 'id' + discord;
  }
  return value[discord];
};

const removeAll = async (twitch, discord) => {
  await removeChannel(twitch, discord);
  await db.removeAllMessages(twitch, `${discord}`);
  return true;
};

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