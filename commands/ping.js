/**
 * Ping command for GoLive
 * © ericw9079 2022
 */
module.exports = async (interaction) => {
	const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
	await interaction.editReply(`:ping_pong: Pong!\n:sparkling_heart: Websocket heartbeat: ${interaction.client.ws.ping}ms.\n:round_pushpin: Rountrip Latency: ${sent.createdTimestamp - interaction.createdTimestamp}ms`);
}