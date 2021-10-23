const {MessageEmbed} = require("discord.js");

const prefix = process.env.DISCORD_PREFIX;

const helpEmbed = new MessageEmbed()
    .setTitle('Commands for GoLive')
	  .addFields(
		  {name:`${prefix}add <twitch channel> [discord channel]`,value:"Start receiving notifications when the channel goes live",inline:true},
		  {name:`${prefix}remove <twitch channel>`,value:"Stop receiving notifications for the channel",inline:true},
		  {name:`${prefix}message <twitch channel> [notification message]`,value:"Set or reset the notification message for the channel",inline:true},
		  {name:`${prefix}list`,value:"List the channels the server is currently receiving notifications for",inline:true},
      {name:`${prefix}help [command]`,value:"Shows this help message",inline:true},
      {name:`${prefix}testmessage <twitch channel>`,value:"Sends the current message for the channel with mentions disabled",inline:true},
      {name:`${prefix}default [notification message]`,value:"Set or reset the default notification message for the server",inline:true},
      {name:`${prefix}availablelist`,value:"List the channels that can be added to the server.",inline:true},
      {name:`${prefix}defaultchannel [discord channel]`,value:"Set or reset the default channel to use when adding channels if no channel is given",inline:true}
	  )
	  .setFooter("Don't add the <> or [] to the command");

const msgEmbed = new MessageEmbed()
    .setColor([214,25,25])
    .setTitle("Message Variables")
    .setDescription("Custom messages can be set on a per-channel basis. A number of variables are supported and are listed below.\nThe default message is:{channel} went LIVE with {game}! Check them out at {url}")
    .addFields(
      {name:"{channel}",value:"The streamer's display name.\nNOTE: When testing the message this variable will represent the streamer's username.",inline:true},
      {name:"{everyone}",value:"@everyone",inline:true},
      {name:"{game}",value:"The game being streamed. Also referred to as the category.",inline:true},
      {name:"{title}",value:"The title of the stream.",inline:true},
      {name:"{url}",value:"Link to the channel.",inline:true}
    );

function getMessage(cmd){
  cmd = cmd.toUpperCase();
  if(cmd.startsWith("MSG") || cmd.startsWith("MESSAGE")){
    return msgEmbed;
  }
  return helpEmbed;
}

module.exports = getMessage;