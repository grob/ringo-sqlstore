var scheduler = require("ringo/scheduler");
var schedulerId = null;

/**
 * Start the scheduler which removes stale connections.
 * @param {Object} event This method expects the event's "data" property
 * to contain the connections vector.
 */
var onmessage = function onmessage(event) {
    if (schedulerId != null) {
        scheduler.clearInterval(schedulerId);
    }
    scheduler.setInterval(function() {
        var iter = event.data.iterator();
        while (iter.hasNext()) {
            var conn = iter.next();
            if (conn.isStale()) {
                conn.getConnection().close();
                iter.remove();
                event.source.postMessage(conn);
            }
        }
        return;
    }, 60000);
};
