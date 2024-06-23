import { Network } from "https://deno.land/x/lucid@0.10.7/mod.ts";
import { INetwork } from "../types/index.ts";
import axios from "npm:axios";

export const networkData: Record<
  INetwork,
  {
    name: Network;
    blockfrostURL: string;
  }
> = {
  0: {
    name: "Preprod",
    blockfrostURL: "https://cardano-preprod.blockfrost.io/api/v0",
  },
  1: {
    name: "Mainnet",
    blockfrostURL: "https://cardano-mainnet.blockfrost.io/api/v0",
  },
};

// Blockfrost Queries

export const getTxBlockHeight = async (props: {
  txHash: string;
  network: INetwork;
  blockfrostApiKey: string;
}): Promise<number | null> => {
  try {
    const { blockfrostURL } = networkData[props.network];

    const { data } = await axios.get<{
      block_height: number;
    }>(`${blockfrostURL}/txs/${props.txHash}`, {
      headers: {
        project_id: props.blockfrostApiKey,
      },
    });

    return data.block_height;
  } catch (_error) {
    console.log(_error)
    return null;
  }
};

export const getBlockData = async (props: {
  blockHeight: number;
  network: INetwork;
  blockfrostApiKey: string;
}): Promise<{ slot: number; hash: string } | null> => {
  try {
    const { blockfrostURL } = networkData[props.network];

    const { data } = await axios.get<{
      hash: string;
      slot: number;
    }>(`${blockfrostURL}/blocks/${props.blockHeight}`, {
      headers: {
        project_id: props.blockfrostApiKey,
      },
    });

    return data;
  } catch (_error) {
    return null;
  }
};