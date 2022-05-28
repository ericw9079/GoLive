const db = require('./sqlDatabase.js');

async function updateEntry(uid,name){
  let value = await db.get("cache");
  if(value === null){
    value = {};
  }
  if(value["id"+uid] != name.toLowerCase()){
    await db.setCache(uid,name.toLowerCase());
  }
}

async function removeEntry(uid){
  await db.removeCache(uid);
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