const db = require('./sqlDatabase.js');
const { PermissionsBitField, ChannelType } = require('discord.js');
const twitch = require('./api.js');
const discordManager = require('./discordManager.js');
const cacheManager = require('./cacheManager.js');

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
  const resp = await twitch.get(`search/channels?query=${channelName}&first=1`);
  if(resp.data.data[0] && resp.data.data[0].broadcaster_login == channelName.toLowerCase()){
    const bl = await db.get("bl");
    if(bl.includes(Number(resp.data.data[0].id))){
      throw new Error("Bl");
    }
    return resp.data.data[0];
  }
  return false;
};

const testMessage = async (twitchChannel, channel) => {
  if (channel && channel.type === ChannelType.GuildText) {
    let message = await discordManager.getMessage(await cacheManager.uid(twitchChannel), channel.guild.id);
    if (!message) {
      message = "{channel} went LIVE with {game}! Check them out at {url}";
    }
    message = message.replace("{url}", `https://twitch.tv/${twitchChannel}`).replace("{game}", "Test Game").replace("{channel}", twitchChannel.replace("_", "\\_")).replace("{title}", "Test Message").replace("{everyone}", "@everyone");
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

module.exports = {
	lookupChannel,
	checkPerms,
	PermissionFlags: {
		CANT_SEND,
		CANT_EMBED,
		CAN_SEND,
	},
	testMessage,
};
