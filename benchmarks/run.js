var fs = require("fs");
var system = require("system");
var term = require("ringo/term");
var {Parser} = require("ringo/args");
var {Profiler} = require("ringo/profiler");
var {getOptimizationLevel} = require("ringo/engine");

var config = require("../test/config");
var database = "h2";

var parser = new Parser();
parser.addOption("t", "type", "type", "The database type to connect to");

var printUsage = function() {
    term.writeln("Usage:");
    term.writeln(" ringo run.js [options] path/to/benchmark/module [iterations]");
    term.writeln("Options:");
    term.writeln(parser.help());
};

var run = function() {
    var optLevel = getOptimizationLevel();
    var profiler = null;
    if (optLevel < 0) {
        profiler = new Profiler();
        profiler.attach();
    }
    var benchmark = require(file);
    try {
        benchmark.setUp(dbProps);
        benchmark.start.apply(null, arguments);
    } finally {
        benchmark.tearDown(dbProps);
    }
    if (profiler !== null) {
        console.log("\n" + profiler.formatResult(30))
    }
};

if (require.main == module.id) {
    var args = arguments.slice(1);
    var opts = parser.parse(args);
    var dbProps = config[opts.type || "h2"];
    if (!dbProps) {
        term.writeln(term.RED, "Database connection '" + opts.type +
                "' is not defined in config.js", term.RESET);
        system.exit(-1);
    }
    var path = args.shift();
    var file = null;
    if (!path) {
        term.writeln(term.RED, "Missing benchmark module argument", term.RESET);
        printUsage();
        system.exit(-1);
    }
    var file = module.resolve(path);
    if (!fs.exists(file)) {
        term.writeln(term.RED, "Invalid benchmark module '" + file + "'", term.RESET);
        printUsage();
        system.exit(-1);
    }
    run.apply(null, args);
    system.exit(1);
};