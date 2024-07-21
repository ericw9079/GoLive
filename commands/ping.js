const { get } = require('../sqlDatabase.js');

/**
 * Ping command for GoLive
 * © ericw9079 2022
 */
module.exports = async (interaction) => {
	const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
	let dbStatus;
	try {
		dbStatus = await Promise.race([
			(
				async () => {
					const response = await get('statusCheck');
					if (response) {
						return 'Responsive'
					}
				}
			)(),
			new Promise((resolve) => {
				setTimeout(resolve, 15000, 'Unresponsive');
			}),
		]);
	} catch {
		dbStatus = 'Unresponsive';
	}
	await interaction.editReply(`:ping_pong: Pong!\n:sparkling_heart: Websocket heartbeat: ${interaction.client.ws.ping}ms.\n:round_pushpin: Rountrip Latency: ${sent.createdTimestamp - interaction.createdTimestamp}ms\n:cd: Database: ${dbStatus}`);
}