// deno-lint-ignore-file
import { Context } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import {
    Blockfrost,
    Data,
    fromText,
    Lucid,
    Script,
    TxHash,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";
import { is32Byte } from "../utility/utilityFunctions.ts";

interface RequestBody {
    network: number; //0-> preprod 1-> mainnet
    blockfrostApiKey: string;
    walletSeed: string;
    CBORhex: string;
    rngfid: string;
    rnlen: number;
}
let globalRngFId: string | null = null;

function generateRngFId() {
    const array = new Uint8Array(10);
    crypto.getRandomValues(array);
    const id = Array.from(array).map((b) => b.toString(16).padStart(2, "0")).join(
        "",
    ).slice(0, 17);
    return "rngfid_" + id;
}
// Wait for the ID to be generated before continuing
globalRngFId = generateRngFId();
const assetName = globalRngFId;
console.log(globalRngFId);

export const initiate = async (ctx: Context) => {
    try {
        if (!ctx.body) {
            throw new Error("Body not found");
        }
        const data: RequestBody = await ctx.body as RequestBody;

        console.log(data)

        if (!is32Byte(data.rngfid)) {
            throw new Error("The rngfid is not 32 bytes long");
        }
        if (data.network !== 0 && data.network !== 1)
            throw { message: "Enter valid network value" };
        if (data.rnlen < 1 || data.rnlen > 8) {
            throw new Error("The rnlen should be between 1-8");
        }

        const testnet = (data.network === 1) ? "Mainnet" : "Preprod";
        const LockScript: Script = {
            type: "PlutusV2",
            script: data.CBORhex
        };
        const networkUrl = (data.network === 0) ? "https://cardano-preprod.blockfrost.io/api/v0" : "https://cardano-mainnet.blockfrost.io/api/v0";
        console.log(networkUrl)
        const lucid = await Lucid.new(
            new Blockfrost(
                networkUrl,
                data.blockfrostApiKey
            ),
            testnet,
        );
        console.log(lucid)
        lucid.selectWalletFromSeed(data.walletSeed);
        const { paymentCredential } = lucid.utils.getAddressDetails(
            await lucid.wallet.address(),
        );

        console.log(paymentCredential)

        // ---- Lock asset ----
        const Datum = Data.Object({
            initiator: Data.Bytes(),
            rngfid: Data.Bytes(),
            rnlen: Data.Integer(),
        });
        console.log(Datum)

        type Datum = Data.Static<typeof Datum>;
        const datum = Data.to(
            {
                initiator: paymentCredential?.hash,
                rngfid: fromText(data.rngfid) || fromText(globalRngFId as string),
                rnlen: BigInt(data.rnlen),
            },
            Datum,
        );
        const mintingPolicy = lucid.utils.nativeScriptFromJson(
            {
                type: "all",
                scripts: [
                    { type: "sig", keyHash: paymentCredential?.hash },
                    {
                        type: "before",
                        slot: 188888888888,
                    },
                ],
            },
        );

        const policyId = lucid.utils.mintingPolicyToId(mintingPolicy);
        console.log(policyId)

        const unit = policyId + fromText(assetName);

        const txLock = await lock({ datum: datum });
        console.log(txLock);
        await lucid.awaitTx(txLock);

        console.log(`${assetName} locked into the contract
            Tx ID: ${txLock}
            Datum: ${datum}
        `);
        // --- Supporting functions

        async function lock({ datum }: { datum: string }): Promise<TxHash> {
            const contractAddress = lucid.utils.validatorToAddress(LockScript);

            const tx = await lucid
                .newTx()
                .mintAssets({ [unit]: 1n })
                .payToAddressWithData(contractAddress, {
                    inline: datum,
                }, {
                    [unit]: 1n,
                })
                .validTo(Date.now() + 200000)
                .attachMintingPolicy(mintingPolicy)
                .attachMetadata(721, {
                    "RNG Function ID": assetName,
                    "Initiator Public Key Hash": paymentCredential?.hash,
                    name: assetName,
                })
                .complete();

            const signedTx = await tx.sign().complete();

            const txHash = await signedTx.submit();
            return txHash;
        }
        ctx.json({
            txId: txLock,
            datum: datum,
            rngfid: data.rngfid,
            rnlen: data.rnlen
        }, 200);
    } catch (err: any) {
        console.log(err)
        ctx.json({ error: err.message || err }, 500);
    }
}