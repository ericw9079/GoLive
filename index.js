const keepAlive = require("./server.js");

keepAlive();

/*const db = require('./database.js')
db.list().then(async (keys)=>{
  for(let key in keys){
    let value = await db.get(keys[key],"");
    console.log(keys[key]," => ",value);
  }
});*/