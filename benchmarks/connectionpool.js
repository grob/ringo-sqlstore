var term = require("ringo/term");
var assert = require("assert");
var {Worker} = require("ringo/worker");
var {Semaphore} = require("ringo/concurrent");
var {init} = require("../lib/connectionpool");

var connectionPool = null;

exports.setUp = function(dbProps) {
     connectionPool = init(dbProps);
};

exports.tearDown = function() {
    connectionPool.close();
};

exports.start = function(cnt, maxWorkers) {
    cnt || (cnt = 20000);
    maxWorkers = maxWorkers || (maxWorkers = 100);

    term.writeln("Using", connectionPool.getDriverClassName());
    var semaphore = new Semaphore();
    var workers = new Array(maxWorkers);
    var workerMillis = new Array(maxWorkers);
    var workerMsPerGet = new Array(maxWorkers);
    for (let i=0; i<maxWorkers; i+=1) {
        var worker = new Worker(module.resolve("./connectionpool.worker"));
        worker.onmessage = function(event) {
            workerMillis[event.data.workerNr] = event.data.millis;
            workerMsPerGet[event.data.workerNr] = event.data.msPerGet;
            semaphore.signal();
        };
        worker.onerror = function(event) {
            term.writeln(term.RED, "Worker error", event.data.toSource(), term.RESET);
            semaphore.signal();
        };
        workers[i] = worker;
    }
    term.writeln("Setup", maxWorkers, "workers");

    workers.forEach(function(worker, idx) {
        worker.postMessage({
            "workerNr": idx,
            "connectionpool": connectionPool,
            "cnt": cnt
        }, true);
    });
    semaphore.wait(maxWorkers);
    term.writeln(maxWorkers, "workers finished");
    var workerMillisAvg = workerMillis.reduce(function(prev, current) {
            return prev + current;
        }, 0) / maxWorkers;
    var millisPerGet = workerMillisAvg / cnt;
    var connsPerSec = (1000 / millisPerGet).toFixed(2);
    term.writeln(term.GREEN, maxWorkers, "workers,", cnt, "connections/worker,",
            millisPerGet.toFixed(2) + "ms/connection,", connsPerSec, "connections/sec", term.RESET);
};
