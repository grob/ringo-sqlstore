const logging = require("ringo/logging");
logging.setConfig(getResource("./log4j.properties"));
const system = require("system");
const {Parser} = require("ringo/args");
const config = require("./config");

// use the -t option to change the default database
// possible options: postgresql, oracle, mysql, h2
let database = "h2";

const getDbProps = exports.getDbProps = function() {
    return config[database];
};

const set = exports.set = function(name) {
    database = name;
};

const setDatabase = exports.setDatabase = function(args) {
    const parser = new Parser();
    parser.addOption("t", "type", "type", "The database type to connect to");
    const opts = parser.parse(args);
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

const run = exports.run = function(scope, args) {
    const remainingArgs = setDatabase(Array.slice(args, 1));
    return require('test').run(scope, remainingArgs[0]);
};