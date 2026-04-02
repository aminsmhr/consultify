const path = require("path");

require("dotenv").config({ path: path.join(__dirname, ".env") });

module.exports = {
  client: "mysql",
  connection: {
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "rootroot",
    database: process.env.DB_NAME || "consultify",
    port: Number(process.env.DB_PORT || 3306),
  },
};
