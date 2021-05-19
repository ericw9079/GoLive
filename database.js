/*
 * Cache based database using replit database for persistance.
*/
const Database = require("@replit/database");
const db = new Database();
const { Channel } = require('discord.js');

/**
 * Main cache.
 * On get, keys not present in the cache are fetched from the database.
 * On set, keys and values are stored here before getting written to the database.
 */
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

/**
 * Get value for a key.
 * If the key isn't present in the cache it is fetched from the underlying database, if the key isn't found in the database the default value is returned.
 * @param key - key to get
 * @param defaultValue - default value to return if the key isn't found
 * @return - the value of the key from the cache/database or the defaultValue if not found.
 */
async function getKey(key,defaultValue=""){
  if(cache[key]){
    value = cache[key];
  }
  else{
    await fetch(key);
    value = cache[key]?cache[key]:defaultValue;
  }
  if(value != undefined && value == cache[key]){
    value = JSON.parse(JSON.stringify(value));
  }
  return value;
}

/**
 * Set the value for a key.
 * The cache is updated then the key and value is written to the database.
 * @param key - key to set
 * @param value - value to set
 */
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

/**
 * Fetch key from the database
 * The cache is updated with the retrieved value.
 * @param key - key to fetch
 */
async function fetch(key){
  try{
      value = await db.get(key);
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

/**
 * Write the value of a key in the cache to the database.
 * If writting fails it is re-attemped in 5 seconds.
 * @param key - key to write the value of (value retrieved from the cache)
 */
async function write(key){
  value = cache[key];
  try{
    if(typeof(value) == "object"){
      value = JSON.parse(JSON.stringify(value));
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

/**
 * Remove a key from the database.
 * If they key is removed from the database successfully it is also removed from the cache.
 * @param key - key to remove
 */
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

/**
 * List the keys in the database.
 * If prefix is excluded (or undefined) then all keys are returned.
 * If a prefix is given then only keys begining with the prefix will be returned.
 * @param prefix - prefix of keys to return (Optional)
 * @return array of keys in the database that match the prefix.
 */
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

/**
 * Remove all keys from the database.
 */
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