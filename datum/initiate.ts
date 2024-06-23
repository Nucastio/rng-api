import { Data } from "https://deno.land/x/lucid@0.10.7/mod.ts";

const InitiateSchema = Data.Object({
  initiator: Data.Bytes(),
  rngfid: Data.Bytes(),
  rnlen: Data.Integer(),
});

type Initiate = Data.Static<typeof InitiateSchema>;
export const Initiate = InitiateSchema as unknown as Initiate;
