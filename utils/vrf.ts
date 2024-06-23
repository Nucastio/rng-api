import WebSocket from "npm:ws";
import { intersectionRequest } from "./ogmios.ts";
import { rpc } from "./ogmios.ts";
import { Block } from "../types/index.ts";

interface IGetVRF {
  slot: number;
  blockHash: string;
  ogmiosURL: string;
}

export const getVRFOutput = async ({ ogmiosURL, blockHash, slot }: IGetVRF) => {
  const client = new WebSocket(ogmiosURL);

  client.once("open", () => {
    intersectionRequest(
      {
        slot: slot,
        blockhash: blockHash,
      },
      client
    );
  });

  const vrfReq = new Promise<{ vrfOutput: string }>((resolve, reject) => {
    client.on("message", function (msg: string) {
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
              resolve({
                vrfOutput: blockData.block.issuer.leaderValue.output,
              });
            }
            if (response.id > 0) {
              rpc("nextBlock", {}, response.id - 1, client);
            } else {
              client.close();
            }
            break;
        }
      } catch (error) {
        reject(error);
      }
    });
  });

  const { vrfOutput } = await vrfReq;

  return vrfOutput;
};

export const extractVRFOutput = (vrfOutput: string, rnlen: number) => {
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
