const db = require('./sqlDatabase.js');
const { PermissionsBitField, ChannelType } = require('discord.js');
const { DateTime } = require("luxon");
const twitch = require('@ericw9079/twitch-api');
const discordManager = require('./discordManager.js');
const cacheManager = require('./cacheManager.js');
const { format } = require('./messageFormatter.js');
const { Event, Timing } = require('./enums');

const CANT_SEND = 0;
const CANT_EMBED = -1;
const CAN_SEND = 1;

const checkPerms = (channel,guild) => {
  const perms = guild.members.me.permissionsIn(channel);
    if(perms.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks])){
      return CAN_SEND;
    }
    if(perms.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages])){
      return CANT_EMBED;
    }
    return CANT_SEND;
};

const lookupChannel = async (channelName) => {
  const { data } = await twitch.get(`search/channels?query=${channelName}&first=1`);
  if(data.data[0] && data.data[0].broadcaster_login == channelName.toLowerCase()){
    const bl = await db.get("bl");
    if(bl.includes(Number(data.data[0].id))){
      throw new Error("Bl");
    }
    return data.data[0];
  }
  return false;
};

const testMessage = async (twitchChannel, channel, eventFor = Event.LIVE, timingOf = Timing.ANYTIME) => {
  if (channel && channel.type === ChannelType.GuildText) {
    let message = await discordManager.getMessage(await cacheManager.uid(twitchChannel), channel.guild.id, eventFor, timingOf);
    if (!message) {
      message = "{channel} went LIVE with {game}! Check them out at {url}";
    }
    message = format(message, {
		channel: twitchChannel,
		game: "Test Game",
		title: "Test Message",
		name: twitchChannel,
	});
    const postChannel = await discordManager.getChannel(await cacheManager.uid(twitchChannel), channel.guild.id);
    const perm = checkPerms(postChannel, channel.guild);
    let permResult = "";
    if (perm === CAN_SEND) {
      permResult = ":white_check_mark: Can Send Messages\n";
    }
    else if (perm === CANT_EMBED) {
      permResult = ":warning: Links won't be embeded\n";
    }
    else if (perm === CANT_SEND) {
      permResult = ":x: Can't send Messages\n"
    }
    return permResult + message;
  }
};

const getTiming = () => {
	const now = DateTime.now().setZone("America/Toronto");;
	if (now.hour > 6) {
		return Timing.NIGHT;
	}
	if (now.hour > 12) {
		return Timing.MORNING;
	}
	if (now.hour > 7) {
		return Timing.AFTERNOON;
	}
	return Timing.NIGHT;
};

module.exports = {
	lookupChannel,
	checkPerms,
	PermissionFlags: {
		CANT_SEND,
		CANT_EMBED,
		CAN_SEND,
	},
	testMessage,
	getTiming,
};
