# GoLive 
Reliable discord notifications when streamers go live on Twitch.  
Check out the live channels at: https://GoLive.ericw.tech  
© 2025 ericw9079
## Features
* Ability to set custom messages per streamer
* Ability to set a custom message depending on the time of day (Opt-in)
* Ability to send a message when the game changes (Opt-in)
* Ability to set a custom server default message to use unless another message is set for the streamer
* Global server default message used if no custom message set
* 5 min cooldown after a streamer goes offline before another message will be sent
* Ability to set a default channel to use when adding streamers without specifying the channel
* Ability to test the message for a streamer
* Ability to receive notifications from all monitored streamers except select streamers
* Supports up to 700 twitch streamers across all servers (limit imposed by twitch)

## Usage
Arguments wrapped in <> are required while arguments wrapped in [] are optional. This is enforced using discords slash commands.

### Add a streamer:
```
/add channel <streamer twitch name> [discord channel]
```
If discord channel is ommitted then the the channel the command was run in is used, unless a default channel has been set.
If the bot doesn't have permission to send messages in the channel specified then the streamer **WILL NOT** be added.
If the bot is at capacity and the channel is not already being monitored it **WILL NOT** be added.

### Adding all streamers:
```
/add all [discord channel]
```
Receive notifications from every monitored streamer who hasn't been explicitly added or ignored.
If discord channel is omitted then the current channel the command was run in is used, unless a default channel has been set.
If the bot doesn't have permission to send messages in the channel specified then the command will fail.

### Ignoring a streamer:
```
/ignore <streamer twitch name>
```
Ignore notifications for a streamer. Useful if you want to receive notifications for all monitored streamers except a select few with `/add all`.
This only silences notifications from the streamer, use `/remove channel` or `/remove all` to stop removing notifications all together.
Silenced notifications will not reach your server at all, it doesn't just disable pings.

### Unignoring a streamer:
```
/unignore <streamer twitch name>
```
Reverses the effect of `/ignore`.
Will **NOT** cause notifications to be delivered unless you are already receiving notifications for all monitored streamers through `/add all`.

### Removing a streamer:
```
/remove channel <streamer twitch name>
```
Stop receiving notifications for a streamer

### Removing all streamers:
```
/remove all
```
Stop receiving notifications from every monitored streamer who hasn't been explicitly added or ignored.
Opposite of `/add all`.
Will have **NO** effect on streamers that have been added with `/add channel`

### Changing a message
```
/message set <streamer twitch name> [new message] [timing] [event]
```
If new message is omitted then the streamer specific message is cleared and either the server default or the global default will be used next time they go live.
Timing specifies the time of day the message will be used. If omitted the message will be used anytime there isn't a more specific message set. If new message is omitted then the message for that time will be cleared. If no other messages are set for a broader time (ie. anytime) then defaults will be used.
Event specifies which event the message will be used for. Either the message will be used when the streamer goes live or when the game changes (but not both). Live notifications are enabled at all times, game changing notifications are enabled when there's a message set for the event, and disabled when no messages have been specifed.

### Setting a default message
```
/default message [new message]
```
If new message is omitted then the default message for the server is cleared and the global default will be used for all streamers who don't have a custom message set.
Only used when a streamer goes live. Explicit messages must be set on a per streamer basis with `/message set` to enable notifications when the game changes.

### Setting a default channel
```
/default channel [discord channel]
```
If discord channel is omitted then the default channel is cleared.

### Test a message
```
/message test <streamer twitch name> [timing] [event]
```
The test message will be sent in the channel the command is run, it will also include whether the bot has permission to post in the set channel and all pings will be disabled.
Timing specifies the time of day to simulate. The message that would be used at that time is used to create the test message. If omitted then the message used when there isn't a more specific message set will be tested.
Event specifies which event to simulate. The message for the event at the specified time will be tested if events are enabled.

### List added streamers
```
/list current
```
will list all the streamers the server is currently receiving notifications for, where those notifications are posted, and if there's a custom message set.

### List available streamers to add
```
/list available
```
will list all the streamers the bot is monitoring that the server is not receiving notifications for. This command will also tell you if the bot is able to support more streamers.

## Timing
Supported timings, in Eastern Time.
- Anytime
	- Used if a message for a more specific time was not set
	- Default
	- Least specific
- Morning
	- 6:00 am to 11:59 am
- Afternoon
	- 12:00 pm to 6:59 pm
- Night
	- 7:00 pm to 5:59 am

## Event
Supported Events for notifications
- Live/Going Live
	- Sent when a streamer goes live
	- Default event
	- Always enabled
- Game/Game Changed
	- Sent when a streamer is live and changes the category/game
	- Only enabled for streamers where a message has been set for the `Game Changed` event for the time
		- Will **NOT** fire for streamers who don't have a message set for the time of the event, even if there are other `Game Changed` event messages set.
		- ie. if streamer A has a message for the `Game Changed` event and a timing of `Morning` then notifications for game changes will only be sent for streamer A in the morning, and **NOT** in the afternoon or at night.

# Credits
Image created by Shupik123  
© 2025 ericw9079
