'use strict';

let express = require('express');
let app = express();
let http = require('http').Server(app);
let io = require('socket.io')(http);

let fs = require('fs');
let Promise = require('promise');
let access = Promise.denodeify(fs.access);

let Alias = require('./lib/alias');

let configFile = './config.json';
let config;

access(configFile, fs.R_OK).then(function() {
  config = require('./config.json');

  // Setup socket
  return Alias(io, config);
}).then(function(alias) {
  // Setup static serving of files
  app.use('/', express.static('web'));

  // Start listening
  // 65108 6576
  http.listen(config.port, config.address);

  console.log('alias listening on ' + config.address + ':' + config.port);

  alias.reload();
}, function(err) {
  console.error(err.message);
  console.error(err.stack);
});
