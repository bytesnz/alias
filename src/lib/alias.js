/*!
 * This file is part of alias.
 *
 * alias is copyright BytesNZ 2016 (http://github.com/bytesnz)
 *
 * alias is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * alias is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 !*/
'use strict';

let Promise = require('promise');
let fs = require('fs');
let childProcess = require('child_process');

let access = Promise.denodeify(fs.access);
let writeFile = Promise.denodeify(fs.writeFile);
let exec = Promise.denodeify(childProcess.exec);

let jsonDB = require('json-crud');

let options;

let aliasDB;

/**@internal
 * Run an operation on the alias database and emit a result message with an
 * Object containing the given reference (`.reference) and the resulting
 * data (`.result`), or an error (`.error`).
 *
 * @param {Socket} socket Socket.io client socket
 * @param {String} operation Operation to carry out on the database
 * @param {Object} data Data to use to carry out operation on database
 * @param {String|Number} data.reference Reference number of socket message
 * @param {*} data.data Data to pass to database operation
 *
 * @returns {undefined}
 *
 * @TODO data checking including for a valid regular expression  you naughty boy
 */
function aliasOperation(socket, operation, data) {
  // Create the new alias
  aliasDB[operation](data).then(function(result) {
    socket.emit('result', {
      reference: data.reference,
      result: result
    });
  }, function(err) {
    socket.emit('result', {
      reference: data.reference,
      error: err.message
    });
  });
}

/**@internal
 * Handles calls to save an alias
 *
 * @param {Socket} socket Socket.io client socket
 * @param {Object} data Data to use to carry out operation on database
 * @param {String|Number} data.reference Reference number of socket message
 * @param {*} data.data Data to pass to database operation
 *
 * @returns{undefined}
 */
function saveAlias(socket, data) {
  // Ignore if no reference
  if (!data.reference) {
    return;
  }

  console.log('saving alias', data);

  var items = [];
  var errors = [];
  var alias;
  var blockUpdate = false;
  var aliasUpdate = false;

  if (data.aliases && data.aliases instanceof Array) {
    var i, num = data.aliases.length;
    for (i = 0; i < num; i++) {
      alias = data.aliases[i];

      // Check values
      if (!alias.alias) {
        errors.push('Alias required for alias ' + (i + 1));
        continue;
      }

      if (!alias.user || !alias.user.match(/^([a-z_][a-z0-9_]{0,30}|(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))(,|$))+/)) {
        errors.push((alias.user ? 'Illegal user name/email'
            : 'User name/email required')
            + ' for alias ' + alias.alias);
        continue;
      }

      try {
        new RegExp('/^' + alias.alias.replace(/(\.)/g, '\\$1') + '$/');
      } catch (err) {
        errors.push('Error with alias ' + alias.alias + ': ' + err.message);
        continue;
      }

      if (!alias.description) {
        errors.push('Description required for alias ' + alias.alias);
        continue;
      }

      if (alias.blocked) {
        blockUpdate = true;
      } else {
        aliasUpdate = true;
      }

      items.push({
        regex: (alias.regex ? true : false),
        blocked: (alias.blocked ? true : false),
        alias: alias.alias,
        user: alias.user,
        description: alias.description
      });
    }

    if (errors.length) {
      socket.emit('result', {
        reference: data.reference,
        error: errors
      });
      return;
    }

    console.log('saving', items);

    // Submit to quesetion
    aliasDB.update(items).then(function createSuccess() {
      console.log('create resolved', arguments);
      if (data.id) {
        return aliasDB.delete(data.id);
      } else {
        return Promise.resolve();
      }
    }).then(function() {
      socket.emit('result', {
        reference: data.reference,
        type: data.type,
        result: (items.length === 1 ? items[0].alias : items.length)
      });
      return reload(aliasUpdate, blockUpdate);
    }, function createError(err) {
      console.error(err.message);
      console.error(err.stack);
      socket.emit('result', {
        reference: data.reference,
        error: 'Error saving alias: ' + err.message
      });

      return Promise.resolve();
    }).catch(function(err) {
      console.error(err.message);
      console.error(err.stack);
      socket.emit('result', {
        reference: data.reference,
        error: 'Error reloading aliases: ' + err.message,
        stack: err.stack
      });
    });
  } else {
    socket.emit('result', {
      reference: data.reference,
      error: 'Receive no aliases or aliases in incorrect format'
    });
  }
}

/**@internal
 * Reloads the aliases and the block list if specified with the data from the
 * alias database. Emits a result message with an Object containing the 
 * given reference (`.reference`) and if it failed, an error message
 * (`.message`).
 *
 * @param {Socket} socket Socket.io client socket
 * @param {Object} data Data to use to carry out operation
 * @param {String|Number} data.reference Reference number of socket message
 *
 * @returns {undefined}
 */
function reloadAliases(socket, data) {
  // Get initial data
  return aliasDB.read().then(function(aliases) {
    if (typeof data === 'undefined') {
      return Promise.reject(new Error('No reference data given to initialise'));
    }

    //data.result = Object.values(aliases);
    data.result = [];
    Object.keys(aliases).forEach(function(alias) {
      data.result.push(aliases[alias]);
    });

    socket.emit('result', data);
  }).catch(function(err) {
    console.error(err.stack);
    socket.emit('result', {
      error: err.message,
      reference: (typeof data === 'object' && data.reference
          ? data.reference : undefined)
    });
  });
}

/**@internal
 * Reload the aliases
 *
 * @param {Boolean} [redoAliases=true] Whether or not to rewrite the aliases
 *   file
 * @param {Boolean} [redoBlocked=true] Whether or not to rewrite the block
 *   file
 *
 * @returns {Promise} A promise that the aliases will be reloaded
 */
function reload(redoAliases, redoBlocked) {
  redoAliases = (options.aliases
      && (redoAliases === undefined ? true : redoAliases));
  redoBlocked = (options.reject
      && (redoBlocked === undefined ? true : redoBlocked));
  
  // Get all the aliases
  return aliasDB.read().then(function(results) {
    let rejectContents = [],
        aliasContents = [],
        r,
        alias;

    for (r in results) {
      // Build regex
      if (results[r].regex) {
        alias = results[r].alias;
        if (!alias.startsWith('/')) {
          alias = '/' + alias;
        }
        if (!alias.endsWith('/')) {
          alias = alias + '/';
        }
      } else {
        alias = results[r].alias.replace(/([.?+()\[\]*])/g, '\\$1');
        if (results[r].alias.startsWith('@')) {
          alias = '/' + alias + '$/';
        } else {
          alias = '/^' + alias + '$/';
        }
      }

      if (/*options.*/ results[r].block) {
        if (redoBlocked) {
          rejectContents.push('# ' + results[r].description);
          rejectContents.push(alias + ' REJECT' + (results[r].reason ? ' '
              + results[r].reason : ''));
        }
      } else {
        if (redoAliases) {
          aliasContents.push('# ' + results[r].description);
          aliasContents.push(alias + ' ' + results[r].user);
        }
      }
    }

    // Write to files
    let files = [];

    if (redoBlocked) {
      console.log('writing reject file ', options.reject.path);
      rejectContents = rejectContents.join('\n');
      files.push(writeFile(options.reject.path, rejectContents));
    }
    if (redoAliases) {
      console.log('writing alias file ', options.aliases.path);
      aliasContents = aliasContents.join('\n');
      files.push(writeFile(options.aliases.path, aliasContents));
    }

    if (files.length) {
      return Promise.all(files).then(function() {
        if (options.reloadCommand) {
          return exec(options.reloadCommand).then(function(stdout, stderr) {
            return Promise.resolve();
          });
        }
      });
    } else {
      return Promise.resolve();
    }
  });
}

/**
 * Initialiases the client by sending anu required data to it
 *
 * @param {Socket} socket Socket.io client socket
 * @param {Object} data Data to send to the client
 *
 * @returns {undefined}
 */
function clientInitialise(socket, data) {
  console.log('got client initialise', data);

  // Get initial data
  return aliasDB.read().then(function(aliases) {
    if (typeof data === 'undefined') {
      return Promise.reject(new Error('No reference data given to initialise'));
    }

    //data.result = Object.values(aliases);
    data.result = [];
    Object.keys(aliases).forEach(function(alias) {
      data.result.push(aliases[alias]);
    });

    data.options = {};

    if (options.defaultUser) {
      data.options.defaultUser = options.defaultUser;
    }

    if (options.defaultDomain) {
      data.options.defaultDomain = options.defaultDomain;
    }

    socket.emit('initialise', data);
  }).catch(function(err) {
    console.error(err.stack);
    socket.emit('initialise', {
      error: err.message,
      reference: (typeof data === 'object' && data.reference
          ? data.reference : undefined)
    });
  });
}

/**
 * Function to initialise the alias socket handling functions
 *
 * @param {Socket} io Socket.io socket to use
 * @param {Object} config Configuration options
 *
 * @returns {undefined}
 */
module.exports = function initAlias(io, config) {
  options = config;

  // Check have write access to files
  let checks = [];
  if (options.aliases && options.aliases.file) {
    checks.push(access(options.aliases.file, fs.W_OK));
  }

  if (options.reject && options.reject.file) {
    checks.push(access(options.reject.file, fs.W_OK));
  }

  return Promise.all(checks).catch(function(err) {
    throw err;
  }).then(function() {
    return jsonDB(options.dbPath, {
      id: 'alias'
    });
  }).then(function aliasDbSuccess(db) {
    aliasDB = db;

    // Set up socket stuff
    io.on('connection', function socketConnection(socket) {
     socket.on('alias:initialise', clientInitialise.bind(this, socket));
     socket.on('aliases:save', saveAlias.bind(this, socket));
     socket.on('aliases:read', aliasOperation.bind(this, socket, 'read'));
     socket.on('aliases:delete', aliasOperation.bind(this, socket, 'delete'));
     socket.on('aliases:reload', reloadAliases.bind(this, socket));
    });

    return Promise.resolve({
      reload: reload.bind(this, undefined, undefined)
    });
  });
};
