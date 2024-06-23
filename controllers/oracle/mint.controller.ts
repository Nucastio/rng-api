import { Context } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import {
  Blockfrost,
  fromText,
  Lucid,
} from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { MintOracleReq, NetworkEnum } from "../../types/index.ts";
import { networkData } from "../../utils/index.ts";

/*
  Oracle DID Mint Route

  Mints an Oracle DID to the wallet.
*/

export const MintOracleDIDRoute = async (ctx: Context) => {
  try {
    const rawReqBody = await ctx.body;

    const {
      success,
      data: reqBody,
      error,
    } = MintOracleReq.safeParse(rawReqBody);

    if (!success) throw { message: error.errors };

    const { oracleDIDName, blockfrostApiKey, network, walletSeed } = reqBody;

    const { name, blockfrostURL } = networkData[network];

    const lucid = await Lucid.new(
      new Blockfrost(blockfrostURL, blockfrostApiKey),
      name
    );

    lucid.selectWalletFromSeed(walletSeed);

    const walletAddress = await lucid.wallet.address();

    const { paymentCredential } = lucid.utils.getAddressDetails(walletAddress);

    if (!paymentCredential?.hash)
      throw { message: "Pubkey required to mint oracle DID" };

    const mintingPolicy = lucid.utils.nativeScriptFromJson({
      type: "all",
      scripts: [
        { type: "sig", keyHash: paymentCredential?.hash },
        {
          type: "before",
          slot: 800000000000,
        },
      ],
    });

    const policyId = lucid.utils.mintingPolicyToId(mintingPolicy);

    const unit = policyId + fromText(oracleDIDName);

    const tx = await lucid
      .newTx()
      .mintAssets({ [unit]: 1n })
      .validTo(Date.now() + 200000)
      .attachMintingPolicy(mintingPolicy)
      .attachMetadata(721, {
        name: oracleDIDName,
      })
      .complete();

    const signedTx = await tx.sign().complete();

    const txHash = await signedTx.submit();

    ctx.json({ data: { txHash, oracleDIDUnit: unit }, success: true }, 200);
  } catch (err) {
    ctx.json(
      { error: err.message, data: null, success: false },
      err.status || 500
    );
  }
};
