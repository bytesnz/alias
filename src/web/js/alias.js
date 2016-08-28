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
"use strict";

(function() {
  // Set up socket
  var socket = io.connect({});

  var references = {};
  var nextReferenceId = 1;
  var rows = {};
  var nextRowId = 0;

  var main;
  var footer;
  var list;
  var options;
  var searchFields = [];

  var fields = {
    alias: {
      label: 'Alias',
      required: true
    },
    regex: {
      label: 'Regex?',
      type: 'boolean'
    },
    user: {
      label: 'Destination',
      required: true
    },
    description: {
      label: 'Description',
      required: true
    },
    blocked: {
      type: 'boolean',
      label: 'Blocked?'
    }
  };

  /**
   * Displays an error message
   *
   * @param {String} err Error message
   *
   * @returns {undefined}
   */
  function error(err) {
    updateStatus('Error: ' + err, 'error');
  }

  /**
   * Searches through the rows and finds the index for the given alias
   *
   * @param {String} alias Alias to search for
   *
   * @returns {Number} Index of alias or -1 if the alias was not found
   */
  function findAliasIndex(alias) {
    var rowKeys = Object.keys(rows);
    var rowId;
    
    if (typeof (rowId = rowKeys.find(function(id) {
      return rows[id].alias.value === alias;
    })) !== 'undefined') {
      return rowId;
    } else {
      return -1;
    }
  }

  /**
   * Update status message
   *
   * @param {String} message New status message
   * @param {String} [className] Class to set on footer for message
   *
   * @returns {undefined}
   */
  function updateStatus(message, className) {
    if (message) {
      if (className === 'error') {
        console.error(message);
      } else {
        console.log(message);
      }
    }
    if (footer) {
      if (!message) {
        message = '';
      }
      footer.innerHTML = message;
      if (className) {
        footer.className = className;
      } else {
        footer.className = '';
      }
    }
  }

  /**@internal
   * Generates a random email address to use as an alias
   *
   * @param {Integer} length Length of local part of the email
   * @param {String} domain Domain name for random email
   *
   * @returns {String} Generated email address
   */
  function aliasGenerate(length, domain) {
    if (!length) {
      length = 10;
    }

    var string = '',
        l, n;

    for (l = 0; l < length; l++) {
      // 

      while ((n = Math.floor(Math.random() * 35)) === 35) {}

      if (n < 10) {
        string += n;
      } else {
        string += String.fromCharCode(n + 87);
      }
    }

    console.log(options);
    // Add on @domain
    if (domain) {
      string += '@' + domain;
    } else {
      string += '@' + (options.defaultDomain || '');
    }

    return string;
  }

  /**@internal
   * Create a random local-part email address in the given input element
   *
   * @param {HTMLHtmlElement} element Input to make the random alias in
   *
   * @returns {undefined}
   */
  function makeRandomAlias(element) {
    var value = element.value;
    value = value.replace(/^.*(@.*)?$/, '$1');
    element.value = aliasGenerate(10, value);
  }

  /**
   * Attempts to copy the alias to the clipboard
   *
   * @param {HTMLDomElement} input Input to copy from
   *
   * @returns {undefined}
   */
  function copyAlias(input) {
    input.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      alert('Failed to execute copy command');
    }
  }

  /**
   * Draw a new row
   *
   * @param {Object} data Initial data for the new row
   * @param {Boolean} scrollToView If true, scroll new row into view
   *
   * @returns {undefined}
   */
  function newRow(data, scrollToView) {
    var f,
        label, field;
    if (!list) {
      throw new Error('No list element yet, can\'t create new rows');
    }

    var id = nextRowId++;
    var row = rows[id] = {
      id: id
    };

    if (typeof data === 'undefined') {
      row.changed = true;
      row.unsaved = true;
      data = {};
    }

    row.data = data;

    // Create a new row in the list
    list.appendChild((row.row = document.createElement('div')));

    // Create cells
    for (f in fields) {
      row.row.appendChild((label = document.createElement('label')));
      label.appendChild(document.createTextNode(fields[f].label));
      label.appendChild((row[f] = document.createElement('input')));
      if (fields[f].type) {
        if (fields[f].type === 'boolean') {
          row[f].setAttribute('type', 'checkbox');
          row[f].value = 1;
        } else {
          row[f].setAttribute('type', fields[f].type);
        }
      }
      if (fields[f].required) {
        row[f].setAttribute('required', true);
      }
      if (data[f]) {
        if (fields[f].type === 'boolean') {
          row[f].setAttribute('checked', 'checked');
        } else {
          row[f].value = data[f];
        }
      } else if (fields[f].default) {
        if (typeof fields[f].default === 'function') {
          row[f].value = fields[f].default();
        } else {
          row[f].value = fields[f].default;
        }
      }

      // Add a random button if no value for the alias
      if (f === 'alias') {
        label.appendChild((row.copy = document.createElement('button')));
        row.copy.textContent = 'Copy';
        row.copy.addEventListener('click',
            copyAlias.bind(this, row.alias));
        if (!data[f]) {
          row.copy.className = 'hidden';
          label.appendChild((row.random = document.createElement('button')));
          row.random.textContent = 'Random';
          row.random.addEventListener('click',
              makeRandomAlias.bind(this, row.alias));
        } else {
          row[f].readOnly = true;
        }
      }

      // Add changed event checker
      row[f].addEventListener('change', checkChanged.bind(this, row));
    }
    
    // Add and call regex/email handler
    row.regex.addEventListener('change', updateAliasType.bind(this, row));
    row.alias.addEventListener('change', checkAliasRegex.bind(this, row));
    updateAliasType(row);

    // Add delete button to row
    row.row.appendChild((label = document.createElement('div')));
    label.appendChild((field = document.createElement('button')));
    field.textContent = 'Save';
    field.addEventListener('click', saveRow.bind(this, row));
    label.appendChild((field = document.createElement('button')));
    field.textContent = 'Delete';
    field.addEventListener('click', deleteRow.bind(this, row));

    if (row.unsaved) {
      window.scrollTo(0,document.body.scrollHeight);
    }

    return id;
  }

  /**
   * Changes the type and the pattern of the alias input box based on the
   * value of the regex checkbox
   *
   * @param {Object} store Object containing references to all fields
   *
   * @returns {undefined}
   */
  function updateAliasType(store) {
    if (store.regex.checked) {
      store.alias.type = 'text';
      // Pattern courtousy of http://stackoverflow.com/questions/172303/is-there-a-regular-expression-to-detect-a-valid-regular-expression
      //store.alias.setAttribute('pattern', '/^((?:(?:[^?+*{}()[\]\\|]+|\\.|\[(?:\^?\\.|\^[^\\]|[^\\^])(?:[^\]\\]+|\\.)*\]|\((?:\?[:=!]|\?<[=!]|\?>)?(?1)??\)|\(\?(?:R|[+-]?\d+)\))(?:(?:[?+*]|\{\d+(?:,\d*)?\})[?+]?)?|\|)*)$/');
    } else {
      store.alias.type = 'email';
      store.alias.removeAttribute('pattern');
    }
    checkAliasRegex(store);
  }

  /**
   * Checks if the value of alias is a valid regular expression if regex is
   * checked.
   *
   * @param {Object} store Object containing references to all fields
   *
   * @returns {undefined}
   */
  function checkAliasRegex(store) {
    if (store.regex.checked) {
      try {
        new RegExp(store.alias.value);
        store.alias.setCustomValidity('');
      } catch(err) {
        store.alias.setCustomValidity('Invalid Regex: ' + err.message);
      }
    } else {
      store.alias.setCustomValidity('');
    }
  }

  /**
   * Saves the row on the server
   *
   * @param {Object} row Object containing the DOM Elements
   *
   * @returns {undefined}
   */
  function saveRow(row) {
    // Check values require
    var errors = '';

    Object.keys(fields).forEach(function(field) {
      var errorMsg;
      if (!row[field].checkValidity()) {
        errorMsg = row[field].validationMessage;
        errors = errors + '- ' + fields[field].label + (errorMsg ? ': '
            + errorMsg : '') + '\n';
      }
    });

    if (errors) {
      alert('The correct the values for the following fields:\n' + errors);
      return;
    }

    //Build data to send to server
    var id = nextReferenceId++;
    references[id] = {
      reference: id,
      time: new Date(),
      type: 'save',
      aliases: [{
        id: row.id,
        alias: row.alias.value,
        description: row.description.value,
        user: row.user.value,
        blocked: row.blocked.checked,
        regex: row.regex.checked
      }]
    };

    socket.emit('aliases:save', references[id]);
    updateStatus('Saving alias ' + row.alias.value);
  }

  /**
   * Deletes a row
   *
   * @param {Object} row TODO
   *
   * @returns {undefined}
   */
  function deleteRow(row) {
    // Check values require
    var errors = '';

    if (row.unsaved) {
      // Just delete the unsaved row
      list.removeChild(row.row);
      updateStatus('Alias ' + row.alias.value + ' removed');
    } else {
      //Build data to send to server
      var id = nextReferenceId++;
      references[id] = {
        reference: id,
        time: new Date(),
        type: 'delete',
        id: row.id,
        filter: row.alias.value
      };

      socket.emit('aliases:delete', references[id]);
      updateStatus('Deleting alias ' + row.alias.value);
    }
  }

  /**
   * Saves all rows that have been changed, excluding any non-valid rows
   *
   * @returns {undefined}
   */
  function saveAll() {
    var aliases = [];
    var errors = '';

    // Find all rows that are changed
    Object.keys(rows).forEach(function(r) {
      // Check values require
      if (rows[r].changed) {
        Object.keys(fields).forEach(function(field) {
          var errorMsg;
          if (!rows[r][field].checkValidity()) {
            errorMsg = rows[r][field].validationMessage;
            errors = errors + '- ' + fields[field].label + (errorMsg ? ': '
                + errorMsg : '') + '\n';
          }
        });

        if (!errors) {
          aliases.push({
            id: rows[r].id,
            alias: rows[r].alias.value,
            description: rows[r].description.value,
            user: rows[r].user.value,
            blocked: rows[r].blocked.checked,
            regex: rows[r].regex.checked
          });
        }
      }
    });

    if (errors) {
      alert('The correct the values for the following fields:\n' + errors);
      return;
    }

    //Build data to send to server
    var id = nextReferenceId++;
    references[id] = {
      reference: id,
      time: new Date(),
      type: 'save',
      aliases: aliases
    };

    socket.emit('aliases:save', references[id]);
    updateStatus('Saving ' + aliases.length + ' alias(es)');
  }

  /**
   * Searches the alias and comments for the string enterred into the search
   * field.
   *
   * @param {HTMLDOMElement} searchField Search field to get the search value
   *   from
   *
   * @return {undefined}
   */
  function search(searchField) {
    var searchValue = searchField.value;
    var searchRegex;


    // Try creating a regular expression
    try {
      searchRegex = new RegExp(searchValue, "i");
      searchField.setCustomValidity('');
    } catch(err) {
      searchField.setCustomValidity('Invalid search: ' + err.message);
      return;
    }

    // Update all the other search boxes
    searchFields.forEach(function(field) {
      if (field !== searchField) {
        field.value = searchValue;
      }
    });

    console.log('searching for', searchRegex);

    // Search through row
    Object.keys(rows).forEach(function(r) {
      rows[r].row.classList.toggle('notin',
          !(searchRegex.exec(rows[r].alias.value) !== null
          || searchRegex.exec(rows[r].description.value) !== null));
    });
  }

  /**
   * Checks if the values in a row have changed from the saved values.
   *
   * @param {Object} row Row to check
   *
   * @returns {Boolean} true if the row has changed, false otherwise
   */
  function checkChanged(row) {
    var changed = false, f;
    for (f in fields) {
      if ((fields[f].type === 'boolean'
          && Boolean(row.data[f]) != row[f].checked)
          || row.data[f] !== row[f].value) {
        changed = true;
        break;
      }
    }

    row.row.classList.toggle('changed', changed);
    row.changed = (changed ? 1 : 0);
    return changed;
  }


  /**@internal
   * Sends a command to the server to recompile the lists and reload Postfix
   *
   * @returns {undefined}
   */
  function reloadPostfix() {
    //Build data to send to server
    var id = nextReferenceId++;
    references[id] = {
      reference: id,
      time: new Date(),
      type: 'postfix'
    };

    socket.emit('aliases:postfix', references[id]);
    updateStatus('Reloading Postfix');
  }

  /**@internal
   * Reloads the list of aliases from the server
   *
   * @returns{undefined}
   */
  function emitReloadList() {
    //Build data to send to server
    var id = nextReferenceId++;
    references[id] = {
      reference: id,
      time: new Date(),
      type: 'reload'
    };

    socket.emit('aliases:reload', references[id]);
    updateStatus();
  }

  /**@internal
   * Tests the data does not contain an error and has a corresponding
   * reference in the references before running the given callback function
   *
   * @param {Function} callback Function to call once the data has been
   *   validated. Function will be passed the data and the reference once
   *   the data has been verified.
   * @param {Object} data Data passed by the server
   *
   * @returns {undefined}
   */
  function handleData(callback, data) {
    console.log('received data', data);
    var reference;
    // Check for an error
    if (data.error) {
      error(data.error);
    } else if (typeof data.reference === 'undefined') {
      console.error('Could not find reference in returned data', data);
    } else if (typeof (reference = references[data.reference]) === 'undefined') {
      // Ignore
    } else {
      if (callback) {
        callback(data, reference);
      }
    }

    // Remove reference from collection
    if (typeof data.reference !== 'undefined'
        && typeof references[data.reference] !== 'undefined') {
      delete references[data.reference];
    }
  }

  /**
   * Prints rows with the refreshed data from the server. Goes through existing
   * rows, updates any values already displayed, creates new rows for the
   * data not displayed, and removes any values that have been removed on
   * the server (and that aren't new on the client).
   *
   * @param {Object[]} newRows Row data from server
   * @param {Boolean} replace Whether or not to replace the existing aliases
   *   in the list
   *
   * @return {undefined}
   */
  function printRows(newRows, replace) {
    var touchedRows = [];
    
    if (replace) {
      var lc;
      
      // Clear the existing rows
      if (replace) {
        //Remove all but the header row
        while(list.childElementCount > 1 && (lc = list.lastChild)) {
          list.removeChild(lc);
        }
      }

      // Print the
      newRows.forEach(function (row) {
        newRow(row);
      });
    } else {
      newRows.forEach(function (newRowData) {
        var currentRow, currentIndex;
        // Find the row
        if ((currentIndex = findAliasIndex(newRowData.alias)) !== -1) {
          currentRow = rows[currentIndex];
          touchedRows.push(currentIndex);
          // Check if it is changed
          if (currentRow.changed) {
            // Check for differences
            var differences = [];
            // TODO
          } else {
            // Go through and update rows
            Object.keys(fields).forEach(function (field) {
              if (field === 'alias') {
                return;
              }

              if (fields[field].type === 'boolean') {
                currentRow[field].checked = (newRowData[field] ? true : false);
              } else {
                currentRow[field].value = newRowData[field];
              }
            });
          }
        } else {
          // Add a new row
          touchedRows.push(newRow(newRowData));
        }
      });

      // Delete any rows that weren't touched (and were deleted)
      Object.keys(rows).forEach(function(id) {
        // Check if the row is changed TODO do we need to tell the difference between new and changed?
        if (touchedRows.indexOf(id) === -1) {
          rows[id].row.remove();
          delete rows[id];
        }
      });
    }
  }

  // Set up socket event hooks
  /**@internal
   * Handles the initialisation message received from the server
   *
   * @param {Object} data Data passed by server
   *
   * @returns {undefined}
   */
  socket.on('initialise', handleData.bind(this, 
      function handleInitialise(data) {
    // Store options
    if (data.options) {
      options = data.options;
    }

    // Set default user
    if (options.defaultUser) {
      fields.user.default = options.defaultUser;
    }

    // Set default alias if have domain
    if (options.defaultDomain) {
      fields.alias.default = '@' + options.defaultDomain;
    }

    // Create list of aliases
    if (data.result) {
      printRows(data.result, true);
    }
  }));

  /**@internal
   * Handles the result message received from the server
   *
   * @param {Object} data Data passed by server
   *
   * @returns {undefined}
   */
  socket.on('result', handleData.bind(this,
      function handleResult(data, reference) {
    switch (reference.type) {
      case 'create':
      case 'update':
      case 'save':
        // Mark row as saved
        reference.aliases.forEach(function(alias) {
          if (rows[alias.id]
              && rows[alias.id].changed) {
            delete rows[alias.id].changed;
            delete rows[alias.id].unsaved;
            rows[alias.id].row.classList.toggle('changed', false);
            rows[alias.id].alias.readOnly = true;
            rows[alias.id].copy.className = '';
            if (rows[alias.id].random) {
              rows[alias.id].random.parentNode.removeChild(rows[alias.id].random);
              delete rows[alias.id].random;
            }
          }
        });
        if (typeof data.result === 'string') {
          updateStatus('Alias ' + data.result + ' saved');
        } else if (typeof data.result === 'number') {
          updateStatus(data.result + ' alias(es) saved');
        } else {
          updateStatus('Alias(es) saved');
        }
        break;
      case 'delete':
        if (rows[reference.id]) {
          list.removeChild(rows[reference.id].row);
        }
        updateStatus('Alias ' + reference.filter + ' removed');
        break;
      case 'reload':
        printRows(data.result);
        updateStatus('Aliases reload');
        break;
      case 'postfix':
        updateStatus('Postfix reloaded');
        break;
    }
  }));

  socket.on('reload', function(data) {
    // Ensure we have data
    if (data instanceof Object && data.aliases instanceof Array) {
      printRows(data.result);
      updateStatus('Aliases reload');
    }
  });

  // Initialise (will also receive current aliases
  var id = nextReferenceId++;
  references[id] = {
    reference: id,
    time: new Date(),
    type: 'initialise'
  };

  socket.emit('alias:initialise', references[id]);

  /**
   * Create the control buttons in the given element
   *
   * @param {HTMLHtmlObject} element Element to put the buttons into
   *
   * @returns {undefined}
   */
  function createButtons(element) {
    var button, input;
    
    element.appendChild((button = document.createElement('button')));
    button.textContent = 'Reload Postfix';
    button.addEventListener('click', reloadPostfix);

    element.appendChild((button = document.createElement('button')));
    button.textContent = 'Reload List';
    button.addEventListener('click', emitReloadList);

    element.appendChild((button = document.createElement('button')));
    button.textContent = 'New';
    button.addEventListener('click', newRow.bind(this, undefined));

    element.appendChild((button = document.createElement('button')));
    button.textContent = 'Save All';
    button.addEventListener('click', saveAll.bind(this));

    element.appendChild((input = document.createElement('input')));
    input.setAttribute('type', 'search');
    input.setAttribute('placeholder', 'Alias Search');
    //input.addEventListener('input', search.bind(this, input));
    input.addEventListener('keyup', search.bind(this, input));
    searchFields.push(input);
    element.appendChild((button = document.createElement('button')));
    button.textContent = 'X';
    button.addEventListener('click', function() {
      input.value = '';
      search.call(this, input);
    }.bind(this));
  }

  // Add hook for UI
  document.addEventListener('DOMContentLoaded', function () {
    if ((main = document.querySelector('body > main')) === null) {
      throw new Error('Could not find main element');
    }

    footer = document.querySelector('body > footer');

    var row, f, element;
    
    // Create button rows
    main.appendChild((row = document.createElement('div')));
    row.className = 'buttons';
    createButtons(row);

    // Create list
    main.appendChild((list = document.createElement('div')));
    list.className = 'list';

    //Create header
    list.appendChild((row = document.createElement('div')));
    row.className = 'header';

    for (f in fields) {
      row.appendChild((element = document.createElement('div')));
      element.textContent = fields[f].label;
    }

    // Create button rows
    main.appendChild((row = document.createElement('div')));
    row.className = 'buttons';
    createButtons(row);
  });
})();
