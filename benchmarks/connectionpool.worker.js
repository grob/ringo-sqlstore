function onmessage(event) {
    var start = Date.now();
    for (let i=0; i<event.data.cnt; i+=1) {
        let s = Date.now();
        try {
            let conn = event.data.connectionpool.getConnection();
            conn.close();
        } catch (e) {
            // ignore
        }
    }
    var millis = Date.now() - start;
    event.source.postMessage({
        "workerNr": event.data.workerNr,
        "millis": millis,
        "msPerGet": millis / event.data.cnt
    });
}