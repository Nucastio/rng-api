// deno-lint-ignore-file
export const getRngouput = (vrfOutput: string, rnlen: number) => {
    let str = "";
    let i = 0;
    while (str.length < rnlen && i < vrfOutput.length) {
        if (!Number.isNaN(parseInt(vrfOutput[i]))) {
            str += vrfOutput[i];
        }
        i++;
    }
    return str;
};

export function is32Byte(str: string): boolean {
    return str.length <= 32;
}
export async function getTransaction(txHash: string, testnet: string, blockfrostApiKey: string): Promise<number | undefined> {
    try {
        const txRes = (testnet === 'Preprod') ? await fetch(
            `https://cardano-preprod.blockfrost.io/api/v0/txs/${txHash}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "project_id": blockfrostApiKey,
                },
            },
        ) : await fetch(
            `https://cardano-mainnet.blockfrost.io/api/v0/txs/${txHash}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "project_id": blockfrostApiKey,
                },
            },
        );
        const tx = await txRes.json();
        if (!tx) {
            throw { message: "Could not get tx" };
        }
        return tx.block_height;
    } catch (err: any) {
        console.log(err);
        return err;
    }
}

export async function getBlock(
    blockHeight: number, testnet: string, blockfrostApiKey: string
): Promise<{ slot: number; hash: string }> {
    try {
        const blockRes = (testnet === 'Preprod') ? await fetch(
            `https://cardano-preprod.blockfrost.io/api/v0/blocks/${blockHeight}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "project_id": blockfrostApiKey,
                },
            },
        ) : await fetch(
            `https://cardano-mainnet.blockfrost.io/api/v0/blocks/${blockHeight}`,
            {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "project_id": blockfrostApiKey,
                },
            },
        )
        const txBlock = await blockRes.json();
        if (!txBlock) {
            throw { message: "Could not get block data" };
        }
        return { slot: txBlock.slot, hash: txBlock.hash };
    } catch (err: any) {
        console.log(err);
        return err;
    }
}