let db = require('./sqlDatabase.js');
if(process.env.Environment == "Replit"){
  console.log("Using Replit db");
  db = require('./database.js');
}

async function updateEntry(uid,name){
  let value = await db.get("cache",{});
  if(value === null){
    value = {};
  }
  if(process.env.Environment == "Replit"){
    if(!uid.startsWith('id')){
      uid = 'id'+uid;
    }
    if(value[uid] != name.toLowerCase()){
      value[uid] = name.toLowerCase();
      await db.set("cache",value);
    }
  }
  else{
    if(value["id"+uid] != name.toLowerCase()){
      await db.setCache(uid,name.toLowerCase());
    }
  }
}

async function removeEntry(uid){
  if(process.env.Environment == "Replit"){
    let value = await db.get("cache",{});
    if(value === null){
      value = {};
    }
    if(!uid.startsWith('id')){
      uid = 'id'+uid;
    }
    delete value[uid];
    if(value && Object.keys(value).length !== 0){
      await db.set("cache",value);
    }
    else{
      await db.delete("cache");
    }
  }
  else {
    await db.removeCache(uid);
  }
}

async function getName(uid){
  let value = await db.get("cache");
  if(!`${uid}`.startsWith('id')){
    uid = 'id'+uid;
  }
  return value[uid];
}

async function getUID(name){
  let value = await db.get("cache");
  let uid = null;
	name = name.toLowerCase();
	Object.keys(value).forEach(function (key) {
		if(value[key] == name){
			uid = key.substr(2);
		}
	});
	return uid;
}

module.exports = {
  update:updateEntry,
  remove:removeEntry,
  name:getName,
  uid:getUID
}