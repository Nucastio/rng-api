import {
  Blockfrost,
  Data,
  fromText,
  Lucid,
  Script,
  TxHash,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { Context } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import { RegisterOracleReq } from "../../types/index.ts";
import {
  getBlockData,
  getTxBlockHeight,
  networkData,
} from "../../utils/index.ts";
import { getVRFOutput } from "../../utils/vrf.ts";
import { extractVRFOutput } from "../../utils/vrf.ts";
import { Oracle } from "../../datum/oracle.ts";

/*
  Oracle DID Registration Route

  Registers the Oracle DID from the wallet to the contract, which holds the RNG data.
*/

export const RegisterOracleDIDRoute = async (ctx: Context) => {
  try {
    const rawReqBody = await ctx.body;

    const {
      success,
      data: reqBody,
      error,
    } = RegisterOracleReq.safeParse(rawReqBody);

    if (!success) throw { message: error.errors };

    const {
      CBORhex,
      blockfrostApiKey,
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
      throw { message: "Pubkey required to register oracle DID" };

    const blockHeight = await getTxBlockHeight({
      blockfrostApiKey: blockfrostApiKey,
      network,
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
      network,
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
        publisher: paymentCredential?.hash,
        initiator: paymentCredential?.hash,
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
    });

    ctx.json(
      {
        data: {
          txHash,
          oracleDIDUnit: oracleDIDUnit,
          rngOutput,
        },
        success: true,
      },
      200
    );
  } catch (err) {
    ctx.json({ error: err.message, data: null, success: false }, 500);
  }
};

async function buildTx({
  datum,
  oracleCborHex,
  oracleDIDUnit,
  lucidInstance,
}: {
  datum: string;
  lucidInstance: Lucid;
  oracleCborHex: string;
  oracleDIDUnit: string;
}): Promise<TxHash> {
  const OracleScript: Script = {
    type: "PlutusV2",
    script: oracleCborHex,
  };

  const contractAddress = lucidInstance.utils.validatorToAddress(OracleScript);

  const tx = await lucidInstance
    .newTx()
    .payToAddressWithData(
      contractAddress,
      {
        inline: datum,
      },
      {
        [oracleDIDUnit]: 1n,
      }
    )
    .validTo(Date.now() + 200000)
    .complete();

  const signedTx = await tx.sign().complete();
  return signedTx.submit();
}
