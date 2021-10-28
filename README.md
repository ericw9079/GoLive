# GoLive
Reliable discord notifications when streamers go live on Twitch.
Check out the live channels at: https://GoLive.epicboy.repl.co
## Features
* Ability to set custom messages per streamer
* Ability to set a custom server default message to use unless another message is set for the streamer
* Global default message used if no custom message set
* 5 min cooldown after a streamer goes offline before another message will be sent
* Ability to set a default channel to use when adding streamers without specifing the channel
* Ability to test the message for a streamer

## Usage
Arguments wrapped in <> are required while arguments wrapped in [] are optional.

### Add a streamer:
```
gl!add <streamer twitch name> [discord channel]
```
If discord channel is ommitted then the the channel the command was run in is used, unless a default channel has been set.
If the bot doesn't have permission to send messages in the channel specified then the streamer **WILL NOT** be added.
If the bot is at capacity and the channel is not already being monitored it **WILL NOT** be added.

### Removing a streamer:
```
gl!remove <streamer twitch name>
```

### Changing a message
```
gl!msg <streamer twitch name> [new message]
```
or
```
gl!message <streamer twitch name> [new message]
```
If new message is ommitted then the streamer specific message is cleared and either the server default or the global default will be used next time they go live.

### Setting a default message
```
gl!default [new message]
```
If new message is ommitted then the default message for the server is cleared and the global default will be used for all streamers who don't have a custom message set

### Setting a default channel
```
gl!defaultchannel [discord channel]
```
If discord channel is ommitted then the default channel is cleared.

### Test a message
```
gl!testmessage <streamer twitch name>
```
or
```
gl!testmsg <streamer twitch name>
```
The test message will be sent in the channel the command is run, it will also include whether the bot has permission to post in the set channel and all pings will be disabled.

### List added streamers
```
gl!list
```
will list all the streamers the server is currently receiving notifications for, where those notifications are posted, and if there's a custom message set.

### List availible streamers to add
```
gl!availiblelist
```
or
```
gl!alist
```
will list all the streamers the bot is monitoring that the server is not receiving notifications for. This command will also tell you if the bot is able to support more streamers.
