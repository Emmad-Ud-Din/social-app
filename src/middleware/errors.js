// Central error handling.
//
// Express runs these two functions AFTER every router in app.js:
//   notFound      - no route matched the request, so reply 404 as JSON
//   errorHandler  - a route threw an error (or a database query failed and
//                   the route did not catch it), so turn it into a JSON reply.
//
// In Express 5, an error thrown inside an async route is passed here
// automatically, so a route without its own try/catch (like GET /feed)
// still answers with JSON instead of an HTML error page.

// Postgres error codes that mean "the client sent something wrong".
// Routes can still catch these themselves to give a more specific message;
// this is the fallback for any route that doesn't.
const PG_CLIENT_ERRORS = {
    '23505': [409, 'that already exists'],              // unique / primary key
    '23503': [404, 'a related record was not found'],   // foreign key
    '23514': [400, 'a value breaks a rule'],            // CHECK constraint
    '23502': [400, 'a required value is missing'],      // NOT NULL
    '22P02': [400, 'a value has the wrong type'],       // e.g. "abc" for a number
    '22003': [400, 'a number is out of range'],         // e.g. an id bigger than BIGINT
};

function notFound(req, res) {
    res.status(404).json({ error: 'not found' });
}

// Four parameters (err first) is how Express recognises an error handler.
function errorHandler(err, req, res, next) {
    // express.json() could not read the body, e.g. a missing quote in the JSON
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'request body is not valid JSON' });
    }

    const known = PG_CLIENT_ERRORS[err.code];
    if (known) {
        return res.status(known[0]).json({ error: known[1] });
    }

    // Anything else is a bug or an outage: log the details, hide them from the client.
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
}

module.exports = { notFound, errorHandler };
