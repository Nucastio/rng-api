import { Context } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import {
  Blockfrost,
  Data,
  fromText,
  Lucid,
  Script,
  TxHash,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { GenerateReq } from "../types/index.ts";
import { networkData } from "../utils/index.ts";
import { Initiate } from "../datum/initiate.ts";

/*
  RNG ID Generation Route

  Mints an RNG ID and locks it into the RNG Contract in a transaction, 
  to be used for getting the random number and updating it to the oracle.
*/

export const GenerateRNGRoute = async (ctx: Context) => {
  try {
    const rawReqBody = await ctx.body;

    const { success, data: reqBody, error } = GenerateReq.safeParse(rawReqBody);

    if (!success) throw { message: error.errors };

    const { CBORhex, rngfid, blockfrostApiKey, network, walletSeed, rnlen } =
      reqBody;

    const { name, blockfrostURL } = networkData[network];
    console.log(name, blockfrostURL);

    const lucid = await Lucid.new(
      new Blockfrost(blockfrostURL, blockfrostApiKey),
      name
    );

    lucid.selectWalletFromSeed(walletSeed);

    const walletAddress = await lucid.wallet.address();

    const { paymentCredential } = lucid.utils.getAddressDetails(walletAddress);

    if (!paymentCredential?.hash)
      throw { message: "Pubkey required to initiate RNG ID" };

    const datum = Data.to(
      {
        initiator: paymentCredential?.hash,
        rngfid: fromText(rngfid),
        rnlen: BigInt(rnlen),
      },
      Initiate
    );
    console.log(datum);

    const txHash = await buildTx({
      datum: datum,
      lucidInstance: lucid,
      pubkeyHash: paymentCredential.hash,
      RNGCborHex: CBORhex,
      rngID: rngfid,
    });

    ctx.json(
      {
        data: {
          txHash,
          datum,
          rngfid,
          rnlen,
        },
        success: true,
      },
      200
    );
  } catch (err) {
    console.log(err);
    ctx.json({ error: err.message || err, success: false }, 500);
  }
};

async function buildTx({
  datum,
  RNGCborHex,
  lucidInstance,
  rngID,
  pubkeyHash,
}: {
  datum: string;
  lucidInstance: Lucid;
  RNGCborHex: string;
  rngID: string;
  pubkeyHash: string;
}): Promise<TxHash> {
  const LockScript: Script = {
    type: "PlutusV2",
    script: RNGCborHex,
  };

  const contractAddress = lucidInstance.utils.validatorToAddress(LockScript);

  const mintingPolicy = lucidInstance.utils.nativeScriptFromJson({
    type: "all",
    scripts: [
      { type: "sig", keyHash: pubkeyHash },
      {
        type: "before",
        slot: 188888888888,
      },
    ],
  });

  const policyID = lucidInstance.utils.mintingPolicyToId(mintingPolicy);

  const unit = policyID + fromText(rngID);

  const tx = await lucidInstance
    .newTx()
    .mintAssets({ [unit]: 1n })
    .payToAddressWithData(
      contractAddress,
      {
        inline: datum,
      },
      {
        [unit]: 1n,
      }
    )
    .validTo(Date.now() + 200000)
    .attachMintingPolicy(mintingPolicy)
    .attachMetadata(721, {
      "RNG Function ID": rngID,
      "Initiator Public Key Hash": pubkeyHash,
      name: rngID,
    })
    .complete();

  const signedTx = await tx.sign().complete();

  const txHash = await signedTx.submit();
  return txHash;
}
