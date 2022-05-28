const mysql = require('mysql2');
const { Channel } = require('discord.js');

const pool = mysql.createPool({
  connectionLimit : 10,
  host: "localhost",
  user: "golive",
  password: "bot",
  database: "golive",
  supportBigNumbers: true
});

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

// BEGIN DISCORD

function getDiscord(uid) {
	if(uid == "*") {
		// Wildcard (type="all")
		return new Promise((resolve,reject) => {
			pool.query(`SELECT * FROM Discord WHERE type="all"`, function (err, allResults) {
				if (err) {
					return reject(err);
				}
				resolve(allResults);
			});
		});
	}
	else if(typeof uid == "string" && uid.startsWith("^")) {
		// Ignored channel
		uid = uid.substr(1);
		return new Promise((resolve,reject) => {
			pool.query(`SELECT * FROM Discord WHERE uid=${uid} AND type="ignore"`, function (err, ignoredResults) {
				if (err) {
					return reject(err);
				}
				resolve(ignoredResults);
			});
		});
	}
	else {
		return new Promise((resolve,reject) => {
			pool.getConnection(function(err, con) {
				if (err) return reject(err);
				con.query(`SELECT * FROM Discord WHERE type="normal" AND uid=${uid}`, function (err, includeResults) {
					if (err) {
						con.release();
						return reject(err);
					}
					con.query(`SELECT * FROM Discord WHERE type="all"`, function (err, allResults) {
						if (err) {
							con.release();
							return reject(err);
						}
						allResults.forEach((el) => {
							if(!includeResults.some(e => e.guild === el.guild)){
								// Merge the results
								includeResults.push(el);
							}
						});
						con.query(`SELECT guild FROM Discord WHERE uid=${uid} AND type="ignore"`, function (err, excludeResults) {
							con.release();
							if (err) return reject(err);
							result = includeResults.filter((el) => {
								// Exclude the ignore channels
								return !excludeResults.some(e => e.guild == el.guild);
							});
							resolve(result);
						});
					});
				});
			});
		});
	}
}

function addDiscord(uid, guild, channel) {
	return new Promise((resolve,reject) => {
		pool.getConnection(function(err, con) {
			if (err) return reject(err);
			con.query(`SELECT _key FROM Discord WHERE guild=${guild} AND uid=${uid}`, function (err, keys) {
				if (err) {
					con.release();
					return reject(err);
				}
				if(!keys || keys.length == 0) {
					con.query(`INSERT INTO Discord (uid,guild,channel,type) VALUES (${uid},${guild},${channel},"normal")`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
				else {
					con.query(`UPDATE Discord SET uid=${uid},guild=${guild},channel=${channel},type="normal" WHERE _key=${keys[0]._key}`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
			});
		});
	});
}

function removeDiscord(uid, guild) {
	return new Promise((resolve,reject) => {
		pool.query(`DELETE FROM Discord WHERE uid=${uid} AND guild=${guild} AND (type="normal" OR type="ignore")`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

function ignoreDiscord(uid, guild) {
	return new Promise((resolve,reject) => {
		pool.getConnection(function(err, con) {
			if (err) return reject(err);
			con.query(`SELECT _key FROM Discord WHERE guild=${guild} AND uid=${uid}`, function (err, keys) {
				if (err) {
					con.release();
					return reject(err);
				}
				if(!keys || keys.length == 0) {
					con.query(`INSERT INTO Discord (uid,guild,type) VALUES (${uid},${guild},"ignore")`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
				else {
					con.query(`UPDATE Discord SET uid=${uid},guild=${guild},type="ignore" WHERE _key=${keys[0]._key}`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
			});
		});
	});
}

function addWildDiscord(guild, channel) {
	return new Promise((resolve,reject) => {
		pool.getConnection(function(err, con) {
			if (err) return reject(err);
			con.query(`SELECT _key FROM Discord WHERE guild=${guild} AND uid IS NULL`, function (err, keys) {
				if (err) {
					con.release();
					return reject(err);
				}
				if(!keys || keys.length == 0) {
					con.query(`INSERT INTO Discord (uid,guild,channel,type) VALUES (NULL,${guild},${channel},"all")`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
				else {
					con.query(`UPDATE Discord SET uid=NULL,guild=${guild},channel=${channel},type="all" WHERE _key=${keys[0]._key}`, function (err, excludeResults) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
			});
		});
	});
}

function removeWildDiscord(guild) {
	return new Promise((resolve,reject) => {
		pool.query(`DELETE FROM Discord WHERE uid IS NULL AND guild=${guild} AND type="all"`, function (err, result) {
			if (err) return reject(err);
			resolve(result.affectedRows > 0);
		});
	});
}

function listDiscords() {
	return new Promise((resolve,reject) => {
		pool.query(`SELECT uid,type FROM Discord`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

// END DISCORD
// BEGIN MESSAGE

function addMessage(uid, guild, message) {
	if(message) {
		message.replaceAll('"','\"');
	}
	return new Promise((resolve,reject) => {
		pool.getConnection(function(err, con) {
			if (err) return reject(err);
			con.query(`SELECT _key FROM Message WHERE guild=${guild} AND uid=${uid}`, function (err, keys) {
				if (err) {
					con.release();
					return reject(err);
				}
				if(!keys || keys.length == 0) {
					con.query(`INSERT INTO Message (uid,guild,message) VALUES (${uid},${guild},"${message}")`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
				else {
					con.query(`UPDATE Message SET uid=${uid},guild=${guild},message="${message}" WHERE _key=${keys[0]._key}`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
			});
		});
	});
}

function removeMessage(uid, guild) {
	return new Promise((resolve,reject) => {
		pool.query(`DELETE FROM Message WHERE uid=${uid} AND guild=${guild}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

function getMessage(uid) {
	return new Promise((resolve,reject) => {
		pool.query(`SELECT guild,message FROM Message WHERE uid=${uid}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

// END MESSAGE
// BEGIN DEFAULT MESSAGE

function addDefaultMessage(guild, message) {
	if(message) {
		message = message.replaceAll('"','\"');
	}
	return new Promise((resolve,reject) => {
		pool.getConnection(function(err, con) {
			if (err) return reject(err);
			con.query(`SELECT guild FROM DefaultMessage WHERE guild=${guild}`, function (err, keys) {
				if (err) {
					con.release();
					return reject(err);
				}
				if(!keys || keys.length == 0) {
					con.query(`INSERT INTO DefaultMessage (guild,message) VALUES (${guild},"${message}")`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
				else {
					con.query(`UPDATE DefaultMessage SET guild=${guild},message="${message}" WHERE guild=${keys[0].guild}`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
			});
		});
	});
}

function removeDefaultMessage(guild) {
	return new Promise((resolve,reject) => {
		pool.query(`DELETE FROM DefaultMessage WHERE guild=${guild}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

function getDefaultMessage(guild) {
	return new Promise((resolve,reject) => {
		pool.query(`SELECT message FROM DefaultMessage WHERE guild=${guild}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

// END DEFAULT MESSAGE
// BEGIN DEFAULT CHANNEL

function addDefaultChannel(guild, channel) {
	return new Promise((resolve,reject) => {
		pool.getConnection(function(err, con) {
			if (err) return reject(err);
			con.query(`SELECT guild FROM DefaultChannel WHERE guild=${guild}`, function (err, keys) {
				if (err) {
					con.release();
					return reject(err);
				}
				if(!keys || keys.length == 0) {
					con.query(`INSERT INTO DefaultChannel (guild,channel) VALUES (${guild},${channel})`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
				else {
					con.query(`UPDATE DefaultChannel SET guild=${guild},channel=${channel} WHERE guild=${keys[0].guild}`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
			});
		});
	});
}

function removeDefaultChannel(guild) {
	return new Promise((resolve,reject) => {
		pool.query(`DELETE FROM DefaultChannel WHERE guild=${guild}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

function getDefaultChannel(guild) {
	return new Promise((resolve,reject) => {
		pool.query(`SELECT channel FROM DefaultChannel WHERE guild=${guild}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

// END DEFAULT CHANNEL
// BEGIN LIVE

function setLive(uid, state) {
	return new Promise((resolve,reject) => {
		if(state != "ONLINE" && state != "OFFLINE") {
			reject("Invalid State");
		}
		pool.getConnection(function(err, con) {
			if (err) return reject(err);
			con.query(`SELECT uid FROM Live WHERE uid=${uid}`, function (err, keys) {
				if (err) {
					con.release();
					return reject(err);
				}
				if(!keys || keys.length == 0) {
					con.query(`INSERT INTO Live (uid,status) VALUES (${uid},"${state}")`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
				else {
					con.query(`UPDATE Live SET uid=${uid},status="${state}" WHERE uid=${keys[0].uid}`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
			});
		});
	});
}

function removeLive(uid) {
	return new Promise((resolve,reject) => {
		pool.query(`DELETE FROM Live WHERE uid=${uid}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

function getLive(uid) {
	return new Promise((resolve,reject) => {
		pool.query(`SELECT status FROM Live WHERE uid=${uid}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

// END LIVE
// BEGIN CACHE

function setCache(uid, username) {
	return new Promise((resolve,reject) => {
		pool.getConnection(function(err, con) {
			if (err) return reject(err);
			con.query(`SELECT uid FROM cache WHERE uid=${uid}`, function (err, keys) {
				if (err) {
					con.release();
					return reject(err);
				}
				if(!keys || keys.length == 0) {
					con.query(`INSERT INTO cache (uid,username) VALUES (${uid},"${username}")`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
				else {
					con.query(`UPDATE cache SET uid=${uid},username="${username}" WHERE uid=${keys[0].uid}`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
			});
		});
	});
}

function removeCache(uid) {
	return new Promise((resolve,reject) => {
		pool.query(`DELETE FROM cache WHERE uid=${uid}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

function getCache() {
	return new Promise((resolve,reject) => {
		pool.query(`SELECT * FROM cache`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

// END CACHE
// BEGIN BL

function addBL(uid) {
	return new Promise((resolve,reject) => {
		pool.getConnection(function(err, con) {
			if (err) return reject(err);
			con.query(`SELECT uid FROM bl WHERE uid=${uid}`, function (err, keys) {
				if (err) {
					con.release();
					return reject(err);
				}
				if(!keys || keys.length == 0) {
					con.query(`INSERT INTO bl (uid) VALUES (${uid})`, function (err, results) {
						con.release();
						if (err) return reject(err);
						resolve(true);
					});
				}
				else {
					con.release();
					resolve(true);
				}
			});
		});
	});
}

function removeBL(uid) {
	return new Promise((resolve,reject) => {
		pool.query(`DELETE FROM bl WHERE uid=${uid}`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

function getBL() {
	return new Promise((resolve,reject) => {
		pool.query(`SELECT * FROM bl`, function (err, result) {
			if (err) return reject(err);
			resolve(result);
		});
	});
}

// END BL


async function get(key) {
	[ table, id ] = key.split(":");
	let keys;
	let res;
	switch(table) {
		case "Discord":
			res = {};
			keys = await getDiscord(id);
			keys.forEach((element, index) => {
				res[`id${element.guild}`] = element.channel;
			});
			return res;
		case "Message":
			res = {};
			keys = await getMessage(id);
			keys.forEach((element, index) => {
				res[`id${element.guild}`] = element.message;
			});
			return res;
		case "Default":
			let msg = await getDefaultMessage(id);
			return msg.length > 0 ? msg[0].message:"";
		case "Live":
			let state = await getLive(id);
			return state.length > 0 ? state[0].status:"OFFLINE";
		case "DefaultChannel":
			let channel = await getDefaultChannel(id);
			return channel.length > 0 ? channel[0].channel:0;
		case "cache":
			res = {};
			keys = await getCache();
			keys.forEach((element, index) => {
				res[`id${element.uid}`] = element.username;
			});
			return res;
		case "bl":
			keys = await getBL();
			keys.forEach((element, index) => {
				keys[index] = element.uid;
			});
			return keys;
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
      // Get all values
    }
    else{
      // Get by table/prefix
	  switch(prefix){
		case "Discord":
			keys = await listDiscords();
			keys.forEach((element, index) => {
				switch(element.type) {
					case "normal":
						keys[index] = element.uid;
						break;
					case "all":
						keys[index] = "*";
						break;
					case "ignore":
						keys[index] = "^"+element.uid;
				}
			});
			break;
	  }
    }
  }
  catch{}
  return keys;
}

module.exports = {
  addDiscord,
  addWildDiscord,
  removeWildDiscord,
  removeDiscord,
  ignoreDiscord,
  addMessage,
  removeMessage,
  addDefaultMessage,
  removeDefaultMessage,
  setLive,
  removeLive,
  addDefaultChannel,
  removeDefaultChannel,
  setCache,
  removeCache,
  addBL,
  removeBL,
  get,
  list,
  setLogger,
}