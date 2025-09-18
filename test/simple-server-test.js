// Simple server test
const express = require('express');
const app = express();

app.get('/test', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(5002, () => {
    console.log('Test server running on port 5002');
});