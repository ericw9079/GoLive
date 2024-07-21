const { REST, Routes, PermissionsBitField, SlashCommandBuilder, ChannelType } = require('discord.js');
const { Timing, Event } = require('./enums');
require('dotenv').config();

const clientId = process.env.DISCORD_CLIENT;
const token = process.env.DISCORD_TOKEN;

const commands = [
	new SlashCommandBuilder()
		.setName('add')
		.setDescription('Start receiving notifications when a channel goes live')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
		.addSubcommand(subcommand => 
			subcommand
				.setName('channel')
				.setDescription('Add a specific twitch channel')
				.addStringOption(option => option.setName('twitch_channel').setDescription('Twitch channel to start receiving notifications for').setRequired(true).setMinLength(4).setMaxLength(25))
				.addChannelOption(option => option.setName('discord_channel').setDescription('Discord channel to send notifications in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
		)
		.addSubcommand(subcommand => 
			subcommand
				.setName('all')
				.setDescription('Receive notifications for any channel GoLive is monitoring')
				.addChannelOption(option => option.setName('discord_channel').setDescription('Discord channel to send notifications in').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
		),
	new SlashCommandBuilder()
		.setName('remove')
		.setDescription('Stop receiving notifications when a channel goes live')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
		.addSubcommand(subcommand => 
			subcommand
				.setName('channel')
				.setDescription('Remove a specific twitch channel')
				.addStringOption(option => option.setName('twitch_channel').setDescription('Twitch channel to stop receiving notifications for').setRequired(true).setMinLength(4).setMaxLength(25))
		)
		.addSubcommand(subcommand => 
			subcommand
				.setName('all')
				.setDescription("Stop receiving notifications for all channels GoLive is monitoring that aren't explictly added")
		),
	new SlashCommandBuilder()
		.setName('ignore')
		.setDescription('Prevent notifications from being received for a specific channel')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
		.addStringOption(option => option.setName('twitch_channel').setDescription('Twitch channel to ignore notifications for').setRequired(true).setMinLength(4).setMaxLength(25)),
	new SlashCommandBuilder()
		.setName('unignore')
		.setDescription('Allow notifications to be received for a specific channel')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
		.addStringOption(option => option.setName('twitch_channel').setDescription('Twitch channel to ignore notifications for').setRequired(true).setMinLength(4).setMaxLength(25)),
	new SlashCommandBuilder()
		.setName('message')
		.setDescription('Configure a channels message')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('set')
				.setDescription('Set the notification message for a channel')
				.addStringOption(option => option.setName('twitch_channel').setDescription('Twitch channel to set the message for').setRequired(true).setMinLength(4).setMaxLength(25))
				.addStringOption(option => option.setName('message').setDescription('Notification Message. Ommit to reset'))
				.addStringOption(option => option.setName('timing').setDescription('Time of day the notification message should be used').setChoices(Object.values(Timing).map((e) => ({ name: e, value: e }))))
				.addStringOption(option => option.setName('event').setDescription('Which event the message should be used for').setChoices(Object.values(Event).map((e) => ({ name: e, value: e }))))
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('test')
				.setDescription('Test the notification message for a channel')
				.addStringOption(option => option.setName('twitch_channel').setDescription('Twitch channel to ignore notifications for').setRequired(true).setMinLength(4).setMaxLength(25))
				.addStringOption(option => option.setName('timing').setDescription('Time of day to simulate').setChoices(Object.values(Timing).map((e) => ({ name: e, value: e }))))
				.addStringOption(option => option.setName('event').setDescription('Event to simulate').setChoices(Object.values(Event).map((e) => ({ name: e, value: e }))))
		),
	new SlashCommandBuilder()
		.setName('default')
		.setDescription('Configure a server default')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('channel')
				.setDescription('Set the default channel for notifications to be sent to if no channel is specified')
				.addChannelOption(option => option.setName('discord_channel').setDescription('Discord channel to default to. Ommit to clear').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('message')
				.setDescription('Set the default server notification message for channels without their own message')
				.addStringOption(option => option.setName('message').setDescription('Default Notification Message. Ommit to clear'))
		),
	new SlashCommandBuilder()
		.setName('list')
		.setDescription('List channels')
		.setDMPermission(false)
		.setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('current')
				.setDescription('List the channels notifications are currently being received for')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('available')
				.setDescription('List the channels that could be added')
		),
	new SlashCommandBuilder()
		.setName('help')
		.setDescription('Get Help')
		.setDMPermission(true)
		.setDefaultMemberPermissions(undefined)
		.addStringOption(option => option.setName('topic').setDescription('Specific help topic').addChoices({ name: 'Message', value: 'message'}, { name: 'Ignore/Unignore', value: 'ignore'})),
	new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Ping.......Pong')
		.setDMPermission(true)
		.setDefaultMemberPermissions(undefined),
]
	.map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
	try {
		await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);

		console.log('Successfully registered application commands.');
	} catch (error) {
		console.error(error);
	}
})();