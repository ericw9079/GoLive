var db = null;
var cacheManager = null

function init(database,cache){
  db = database;
  cacheManager = cache;
}

async function addChannel(twitch,guild,channel){
  if(db == null){
    return false;
  }
  let channels = await db.list("Discord:");
  if(channels.lenght >= 700 && !channels.includes("Discord:"+twitch)){
    // Rate limit imposed by Twitch
    return false;
  }
  let value = await db.get("Discord:"+twitch,{});
  if(value === null){
    value = {};
  }
  if(!guild.startsWith('id')){
    guild = 'id'+guild;
  }
  value[guild] = channel+"";
  await db.set("Discord:"+twitch,value);
  return true;
}

async function removeChannel(twitch,discord){
  if(db == null){
    return false;
  }
  let value = await db.get("Discord:"+twitch,{});
  if(value === null){
    value = {};
  }
  if(!discord.startsWith('id')){
    discord = 'id'+discord;
  }
  delete value[discord];
  if(value && Object.keys(value).length !== 0){
    await db.set("Discord:"+twitch,value);
  }
  else{
    await db.delete("Discord:"+twitch);
    await db.delete("Live:"+twitch);
    await cacheManager.remove(twitch);
  }
  return true;
}

async function addMessage(twitch,guild,message){
  if(db == null){
    return false;
  }
  let value = await db.get("Message:"+twitch,{});
  if(value === null){
    value = {};
  }
  if(!guild.startsWith('id')){
    guild = 'id'+guild;
  }
  value[guild] = message;
  await db.set("Message:"+twitch,value);
  return true;
}

async function removeMessage(twitch,discord){
  if(db == null){
    return false;
  }
  let value = await db.get("Message:"+twitch,{});
  if(value === null){
    value = {};
  }
  if(!discord.startsWith('id')){
    discord = 'id'+discord;
  }
  delete value[discord];
  if(value && Object.keys(value).length === 0){
    await db.delete("Message:"+twitch);
  }
  else{
    await db.set("Message:"+twitch,value);
  }
  return true;
}

async function addDefault(guild,message){
  if(db == null){
    return false;
  }
  let value = await db.get("Default",{});
  if(value === null){
    value = {};
  }
  if(!guild.startsWith('id')){
    guild = 'id'+guild;
  }
  value[guild] = message;
  await db.set("Default",value);
  return true;
}

async function removeDefault(discord){
  if(db == null){
    return false;
  }
  let value = await db.get("Default",{});
  if(value === null){
    value = {};
  }
  if(!discord.startsWith('id')){
    discord = 'id'+discord;
  }
  delete value[discord];
  if(value && Object.keys(value).length === 0){
    await db.delete("Default");
  }
  else{
    await db.set("Default",value);
  }
  return true;
}

async function getMessage(twitch,discord,global=true){
  if(db == null){
    return false;
  }
  let value = await db.get("Message:"+twitch,{});
  if(value === null){
    value = {};
  }
  if(!discord.startsWith('id')){
    discord = 'id'+discord;
  }
  if(global){
    let global = await db.get("Default",{});
    if(!global){
      global = {};
    }
    return value[discord]?value[discord]:global[discord];
  }
  return value[discord];
}

async function getChannel(twitch,discord){
  if(db == null){
    return false;
  }
  let value = await db.get("Discord:"+twitch,{});
  if(value === null){
    value = {};
  }
  if(!discord.startsWith('id')){
    discord = 'id'+discord;
  }
  return value[discord];
}

async function removeAll(twitch,discord){
  let t1 = await removeChannel(twitch,discord);
  let t2 = await removeMessage(twitch,discord);
  return t1 && t2;
}

module.exports = {
  init:init,
  addChannel:addChannel,
  removeChannel:removeChannel,
  addMessage:addMessage,
  removeMessage:removeMessage,
  addDefault:addDefault,
  removeDefault:removeDefault,
  getMessage:getMessage,
  getChannel:getChannel,
  removeAll:removeAll,
}