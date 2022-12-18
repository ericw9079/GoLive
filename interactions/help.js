const help = require("../help");
/**
 * Help command for GoLive
 * © ericw9079 2022
 */
module.exports = (interaction) => {
	const topic = interaction.options.getString('topic');
	const helpEmbed = help(topic ?? '');
	interaction.reply({ embeds: [helpEmbed]});
}