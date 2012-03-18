var conns = [];

function onmessage(event) {
    var workerNr = event.data.workerNr;
    var pool = event.data.pool;
    for (var i=0; i<10; i+=1) {
        conns.push(pool.getConnection());
    }
    event.source.postMessage({
        "workerNr": workerNr,
        "connections": conns
    });
}