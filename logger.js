const {EmbedBuilder} = require('discord.js');
let discordLogger = null;
module.exports = {
	log: function(text){
		let d = new Date();
		console.log(`[${d.toLocaleString("en-CA",{dateStyle:"short",timeStyle:"medium",hour12:false,timeZone:"America/New_York"})}|LOG] `+text);
		if(discordLogger) {
      // Also log in discord via webhook
			discordLogger.send({embeds:[new EmbedBuilder()
				.setTitle("LOG")
				.setColor("#FFFFFF")
				.setDescription(text)
				.setFooter(d.toLocaleString("en-CA",{dateStyle:"short",timeStyle:"medium",hour12:false,timeZone:"America/New_York"}))
			]});
		}
	},
	info: function (text) {
		let d = new Date();
		console.info(`[${d.toLocaleString("en-CA",{dateStyle:"short",timeStyle:"medium",hour12:false,timeZone:"America/New_York"})}|\x1b[96mINFO\x1b[89m\x1b[0m] `+text);
		if(discordLogger) {
      // Also log in discord via webhook
			discordLogger.send({embeds:[new EmbedBuilder()
				.setTitle("INFO")
				.setColor("#183EFA")
				.setDescription(text)
				.setFooter(d.toLocaleString("en-CA",{dateStyle:"short",timeStyle:"medium",hour12:false,timeZone:"America/New_York"}))
			]});
		}
	},
	warn: function (text) {
		let d = new Date();
		console.warn(`[${d.toLocaleString("en-CA",{dateStyle:"short",timeStyle:"medium",hour12:false,timeZone:"America/New_York"})}|\x1b[93mWARN\x1b[39m\x1b[0m] `+text);
		if(discordLogger) {
      // Also log in discord via webhook
			discordLogger.send({embeds:[new EmbedBuilder()
				.setTitle("WARN!")
				.setColor("#FFEB2A")
				.setDescription(text)
				.setFooter(d.toLocaleString("en-CA",{dateStyle:"short",timeStyle:"medium",hour12:false,timeZone:"America/New_York"}))
			]});
		}
	},
	error: function (text) {
		let d = new Date();
		console.error(`[${d.toLocaleString("en-CA",{dateStyle:"short",timeStyle:"medium",hour12:false,timeZone:"America/New_York"})}|\x1b[91mERROR\x1b[39m\x1b[0m] \x1b[91m`+text+`\x1b[39m\x1b[0m`);
		if(discordLogger) {
      // Also log in discord via webhook
			discordLogger.send({embeds:[new EmbedBuilder()
				.setTitle("ERROR!")
				.setColor("#FF160C")
				.setDescription(text)
				.setFooter(d.toLocaleString("en-CA",{dateStyle:"short",timeStyle:"medium",hour12:false,timeZone:"America/New_York"}))
			]});
		}
	},
	init: function (hook) {
		discordLogger = hook;
		if(hook) {
			console.log("Webhook Set");
		}
		else {
			console.log("Webhook Cleared");
		}
	}
}