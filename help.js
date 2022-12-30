const {EmbedBuilder} = require("discord.js");

const prefix = process.env.DISCORD_PREFIX;

const helpEmbed = new EmbedBuilder()
    .setTitle('Commands for GoLive')
	.addFields(
		{ name: '/add all [discord channel]', value: 'Start receiving notifications when any monitored channel goes live', inline: true },
		{ name: '/add channel <twitch channel> [discord channel]', value: 'Start receiving notifications when the channel goes live', inline: true },
		{ name: '/default channel [discord channel]', value: 'Set or reset the default channel to use when adding channels if no channel is given', inline: true },
		{ name: '/default message [notification message]', value: 'Set or reset the default notification message for the server', inline: true },
		{ name: '/help [command]', value: 'Shows this help message', inline: true },
		{ name: '/ignore <twitch channel>', value: 'Prevent the given channel from sending notifications to the server', inline: true },
		{ name: '/list available', value: "List the channels that can be added to the server.", inline: true },
		{ name: '/list current', value: "List the channels the server is currently receiving notifications for", inline: true },
		{ name: '/message set <twitch channel> [notification message]', value: "Set or reset the notification message for the channel", inline: true },
		{ name: '/message test <twitch channel>', value: "Sends the current message for the channel with mentions disabled", inline: true },
		{ name: '/remove all', value: 'Stop receiving notifications when any monitored channel goes live', inline: true },
		{ name: '/remove channel <twitch channel>', value: 'Stop receiving notifications when the channel goes live', inline: true },
		{ name: '/unignore <twitch channel>', value: 'Allow notifications from the given channel to be sent to the server', inline: true },
	)
	.setFooter({ text: "Don't add the <> or [] to the command" });

const msgEmbed = new EmbedBuilder()
    .setColor([214,25,25])
    .setTitle("Message Variables")
    .setDescription("Custom messages can be set on a per-channel basis. A number of variables are supported and are listed below.\nThe default message is:{channel} went LIVE with {game}! Check them out at {url}")
    .addFields(
      { name: "{channel}", value: "The streamer's display name.\nNOTE: When testing the message this variable will represent the streamer's username.",inline:true},
      { name: "{everyone}", value: "@everyone", inline:true },
      { name: "{game}", value: "The game being streamed. Also referred to as the category.", inline:true },
      { name: "{title}", value: "The title of the stream.", inline:true },
      { name: "{url}", value: "Link to the channel.", inline:true }
    );

const ignoreEmbed = new EmbedBuilder()
	.setColor([59, 235, 247])
	.setTitle('Ignore/Unignore')
	.setDescription('Manage which channels will send notifications to the server. Useful for preventing notifications from a particular channel when subscribed to all channels with `/add all`')
	.addFields(
		{ name: '/ignore', value: 'Ignore when a channel goes live. Notifications will not be sent to the server when the channel goes live' },
		{ name: '/unignore', value: 'Undoes /ignore. If the server should recieve notifications they will be sent to the server the next time the channel goes live'}
	);

function getMessage(cmd){
  cmd = cmd.toUpperCase();
  if (cmd.startsWith('MSG') || cmd.startsWith('MESSAGE')) {
    return msgEmbed;
  }
  if (cmd.startsWith('IGNORE')) {
	return ignoreEmbed;
  }
  return helpEmbed;
}

module.exports = getMessage;