var conns = [];

function onmessage(event) {
    var {workerNr, pool, nrOfConnections} = event.data;
    for (var i=0; i<nrOfConnections; i+=1) {
        conns.push(pool.getConnection());
    }
    event.source.postMessage({
        "workerNr": workerNr,
        "connections": conns
    });
}