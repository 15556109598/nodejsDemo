// config/db.js
const mysql = require('mysql2/promise');
require('dotenv').config(); // 加载 .env 文件中的变量

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // 连接池的最大连接数
    queueLimit: 0
});

module.exports = pool;