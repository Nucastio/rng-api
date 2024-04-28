// deno-lint-ignore-file
import { Context } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import {
    Blockfrost,
    Data,
    fromText,
    Lucid,
    TxHash,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";

interface requestBody {
    network: number; //0 -> preprod 1 -> mainnet
    blockfrostApiKey: string;
    walletSeed: string;
    assetName: string;
}

export const mint_oracle_did = async (ctx: Context) => {
    try {
        const data = await ctx.body as requestBody;
        if (!data) {
            throw { message: "request body not present", status: 400 };
        }
        if (data.network !== 0 && data.network !== 1) {
            throw { message: "Invalid network provided", status: 400 };
        }
        const testnet = (data.network === 0) ? "Preprod" : "Mainnet";
        const lucid = await Lucid.new(
            new Blockfrost(
                (data.network === 0) ? "https://cardano-preprod.blockfrost.io/api/v0" : "https://cardano-mainnet.blockfrost.io/api/v0",
                data.blockfrostApiKey,
            ),
            testnet,
        );

        lucid.selectWalletFromSeed(
            data.walletSeed,
        );

        const { paymentCredential } = lucid.utils.getAddressDetails(
            await lucid.wallet.address(),
        );

        const assetName = data.assetName;

        const mintingPolicy = lucid.utils.nativeScriptFromJson(
            {
                type: "all",
                scripts: [
                    { type: "sig", keyHash: paymentCredential?.hash },
                    {
                        type: "before",
                        slot: 800000000000,
                    },
                ],
            },
        );

        const policyId = lucid.utils.mintingPolicyToId(mintingPolicy);

        const unit = policyId + fromText(assetName);

        const mintTx = await mint();

        await lucid.awaitTx(mintTx);

        console.log(`${assetName} DID Issued
                        Tx ID: ${mintTx}
                    `);

        // --- Supporting functions

        async function mint(): Promise<TxHash> {
            const tx = await lucid
                .newTx()
                .mintAssets({ [unit]: 1n })
                .validTo(Date.now() + 200000)
                .attachMintingPolicy(mintingPolicy)
                .attachMetadata(721, {
                    name: assetName,
                })
                .complete();

            const signedTx = await tx.sign().complete();

            return signedTx.submit();
        }

        ctx.json({ Tx_ID: mintTx, assetName: assetName }, 201);

    } catch (err: any) {
        ctx.json({ err: err.message }, err.status || 500);
    }
}