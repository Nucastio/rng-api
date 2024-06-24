import { Application } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import { GenerateRNGRoute } from "./controllers/generateRNG.controller.ts";
import { MintOracleDIDRoute } from "./controllers/oracle/mint.controller.ts";
import { RegisterOracleDIDRoute } from "./controllers/oracle/register.controller.ts";
import { UpdateOracleDIDRoute } from "./controllers/oracle/update.controller.ts";
import { QueryOracleDIDRoute } from "./controllers/oracle/query.controller.ts";
import { logger } from "https://deno.land/x/abc@v1.3.3/middleware/logger.ts";
import { cors } from "https://deno.land/x/abc@v1.3.3/middleware/cors.ts";

const app = new Application();

app.use(logger());

app.use(
  cors({
    allowOrigins: ["*"],
    allowHeaders: ["*"],
  })
);

app.post("/api/rng/generate", GenerateRNGRoute);
app.post("/api/oracle/mint", MintOracleDIDRoute);
app.post("/api/oracle/register", RegisterOracleDIDRoute);
app.post("/api/oracle/update", UpdateOracleDIDRoute);
app.post("/api/oracle/query", QueryOracleDIDRoute);

app.start({ port: 7000 });

console.log("Server running at port 7000");
