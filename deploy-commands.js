const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

const clientId = process.env.DISCORD_CLIENT;
const guildId = process.env.DISCORD_GUILD;
const token = process.env.DISCORD_TOKEN;

const commands = [
	{
    name: 'test',
    description: 'A test command',
    options: [
      {
        type: "CHANNEL",
        name: "channel",
        description: "Channel to post in",
        required: true
      }
    ],
  }
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
	try {
		await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log('Successfully registered application commands.');
	} catch (error) {
		console.error(error);
	}
})();