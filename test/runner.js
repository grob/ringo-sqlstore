var {Parser} = require("ringo/args");
var config = require("./config");
var database = "h2";

export("set", "setDatabase", "getDbProps", "run");

function getDbProps() {
    // print(" (using " + database + ")");
    return config[database];
}

function set(name) {
    database = name;
    return;
};

function setDatabase(args) {
    var parser = new Parser();
    parser.addOption("t", "type", "type", "The database type to connect to");
    var opts = parser.parse(args);
    if (opts.type) {
        if (config[opts.type] == undefined) {
            print("Database connection '" + opts.type + "' is not defined in config.js");
            require("system").exit(-1);
        }
        set(opts.type);
    }
    return args;
};

function run(scope, args) {
    var remainingArgs = setDatabase(Array.slice(args, 1));
    return require('test').run(scope, remainingArgs[0]);
}