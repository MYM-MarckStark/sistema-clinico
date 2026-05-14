const http = require('http');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`OK - Server running on port ${PORT}\nPATH: ${req.url}\n`);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Test server listening on 0.0.0.0:${PORT}`);
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
});
