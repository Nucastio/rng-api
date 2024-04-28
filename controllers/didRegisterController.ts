// deno-lint-ignore-file
import {
    Blockfrost,
    Data,
    fromText,
    Lucid,
    Script,
    TxHash,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";

import { getRngouput, is32Byte, getBlock, getTransaction } from "../utility/utilityFunctions.ts";
import { rpc, queryVRFOutput } from "../utility/ogmiosUtility.ts";
import Block from "../models/Block.ts";
import { Context } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import WebSocket from "npm:ws";

interface requestBody {
    network: number; //0->preprod 1->mainnet 
    blockfrostApiKey: string;
    ogmiosUrl: string;
    walletSeed: string;
    CBORhex: string;
    initiator: string;
    rngfid: string;
    seedtxid: string;
    rnlen: number;
    oracleDid: string;
}

export const did_register = async (ctx: Context) => {
    try {
        const data: requestBody = await ctx.body as requestBody;
        if (data.network !== 0 && data.network !== 1)
            throw { message: "Enter valid network value" };

        const testnet = (data.network === 1) ? "Mainnet" : "Preprod";

        if (!is32Byte(data.initiator)) {
            throw new Error("initiator should be less than equal to 32 bytes ");
        }

        if (!is32Byte(data.rngfid)) {
            throw new Error("rngfid should be less than equal to 32 bytes");
        }

        const client: WebSocket = new WebSocket(
            data.ogmiosUrl,
        );

        if (client) {
            console.log("socket connected");
        }

        const OracleScript: Script = {
            type: "PlutusV2",
            script: data.CBORhex
        };
        console.log(testnet);
        const networkUrl = (data.network === 0) ? "https://cardano-preprod.blockfrost.io/api/v0" : "https://cardano-mainnet.blockfrost.io/api/v0";
        const lucid = await Lucid.new(
            new Blockfrost(
                networkUrl,
                data.blockfrostApiKey,
            ),
            testnet,
        );

        lucid.selectWalletFromSeed(
            data.walletSeed
        );

        const { paymentCredential } = lucid.utils.getAddressDetails(
            await lucid.wallet.address(),
        );
        const txBlockHeight = await getTransaction(data.seedtxid, testnet, data.blockfrostApiKey);
        if (!txBlockHeight) {
            throw { message: "Could not get transaction", status: 400 };
        }
        const block = await getBlock(txBlockHeight, testnet, data.blockfrostApiKey);
        if (!block) {
            throw { message: "Could not get block data", status: 400 };
        }
        client.once("open", () => {
            // You can only query inside this open
            queryVRFOutput({
                slot: block.slot,
                blockhash: block.hash,
            }, client);
        });
        const resData: Promise<{ txId: string, datum: string }> = new Promise((resolve, reject) => {
            client.on("message", async function (msg: any) {
                try {

                    const response = JSON.parse(msg);

                    switch (response.id) {
                        case "find-intersection":
                            if (!response.result?.intersection) {
                                throw { message: "Whoops? Last Byron block disappeared?" };
                            }
                            rpc("nextBlock", {}, 1, client);
                            break;

                        default:
                            if (response.result.direction === "forward") {
                                const blockData = response.result as Block;
                                // VRF OUTPUT --START--
                                const vrfOutput = blockData.block.issuer.leaderValue.output;
                                console.log(
                                    "VRF Output",
                                    vrfOutput
                                );
                                const rngoutput = getRngouput(vrfOutput, data.rnlen);
                                console.log("Rngoutput", rngoutput);
                                // ---- Lock asset ----
                                const Datum = Data.Object({
                                    publisher: Data.Bytes(),
                                    initiator: Data.Bytes(),
                                    rngfid: Data.Bytes(),
                                    seedtxid: Data.Bytes(),
                                    rngoutput: Data.Bytes(),
                                });

                                type Datum = Data.Static<typeof Datum>;
                                const datum = Data.to(
                                    {
                                        publisher: paymentCredential?.hash,
                                        initiator: fromText(data.initiator), //32 bytes string param
                                        rngfid: fromText(data.rngfid),
                                        seedtxid: fromText(data.seedtxid),
                                        rngoutput: fromText(rngoutput)
                                    },
                                    Datum,
                                );
                                const unit = data.oracleDid;

                                const tx = await did_register({ datum: datum });
                                await lucid.awaitTx(tx);

                                console.log(`DID Register in contract
                          Tx ID: ${tx}
                          Datum: ${datum}
                      `);
                                resolve({ txId: tx, datum: datum });

                                async function did_register(
                                    { datum }: { datum: string },
                                ): Promise<TxHash> {
                                    const contractAddress = lucid.utils.validatorToAddress(OracleScript);

                                    console.log(contractAddress);

                                    const tx = await lucid
                                        .newTx()
                                        .payToAddressWithData(contractAddress, {
                                            inline: datum,
                                        }, {
                                            [unit]: 1n,
                                        })
                                        .validTo(Date.now() + 200000)
                                        .complete();
                                    if (!tx)
                                        throw { message: "tx not found" };
                                    const signedTx = await tx.sign().complete();
                                    console.log(signedTx);
                                    return signedTx.submit();
                                }
                                // --END--
                            }
                            if (response.id > 0) {
                                rpc("nextBlock", {}, response.id - 1, client);
                            } else {
                                client.close();
                            }
                            break;
                    }
                }
                catch (error) {
                    reject(error);
                }
            });
        });
        const res = await resData;

        ctx.json({
            txId: res.txId,
            datum: res.datum,
            initiator: data.initiator,
            rngfid: data.rngfid,
            seedtxid: data.seedtxid,
            rnlen: data.rnlen,
            oracleDid: data.oracleDid
        }, 200);
    }
    catch (err: any) {
        console.log(err);
        ctx.json({ error: err.message }, 500);
    }
}