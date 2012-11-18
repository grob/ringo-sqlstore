var {Parser} = require("ringo/args");
var config = require("./config");
var database = "h2";

var getDbProps = exports.getDbProps = function() {
    return config[database];
};

var set = exports.set = function(name) {
    database = name;
    return;
};

var setDatabase = exports.setDatabase = function(args) {
    var parser = new Parser();
    parser.addOption("t", "type", "type", "The database type to connect to");
    var opts = parser.parse(args);
    if (opts.type) {
        if (config[opts.type] == undefined) {
            console.error("Database connection '" + opts.type +
                    "' is not defined in config.js");
            system.exit(-1);
        }
        set(opts.type);
    }
    return args;
};

var run = exports.run = function(scope, args) {
    var remainingArgs = setDatabase(Array.slice(args, 1));
    return require('test').run(scope, remainingArgs[0]);
};