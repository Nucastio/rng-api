import {
  Blockfrost,
  Data,
  Lucid,
  toText,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { Context } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import { Oracle } from "../../datum/oracle.ts";
import { QueryOracleReq } from "../../types/index.ts";
import { networkData } from "../../utils/index.ts";

/*
  Oracle DID Query Route

  Queries the current RNG data from the Oracle DID in the contract.
*/

export const QueryOracleDIDRoute = async (ctx: Context) => {
  try {
    const rawReqBody = await ctx.body;

    const {
      success,
      data: reqBody,
      error,
    } = QueryOracleReq.safeParse(rawReqBody);

    if (!success) throw { message: error.errors };

    const { blockfrostApiKey, currUpdatedOracleDIDTx, network } = reqBody;

    const { name, blockfrostURL } = networkData[network];

    const lucid = await Lucid.new(
      new Blockfrost(blockfrostURL, blockfrostApiKey),
      name
    );

    const ref = {
      txHash: currUpdatedOracleDIDTx,
      outputIndex: 0,
    };

    const [oracleUTXO] = await lucid.utxosByOutRef([ref]);

    if (!oracleUTXO || !oracleUTXO.datum)
      throw { message: "Oracle DID not found in the referenced UTXO" };

    const datum = Data.from(oracleUTXO?.datum, Oracle) as {
      rngoutput: string;
    };

    ctx.json(
      { data: { rngOutput: toText(datum.rngoutput) }, success: true },
      200
    );
  } catch (err) {
    console.log(err);
    ctx.json(
      { error: err.message || err, success: false, data: null },
      err.status || 500
    );
  }
};
