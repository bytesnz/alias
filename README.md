# alias
A Postfix email alias manager using Node.js and web sockets

*This is not meant for production purposes - it is mainly for experimenting
with Node.js and web sockets. There is no authentication in the interface.*

`alias` can be used to manage Postfix (or similar) email aliases and reject
lists in a simple web interface. The web interface uses web sockets to
communicate with the server.

The configuration for `alias` is stored as a JSON Object in `config.json`.
The options are:
- `port` *[number]* - port number to listen on
- `address` *[string]* - host name / IP address to listen on
- `aliases` *[Object]*
- `aliases.type` *[string]* - Type of file, currently only regex is supported
- `aliases.path` *[string]* - Path to file
- `reloadCommand` *[string]* - Command to run to reload Postfix once the files
  have been rewritten
- `dbPath` *[string]* - Path to JsonDB to store the aliases in
- `defaultDomain` *[string]* - Default domain for the alias
- `defaultUser` *[string]* - Default destination for alias
