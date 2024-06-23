import { Data } from "https://deno.land/x/lucid@0.10.7/mod.ts";

const OracleSchema = Data.Object({
  publisher: Data.Bytes(),
  initiator: Data.Bytes(),
  rngfid: Data.Bytes(),
  seedtxid: Data.Bytes(),
  rngoutput: Data.Bytes(),
});

type Oracle = Data.Static<typeof OracleSchema>;
export const Oracle = OracleSchema as unknown as Oracle;
