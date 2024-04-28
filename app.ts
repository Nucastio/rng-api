import { Application } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import { mint_oracle_did } from "./controllers/mintOracleController.ts";
import { did_register } from "./controllers/didRegisterController.ts";
import { updateOracle } from "./controllers/updateOracleControllers.ts";
import { initiate } from "./controllers/initiateController.ts";

const app = new Application();

app.post("/api/initiate", initiate);
app.post("/api/mint-oracle", mint_oracle_did);
app.post("/api/did-register", did_register);
app.post("/api/update-oracle", updateOracle);


app.start({ port: 7000 });
console.log("Server running at port 7000");