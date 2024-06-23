import {
  Blockfrost,
  Data,
  fromText,
  Lucid,
  Script,
  TxHash,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { Context } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import { UpdateOracleReq } from "../../types/index.ts";
import {
  getBlockData,
  getTxBlockHeight,
  networkData,
} from "../../utils/index.ts";
import { extractVRFOutput, getVRFOutput } from "../../utils/vrf.ts";
import { Oracle } from "../../datum/oracle.ts";

/*
  Oracle DID Registration Route

  Updates the RNG data of Oracle DID in the contract
*/

export const UpdateOracleDIDRoute = async (ctx: Context) => {
  try {
    const rawReqBody = await ctx.body;

    const {
      success,
      data: reqBody,
      error,
    } = UpdateOracleReq.safeParse(rawReqBody);

    if (!success) throw { message: error.errors };

    const {
      CBORhex,
      blockfrostApiKey,
      currUpdatedOracleDIDTx,
      network,
      ogmiosUrl,
      oracleDIDUnit,
      rngfid,
      rnlen,
      initRNGTx,
      walletSeed,
    } = reqBody;

    const { name, blockfrostURL } = networkData[network];

    const lucid = await Lucid.new(
      new Blockfrost(blockfrostURL, blockfrostApiKey),
      name
    );

    lucid.selectWalletFromSeed(walletSeed);

    const walletAddress = await lucid.wallet.address();

    const { paymentCredential } = lucid.utils.getAddressDetails(walletAddress);

    if (!paymentCredential?.hash)
      throw { message: "Pubkey required to update oracle DID" };

    const blockHeight = await getTxBlockHeight({
      blockfrostApiKey: blockfrostApiKey,
      network: network,
      txHash: initRNGTx,
    });

    if (!blockHeight) {
      throw {
        message: "Unable to retrieve the block height of the transaction",
        status: 400,
      };
    }

    const block = await getBlockData({
      blockfrostApiKey: blockfrostApiKey,
      blockHeight,
      network: network,
    });

    if (!block) {
      throw { message: "Unable to retrieve block data", status: 400 };
    }
    const vrfOutput = await getVRFOutput({
      ogmiosURL: ogmiosUrl,
      blockHash: block.hash,
      slot: block.slot,
    });

    const rngOutput = extractVRFOutput(vrfOutput, rnlen);

    const datum = Data.to(
      {
        publisher: paymentCredential.hash,
        initiator: fromText(paymentCredential.hash),
        rngfid: fromText(rngfid),
        seedtxid: fromText(initRNGTx),
        rngoutput: fromText(rngOutput),
      },
      Oracle
    );

    const txHash = await buildTx({
      datum,
      lucidInstance: lucid,
      oracleCborHex: CBORhex,
      oracleDIDUnit: oracleDIDUnit,
      oracleLastUpdatedTx: currUpdatedOracleDIDTx,
    });

    ctx.json(
      {
        data: { txHash, oracleDIDUnit: oracleDIDUnit, rngOutput },
        success: true,
      },
      200
    );
  } catch (err) {
    ctx.json(
      { error: err.message || err, success: false, data: null },
      err.status || 500
    );
  }
};

async function buildTx({
  datum,
  oracleCborHex,
  oracleDIDUnit,
  lucidInstance,
  oracleLastUpdatedTx,
}: {
  datum: string;
  lucidInstance: Lucid;
  oracleCborHex: string;
  oracleDIDUnit: string;
  oracleLastUpdatedTx: string;
}): Promise<TxHash> {
  const OracleScript: Script = {
    type: "PlutusV2",
    script: oracleCborHex,
  };

  const ref = {
    txHash: oracleLastUpdatedTx,
    outputIndex: 0,
  };

  const contractAddress = lucidInstance.utils.validatorToAddress(OracleScript);

  const [oracleUTXO] = await lucidInstance.utxosByOutRef([ref]);

  const walletAddress = await lucidInstance.wallet.address();

  const lower = Date.now() - 600000;
  const upper = Date.now() + 600000;

  const tx = await lucidInstance
    .newTx()
    .collectFrom([oracleUTXO], Data.void())
    .addSigner(walletAddress)
    .payToAddressWithData(
      contractAddress,
      {
        inline: datum,
      },
      {
        [oracleDIDUnit]: 1n,
      }
    )
    .validFrom(lower)
    .validTo(upper)
    .attachSpendingValidator(OracleScript)
    .complete();

  const signedTx = await tx.sign().complete();

  return signedTx.submit();
}
