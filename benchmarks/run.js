const fs = require("fs");
const system = require("system");
const term = require("ringo/term");
const {Parser} = require("ringo/args");
const {Profiler} = require("ringo/profiler");
const {getOptimizationLevel} = require("ringo/engine");
const logging = require("ringo/logging");
logging.setConfig(getResource("../test/log4j.properties"));

const config = require("../test/config");
const database = "h2";

const parser = new Parser();
parser.addOption("t", "type", "type", "The database type to connect to");

const printUsage = function() {
    term.writeln("Usage:");
    term.writeln(" ringo run.js [options] path/to/benchmark/module [iterations]");
    term.writeln("Options:");
    term.writeln(parser.help());
};

const run = function() {
    const optLevel = getOptimizationLevel();
    let profiler = null;
    const benchmark = require(file);
    try {
        benchmark.setUp(dbProps);
        if (optLevel < 0) {
            profiler = new Profiler();
            profiler.attach();
        }
        benchmark.start.apply(null, arguments);
        if (profiler !== null) {
            console.log("\n" + profiler.formatResult(30))
        }
    } finally {
        benchmark.tearDown(dbProps);
    }
};

if (require.main == module.id) {
    const args = arguments.slice(1);
    const opts = parser.parse(args);
    const dbProps = config[opts.type || "h2"];
    if (!dbProps) {
        term.writeln(term.RED, "Database connection '" + opts.type +
                "' is not defined in config.js", term.RESET);
        system.exit(-1);
    }
    console.dir(dbProps);
    const path = args.shift();
    if (!path) {
        term.writeln(term.RED, "Missing benchmark module argument", term.RESET);
        printUsage();
        system.exit(-1);
    }
    const file = module.resolve(path);
    if (!fs.exists(file)) {
        term.writeln(term.RED, "Invalid benchmark module '" + file + "'", term.RESET);
        printUsage();
        system.exit(-1);
    }
    run.apply(null, args);
    system.exit(1);
}