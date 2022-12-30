const help = require("../help");
/**
 * Help command for GoLive
 * © ericw9079 2022
 */
module.exports = async (interaction) => {
	const topic = interaction.options.getString('topic');
	const helpEmbed = help(topic ?? '');
	await interaction.reply({ embeds: [helpEmbed]});
}