var lastLogged = "";
module.exports = {
  log: function(text){
    if(text == lastLogged){
      return;
    }
    let d = new Date();
    console.log(`[${d.toLocaleString("en-CA",{timeStyle:"medium",hour12:false})}|LOG] `+text);
    lastLogged = text;
  },
  info: function (text) {
    if(text == lastLogged){
      return;
    }
    let d = new Date();
    console.info(`[${d.toLocaleString("en-CA",{timeStyle:"medium",hour12:false})}|\x1b[96mINFO\x1b[89m\x1b[0m] `+text);
    lastLogged = text;
  },
  warn: function (text) {
    if(text == lastLogged){
      return;
    }
    let d = new Date();
    console.warn(`[${d.toLocaleString("en-CA",{timeStyle:"medium",hour12:false})}|\x1b[93mWARN\x1b[39m\x1b[0m] `+text);
    lastLogged = text;
  },
  error: function (text) {
    if(text == lastLogged){
      return;
    }
    let d = new Date();
    console.error(`[${d.toLocaleString("en-CA",{timeStyle:"medium",hour12:false})}|\x1b[91mERROR\x1b[39m\x1b[0m] \x1b[91m`+text+`\x1b[39m\x1b[0m`);
    lastLogged = text;
  }
}