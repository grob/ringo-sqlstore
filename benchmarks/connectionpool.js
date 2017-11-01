const term = require("ringo/term");
const assert = require("assert");
const {Worker} = require("ringo/worker");
const {Semaphore} = require("ringo/concurrent");
const {init} = require("../lib/connectionpool");

let connectionPool = null;

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
    const semaphore = new Semaphore();
    const workers = new Array(maxWorkers);
    const workerMillis = new Array(maxWorkers);
    const workerMsPerGet = new Array(maxWorkers);
    for (let i=0; i<maxWorkers; i+=1) {
        let worker = new Worker(module.resolve("./connectionpool.worker"));
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
    const workerMillisAvg = workerMillis.reduce(function(prev, current) {
            return prev + current;
        }, 0) / maxWorkers;
    const millisPerGet = workerMillisAvg / cnt;
    const connsPerSec = (1000 / millisPerGet).toFixed(2);
    term.writeln(term.GREEN, maxWorkers, "workers,", cnt, "connections/worker,",
            millisPerGet.toFixed(2) + "ms/connection,", connsPerSec, "connections/sec", term.RESET);
};
