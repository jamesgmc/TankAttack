const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize DB
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);
});

const registerUser = (username, password, callback) => {
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return callback(err);
        db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash], function(err) {
            callback(err, this ? this.lastID : null);
        });
    });
};

const loginUser = (username, password, callback) => {
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return callback(err);
        if (!row) return callback(null, false);
        
        bcrypt.compare(password, row.password, (err, result) => {
            if (err) return callback(err);
            if (result) return callback(null, row);
            return callback(null, false);
        });
    });
};

module.exports = { registerUser, loginUser };
