const express = require('express');
const path = require('path');
const server = express();
const logger = require('./logger.js');
const db = require('./database.js');
const cache = require('./cacheManager.js');

// Response Codes
const BAD_REQUEST = 400;
const UNAUTHORIZED = 401;
const OK = 200;
const SERVER_ERROR = 500;

// Statuses
const OFFLINE = "OFFLINE";
const ONLINE = "ONLINE";

const authToken = process.env.AUTH_TOKEN;

server.use(express.json());

server.get('/', (req, res)=>{
  res.send("<head><link rel='icon' type='image/png' href='./GoLive.png'></head><div style='display:flex;align-content:center'><img style='height:10vh;margin-right:5px' src='./GoLive.png' /><div style='display:inline-block'><h1 style='margin-bottom:0px'>GoLive</h1><h5 style='margin-top:0px'>by ericw9079</h5></div></div><iframe style='border:none;width:90vw;height:70vh' src='./live'>");
});

server.all("/GoLive.png", (req, res)=>{
  res.sendFile("./GoLive.png",{
        root: path.join(__dirname)
    });
});

server.get('/live', async (req, res) =>{
  let keys = await db.list("Live");
  let online = "";
  let offline = "";
  for(let key in keys){
    let status = await db.get(keys[key]);
    let name = await cache.name(keys[key].substr(5));
    if(status == ONLINE){
      online += `<a rel='external' target='_blank' href='https://twitch.tv/${name}'>${name}</a><br />`;
    }
    else{
      offline += `${name}<br />`;
    }
  }
  s = "<table style='width:100%'>";
  s += "<tr><td><b>Online:</b></td><td><b>Offline:</b></td></tr>";
  s += `<tr><td>${online}</td><td>${offline}</td></tr>`;
  s += "</table>";
  s += "<script>setTimeout(function(){document.location.reload()}, 5000);</script>";
	res.set("Cache-Control", "no-cache");
  res.send(s);
});

server.put('/status/:uid', async (req, res) => {
  if(req.get('X-auth-token') !== authToken) {
    res.status(UNAUTHORIZED).send({});
    return;
  }
  const uid = req.params.uid;
  const status = req.body.status;
  const name = req.body.name;
  if(!(uid > 0)){
    res.status(BAD_REQUEST).send({error: "Invalid uid"});
    return;
  }
  if(!name.match(/[a-z_0-9]{4,25}/i)) {
    res.status(BAD_REQUEST).send({error: "Invalid Channel name"});
    return;
  }
  if(status !== ONLINE && status !== OFFLINE) {
    res.status(BAD_REQUEST).send({error: "Invalid Status"});
    return;
  }
  try {
    await cache.update(uid,name);
    await db.set(`Live:${uid}`,status);
    res.status(OK).send();
  }
  catch (error) {
    res.status(SERVER_ERROR).send({error});
  }
});

server.delete('/status/:uid', async (req, res) => {
  if(req.get('X-auth-token') !== authToken) {
    res.status(UNAUTHORIZED).send();
    return;
  }
  const uid = req.params.uid;
  if(!(uid > 0)){
    res.status(BAD_REQUEST).send({error: "Invalid uid"});
    return;
  }
  try {
    await cache.remove(uid);
    await db.delete(`Live:${uid}`);
    res.status(OK).send();
  }
  catch (error) {
    res.status(SERVER_ERROR).send({error});
  }
});

function keepAlive(){
  server.listen(3000, ()=>{logger.log("Server is Ready!")});
}

module.exports = keepAlive;