import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
import { createDatabase } from "./database/client.js";

const config = readConfig();
const database = createDatabase(config.DATABASE_URL);
const app = buildApp(database, {
  uploadDirectory: config.UPLOAD_DIR,
  auth: {
    clientId: config.DINGTALK_CLIENT_ID,
    clientSecret: config.DINGTALK_CLIENT_SECRET,
    redirectUri: config.DINGTALK_REDIRECT_URI,
    webOrigin: config.WEB_ORIGIN,
    production: config.NODE_ENV === "production",
  },
});

await app.listen({ host: config.API_HOST, port: config.API_PORT });
