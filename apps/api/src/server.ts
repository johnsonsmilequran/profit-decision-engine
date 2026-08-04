import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
import { createDatabase } from "./database/client.js";

const config = readConfig();
const database = createDatabase(config.DATABASE_URL);
const app = buildApp(database);

await app.listen({ host: config.API_HOST, port: config.API_PORT });
