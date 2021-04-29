const Database = require("@replit/database");
const db = new Database();
const { Channel } = require('discord.js');

var cache = {};

var logger = {send:function(){}};

function setLogger(logChannel){
  let updated = false;
  if(logChannel instanceof Channel){
    if(logChannel.isText()){
      logger = logChannel;
      updated = true;
    }
  }
  if(!updated){
    logger = {send:function(){}}
  }
}

async function getKey(key,defaultValue=""){
  if(cache[key]){
    value = cache[key];
  }
  else{
    await fetch(key);
    value = cache[key]?cache[key]:defaultValue;
  }
  return value;
}

async function setKey(key,value){
  let changed = false;
  if(cache[key] != value){
    changed = true;
  }
  cache[key] = value;
  if(changed){
    await write(key);
  }
}

async function fetch(key){
  try{
      value = await db.get(key,{raw:true});
      if(value){
        try{
          value = JSON.parse(value);
          while(typeof(value) === "string"){
            value = JSON.parse(value);
          }
          if(typeof(value) == "object"){
            for(let k in value){
              value[k] = decodeURIComponent(value[k]);
            }
          }
        }
        catch{
          value = decodeURIComponent(value);
        }
      }
      else{
        value = undefined;
      }
      cache[key] = value;
    }
    catch(e){
      console.error(e);
      logger.send(`We ran into a problem fetching ${key}:\n${e}`);
    }
}

async function write(key){
  value = cache[key];
  try{
    if(typeof(value) == "object"){
      for(let k in value){
        value[k] = encodeURIComponent(value[k]);
      }
      value = JSON.stringify(value);
    }
    else{
      value = encodeURIComponent(value);
    }
    await db.set(key,value);
  }
  catch(e){
    console.error(e);
    logger.send(`We ran into a problem setting ${key} to ${cache[key]}:\n${e}`);
    setTimeout(write,5000,key);
  }
}

async function deleteKey(key){
  try{
    await db.delete(key);
    delete cache[key];
  }
  catch(e){
    console.error(e);
    logger.send(`We ran into a problem deleting ${key}:\n${e}`);
  }
}

async function list(prefix=undefined){
  let keys = [];
  try{
    if(prefix === undefined){
      keys = await db.list();
    }
    else{
      keys = await db.list(prefix);
    }
  }
  catch{}
  return keys;
}

async function clear(){
  keys = await list();
  for(let key of keys){
    await deleteKey(key);
  }
}

module.exports = {
  get:getKey,
  set:setKey,
  delete:deleteKey,
  list:list,
  clear:clear,
  setLogger:setLogger,
}