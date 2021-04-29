const express = require('express');
const server = express();
const logger = require('./logger.js');

server.all('/', (req, res)=>{
  res.send('Your bot is alive!');
});

function keepAlive(){
  server.listen(3000, ()=>{logger.log("Server is Ready!")});
}

module.exports = keepAlive;