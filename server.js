const express = require('express');
const path = require('path');
const server = express();
const logger = require('./logger.js');
const db = require('./database.js');

const OFFLINE = "OFFLINE";
const ONLINE = "ONLINE";

server.all('/', (req, res)=>{
  res.send("<head><link rel='icon' type='image/png' href='./GoLive.png'></head><div style='display:flex;align-content:center'><img style='height:10vh;margin-right:5px' src='./GoLive.png' /><div style='display:inline-block'><h1 style='margin-bottom:0px'>GoLive</h1><h5 style='margin-top:0px'>by ericw9079</h5></div></div><iframe style='border:none;width:90vw;height:70vh' src='./live'>");
});

server.all("/GoLive.png", (req, res)=>{
  res.sendFile("./GoLive.png",{
        root: path.join(__dirname)
    });
});

server.all('/live', async (req, res) =>{
  let keys = await db.list("Live");
  let online = "";
  let offline = "";
  for(let key in keys){
    let status = await db.get(keys[key]);
    if(status == ONLINE){
      online += `<a rel='external' target='_blank' href='https://twitch.tv/${keys[key].substr(5)}'>${keys[key].substr(5)}</a><br />`;
    }
    else{
      offline += `${keys[key].substr(5)}<br />`;
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

function keepAlive(){
  server.listen(3000, ()=>{logger.log("Server is Ready!")});
}

module.exports = keepAlive;