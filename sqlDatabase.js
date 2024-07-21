const mysql = require('mysql2');
const { LiveStatus, NOGAME, Timing, Event } = require('./enums');

const pool = mysql.createPool({
  connectionLimit : 10,
  host: process.env.NODE_ENV == "production" ? "goLiveDb" : "localhost",
  user: "golive",
  password: "bot",
  database: "golive",
  supportBigNumbers: true
}).promise();

// BEGIN DISCORD

const getDiscord = async (uid) => {
	if (uid == "*") {
		// Wildcard (type="all")
		const [wildcards] = await pool.execute("SELECT _key, uid, guild, channel, type FROM Discord WHERE type = 'all';");
		return wildcards;
	}
	else if (typeof uid == "string" && uid.startsWith("^")) {
		// Ignored channel
		uid = uid.substr(1);
		const [ignored] = await pool.execute("SELECT _key, uid, guild, channel, type FROM Discord WHERE uid = ? AND type = 'ignore';", [uid]);
		return ignored;
	}
	else {
		const con = await pool.getConnection();
		let results;
		try {
			const [includes] = await con.execute("SELECT _key, uid, guild, channel, type FROM Discord WHERE type = 'normal' AND uid = ?;", [uid]);
			const [allResults] = await con.execute("SELECT _key, uid, guild, channel, type FROM Discord WHERE type = 'all';");
			allResults.forEach((el) => {
				if (!includes.some(e => e.guild === el.guild)){
					// Merge the results
					includes.push(el);
				}
			});
			const [excludes] = await con.execute("SELECT guild FROM Discord WHERE uid = ? AND type = 'ignore';", [uid]);
			results = includes.filter((el) => {
				// Exclude the ignore channels
				return !excludes.some(e => e.guild == el.guild);
			});
		} finally {
			con.release();
		}
		return results;
	}
};

const addDiscord = async (uid, guild, channel) => {
	const con = await pool.getConnection();
	try {
		const [keys] = await con.execute('SELECT _key FROM Discord WHERE guild = ? AND uid = ?;', [guild, uid]);
		if (!keys || keys.length == 0) {
			await con.execute("INSERT INTO Discord (uid,guild,channel,type) VALUES (?,?,?,'normal');", [uid, guild, channel]);
		}
		else {
			await con.execute("UPDATE Discord SET uid = ?, guild = ?, channel = ?, type = 'normal' WHERE _key = ?;", [uid, guild, keys[0]._key]);
		}
	} finally {
		con.release();
	}
	return true;
};

const removeDiscord = async (uid, guild) => {
	const [result] = await pool.execute("DELETE FROM Discord WHERE uid = ? AND guild = ? AND (type='normal' OR type='ignore');", [uid, guild]);
	return result;
};

const ignoreDiscord = async (uid, guild) => {
	const con = await pool.getConnection();
	try {
		const [keys] = await con.execute('SELECT _key FROM Discord WHERE guild = ? AND uid = ?;', [guild, uid]);
		if(!keys || keys.length == 0) {
			await con.execute("INSERT INTO Discord (uid,guild,type) VALUES (?,?,'ignore');");
		}
		else {
			await con.execute("UPDATE Discord SET uid = ?, guild = ?,type = 'ignore' WHERE _key = ?;", [uid, guild, keys[0]._key]);
		}
	} finally {
		con.release();
	}
	return true;
};

const addWildDiscord = async (guild, channel) => {
	const con = await pool.getConnection();
	try {
		const [keys] = await con.execute('SELECT _key FROM Discord WHERE guild = ? AND uid IS NULL;', [guild]);
		if(!keys || keys.length == 0) {
			await con.execute("INSERT INTO Discord (uid,guild,channel,type) VALUES (NULL,?,?,'all');", [guild, channel]);
		}
		else {
			await con.execute("UPDATE Discord SET uid = NULL, guild = ?, channel = ?, type = 'all' WHERE _key = ?;", [guild, channel, keys[0]._key]);
		}
	} finally {
		con.release();
	}
	return true;
};

const removeWildDiscord = async (guild) => {
	const [results] = await pool.execute("DELETE FROM Discord WHERE uid IS NULL AND guild = ? AND type = 'all';", [guild]);
	return results.affectedRows > 0;
}

const listDiscords = async () => {
	const [results] = await pool.execute('SELECT DISTINCT uid, type FROM Discord;');
	return results;
};

// END DISCORD
// BEGIN MESSAGE

const addMessage = async (uid, guild, message, eventFor = Event.LIVE, timingOf = Timing.ANYTIME) => {
	const con = await pool.getConnection();
	try {
		const [keys] = await con.execute(
			`SELECT _key FROM Message WHERE guild = ? AND uid = ? AND messageTrigger = ? AND timing ${timingOf == Timing.ANYTIME ? 'IS NULL' : ' = ?'};`,
			timingOf == Timing.ANYTIME ? [guild, uid, eventFor] : [guild, uid, eventFor, timingOf],
		);
		if(!keys || keys.length == 0) {
			await con.execute('INSERT INTO Message (uid,guild,message,messageTrigger,timing) VALUES (?,?,?,?,?);', [uid, guild, message, eventFor, timingOf == Timing.ANYTIME ? null : timingOf]);
		}
		else {
			await con.execute('UPDATE Message SET uid = ?, guild = ?, message = ?, timing = ?, messageTrigger = ? WHERE _key = ?;', [uid, guild, message, timingOf == Timing.ANYTIME ? null : timingOf, eventFor, keys[0]._key]);
		}
	} finally {
		con.release();
	}
	return true;
};

const removeMessage = async (uid, guild, eventFor = Event.LIVE, timingOf = Timing.ANYTIME) => {
	const [results] = await pool.execute(
		`DELETE FROM Message WHERE uid = ? AND guild = ? AND messageTrigger = ? AND timing ${timingOf == Timing.ANYTIME ? 'IS NULL' : ' = ?'};`,
		timingOf == Timing.ANYTIME ? [uid, guild, eventFor] : [uid, guild, eventFor, timingOf],
	);
	return results.affectedRows > 0;
};

const removeAllMessages = async (uid, guild) => {
	const [results] = await pool.execute('DELETE FROM Message WHERE uid = ? AND guild = ?;', [uid, guild]);
	return results.affectedRows > 0;
};

const getMessage = async (uid, guild, eventFor = Event.LIVE, timingOf = Timing.ANYTIME) => {
	const con = await pool.getConnection();
	try {
		// const [results] = await con.execute('SELECT message FROM Message WHERE uid = ? AND guild = ? AND messageTrigger = ? AND timing = ?;', [uid, guild, eventFor, timingOf == Timing.ANYTIME ? null : timingOf]);
		const [results] = await con.execute(
			`SELECT message FROM Message WHERE guild = ? AND uid = ? AND messageTrigger = ? AND timing ${timingOf == Timing.ANYTIME ? 'IS NULL' : ' = ?'};`,
			timingOf == Timing.ANYTIME ? [guild, uid, eventFor] : [guild, uid, eventFor, timingOf],
		);
		if (!results[0]?.message) {
			const [partialResults] = await con.execute('SELECT message FROM Message WHERE uid = ? AND guild = ? AND messageTrigger = ? AND timing IS NULL;', [uid, guild, eventFor]);
			return partialResults[0]?.message;
		}
		return results[0]?.message;
	} finally {
		con.release();
	}
};

// END MESSAGE
// BEGIN DEFAULT MESSAGE

const addDefaultMessage = async (guild, message) => {
	const con = await pool.getConnection();
	try {
		const [keys] = await con.execute('SELECT guild FROM DefaultMessage WHERE guild = ?;', [guild]);
		if(!keys || keys.length == 0) {
			await con.execute('INSERT INTO DefaultMessage (guild,message) VALUES (?,?);', [guild, message]);
		}
		else {
			await con.execute('UPDATE DefaultMessage SET guild = ?, message = ? WHERE guild = ?;', [guild, message, keys[0].guild]);
		}
	} finally {
		con.release();
	}
	return true;
};

const removeDefaultMessage = async (guild) => {
	const [results] = await pool.execute('DELETE FROM DefaultMessage WHERE guild = ?;', [guild]);
	return results.affectedRows > 0;
};

const getDefaultMessage = async (guild) => {
	const [results] = await pool.execute('SELECT message FROM DefaultMessage WHERE guild = ?;', [guild]);
	return results;
};

// END DEFAULT MESSAGE
// BEGIN DEFAULT CHANNEL

const addDefaultChannel = async (guild, channel) => {
	const con = await pool.getConnection();
	try {
		const [keys] = await con.execute('SELECT guild FROM DefaultChannel WHERE guild = ?;', [guild]);
		if(!keys || keys.length == 0) {
			await con.execute('INSERT INTO DefaultChannel (guild,channel) VALUES (?,?);', [guild, channel]);
		}
		else {
			await con.execute('UPDATE DefaultChannel SET guild = ?, channel = ? WHERE guild = ?;', [guild, channel, keys[0].guild]);
		}
	} finally {
		con.release();
	}
	return true;
};

const removeDefaultChannel = async (guild) => {
	const [results] = await pool.execute('DELETE FROM DefaultChannel WHERE guild = ?;', [guild]);
	return results.affectedRows > 0;
};

const getDefaultChannel = async (guild) => {
	const [results] = await pool.execute('SELECT channel FROM DefaultChannel WHERE guild = ?;', [guild]);
	return results;
};

// END DEFAULT CHANNEL
// BEGIN LIVE

const setLive = async (uid, state, game = NOGAME) => {
	if(!Object.values(LiveStatus).includes(state)) {
		throw new Error("Invalid State");
	}
	const con = await pool.getConnection();
	try {
		const [keys] = await con.execute('SELECT uid FROM Live WHERE uid = ?;', [uid]);
		if(!keys || keys.length == 0) {
			await con.execute('INSERT INTO Live (uid, status, game) VALUES (?,?,?);', [uid, state, game]);
		}
		else {
			await con.execute('UPDATE Live SET uid = ?, status = ?, game = ? WHERE uid = ?;', [uid, state, game, keys[0].uid]);
		}
	} finally {
		con.release();
	}
	return true;
};

const removeLive = async (uid) => {
	const [results] = await pool.execute('DELETE FROM Live WHERE uid = ?;', [uid]);
	return results.affectedRows > 0;
};

const getLive = async (uid) => {
	const [results] = await pool.execute('SELECT status, game FROM Live WHERE uid = ?;', [uid]);
	return results;
};

// END LIVE
// BEGIN CACHE

const setCache = async (uid, username) => {
	const con = await pool.getConnection();
	try {
		const [keys] = await con.execute('SELECT uid FROM cache WHERE uid = ?;', [uid]);
		if(!keys || keys.length == 0) {
			await con.execute('INSERT INTO cache (uid,username) VALUES (?,?);', [uid, username]);
		}
		else {
			con.execute('UPDATE cache SET uid = ?, username = ? WHERE uid = ?;', [uid, username, keys[0].uid]);
		}
	} finally {
		con.release();
	}
	return true;
};

const removeCache = async (uid) => {
	const [results] = await pool.execute('DELETE FROM cache WHERE uid = ?;', [uid]);
	return results.affectedRows > 0;
};

const getCache = async () => {
	const [results] = await pool.execute('SELECT uid, username FROM cache;');
	return results;
};

// END CACHE
// BEGIN BL

const addBL = async (uid) => {
	const con = await pool.getConnection();
	try {
		const [keys] = await con.execute('SELECT uid FROM bl WHERE uid = ?;', [uid]);
		if(!keys || keys.length == 0) {
			await con.execute('INSERT INTO bl (uid) VALUES (?)', [uid]);
		}
	} finally {
		con.release();
	}
	return true;
};

const removeBL = async (uid) => {
	const [results] = await pool.execute('DELETE FROM bl WHERE uid = ?;', [uid]);
	return results.affectedRows > 0;
};

const getBL = async () => {
	const [results] = await pool.execute('SELECT uid FROM bl;');
	return results;
};

// END BL


const get = async (key) => {
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
		case "Default":
			let msg = await getDefaultMessage(id);
			return msg.length > 0 ? msg[0].message:"";
		case "Live":
			let state = await getLive(id);
			return state.length > 0 ? [state[0].status, state[0].game ] : [ LiveStatus.OFFLINE, NOGAME ];
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
		default:
			return pool.query('SELECT 1;');
	}
};

/**
 * List the keys in the database.
 * If prefix is excluded (or undefined) then all keys are returned.
 * If a prefix is given then only keys begining with the prefix will be returned.
 * @param prefix - prefix of keys to return (Optional)
 * @return array of keys in the database that match the prefix.
 */
const list = async (prefix = undefined) => {
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
};

module.exports = {
  addDiscord,
  addWildDiscord,
  removeWildDiscord,
  removeDiscord,
  ignoreDiscord,
  addMessage,
  removeMessage,
  removeAllMessages,
  getMessage,
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
}