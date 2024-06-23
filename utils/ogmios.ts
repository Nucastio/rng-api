export function rpc(
  method: string,
  params: {
    points?: {
      slot?: number;
      id?: string;
    }[];
  },
  id: string | number,
  client: WebSocket
) {
  client.send(
    JSON.stringify({
      jsonrpc: "2.0",
      method,
      params,
      id,
    })
  );
}

export const intersectionRequest = (
  block: { slot: number; blockhash: string },
  client: WebSocket
) => {
  rpc(
    "findIntersection",
    {
      points: [
        {
          id: block.blockhash,
          slot: block.slot,
        },
      ],
    },
    "find-intersection",
    client
  );
};
