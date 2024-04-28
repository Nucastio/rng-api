// deno-lint-ignore-file
import {
    Blockfrost,
    Data,
    fromText,
    Lucid,
    OutRef,
    Script,
    TxHash,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";
import { Context } from "https://deno.land/x/abc@v1.3.3/mod.ts";
import { getRngouput, is32Byte, getBlock, getTransaction } from "../utility/utilityFunctions.ts";
import { rpc, queryVRFOutput } from "../utility/ogmiosUtility.ts";
import Block from "../models/Block.ts";
import WebSocket from "npm:ws";


interface requestBody {
    network: number;
    blockfrostApiKey: string;
    ogmiosUrl: string;
    walletSeed: string;
    CBORhex: string;
    initiator: string;
    rngfid: string;
    seedtxid: string;
    rnlen: number;
    lastUpdatedTx: string;
    oracleDid: string;
}

export const updateOracle = async (ctx: Context) => {
    try {
        const data: requestBody = await ctx.body as requestBody;
        if(!data)
            throw {message: "No request body found"};
        if (data.network !== 0 && data.network !== 1)
            throw { message: "Enter valid network value" };

        const testnet = (data.network === 1) ? "Mainnet" : "Preprod";
        if (!is32Byte(data.initiator)) {
            throw new Error("Initiator must not exceed 32 bytes");
        }
        if (!is32Byte(data.rngfid)) {
            throw new Error("rngfid should be less than equal to 32 bytes");
        }
        const client: WebSocket = new WebSocket(
            data.ogmiosUrl,
        ); //parameterize the url
        if (client) {
            console.log("socket connected");
        }
        const OracleScript: Script = {
            type: "PlutusV2",
            script: data.CBORhex
        };
        const lucid = await Lucid.new(
            new Blockfrost(
                (data.network === 0) ? "https://cardano-preprod.blockfrost.io/api/v0" : "https://cardano-mainnet.blockfrost.io/api/v0",
                data.blockfrostApiKey,
            ),
            testnet
        );

        lucid.selectWalletFromSeed(
            data.walletSeed,
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
                    console.log(response);
                    switch (response.id) {
                        case "find-intersection":
                            if (!response.result?.intersection) {
                                throw "Whoops? Last Byron block disappeared?";
                            }
                            rpc("nextBlock", {}, 1, client);
                            break;

                        default:
                            if (response.result.direction === "forward") {
                                const blockData = response.result as Block;

                                // VRF OUTPUT --START--
                                const vrfOutput = blockData.block.issuer.leaderValue.output;
                                console.log("VRF Output", vrfOutput);
                                const rngoutput = getRngouput(vrfOutput, data.rnlen);
                                console.log("Rngoutput", rngoutput);
                                // --END--

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
                                        initiator: fromText(data.initiator),
                                        rngfid: fromText(data.rngfid),
                                        seedtxid: fromText(data.seedtxid),
                                        rngoutput: fromText(rngoutput),
                                    },
                                    Datum,
                                );
                                //param last update tx
                                const utxo = {
                                    txHash: data.lastUpdatedTx,
                                    outputIndex: 0,
                                };

                                const unit = data.oracleDid;

                                const txLock = await update(utxo);

                                await lucid.awaitTx(txLock);

                                console.log(`Updated Raffle in Contract
                          Tx ID: ${txLock}
                          Datum: ${datum}
                      `);

                                // --- Supporting functions

                                async function update(ref: OutRef): Promise<TxHash> {
                                    const contractAddress = lucid.utils.validatorToAddress(OracleScript);
                                    const [utxo] = await lucid.utxosByOutRef([ref]);

                                    console.log(contractAddress);

                                    const _address = await lucid.wallet.address();

                                    const lower = Date.now() - 600000;
                                    const upper = Date.now() + 600000;

                                    const tx = await lucid
                                        .newTx()
                                        .collectFrom([utxo], Data.void())
                                        .addSigner(_address)
                                        .payToAddressWithData(contractAddress, {
                                            inline: datum,
                                        }, {
                                            [unit]: 1n,
                                        })
                                        .validFrom(lower)
                                        .validTo(upper)
                                        .attachSpendingValidator(OracleScript)
                                        .complete();

                                    const signedTx = await tx.sign().complete();

                                    console.log(signedTx);

                                    return signedTx.submit();
                                }
                                resolve({ txId: txLock, datum: datum });

                            }
                            if (response.id > 0) {
                                rpc("nextBlock", {}, response.id - 1, client);
                            } else {
                                client.close();
                            }
                            break;
                    }
                } catch (error) {
                    console.log(error);
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
            lastUpdatedTx: data.lastUpdatedTx,
            oracleDid: data.oracleDid
        }, 200);
    } catch (err: any) {
        console.log(err);
        ctx.json({ message: err.message || err }, err.status || 500);
    }
}