import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

export enum INetwork {
  Preprod,
  Mainnet,
}

export const NetworkEnum = z.nativeEnum(INetwork);

export interface Block {
  block: {
    issuer: {
      leaderValue: {
        output: string;
        proof: string;
      };
    };
  };
}

const validateSeedWordCount = (value: string) => {
  const ALLOWED_COUNTS = [12, 15, 24];
  return ALLOWED_COUNTS.includes(value.split(" ").length);
};

export const MintOracleReq = z.object({
  network: NetworkEnum,
  blockfrostApiKey: z.string(),
  walletSeed: z.string().refine(validateSeedWordCount, {
    message: "The seed phrase must contain exactly 12, 15, or 24 words",
  }),
  oracleDIDName: z.string().max(64),
});

export const RegisterOracleReq = z.object({
  network: NetworkEnum,
  blockfrostApiKey: z.string(),
  ogmiosUrl: z.string().url(),
  walletSeed: z.string().refine(validateSeedWordCount, {
    message: "The seed phrase must contain exactly 12, 15, or 24 words",
  }),
  CBORhex: z.string(),
  rngfid: z.string().min(4).max(32),
  initRNGTx: z.string(),
  rnlen: z.number().min(1).max(8),
  oracleDIDUnit: z.string(),
});

export const GenerateReq = z.object({
  network: NetworkEnum,
  blockfrostApiKey: z.string(),
  walletSeed: z.string().refine(validateSeedWordCount, {
    message: "The seed phrase must contain exactly 12, 15, or 24 words",
  }),
  CBORhex: z.string(),
  rngfid: z.string().min(4).max(32),
  rnlen: z.number().min(1).max(8),
});

export const UpdateOracleReq = z.object({
  network: NetworkEnum,
  blockfrostApiKey: z.string(),
  ogmiosUrl: z.string().url(),
  walletSeed: z.string().refine(validateSeedWordCount, {
    message: "The seed phrase must contain exactly 12, 15, or 24 words",
  }),
  CBORhex: z.string(),
  rngfid: z.string().min(4).max(32),
  initRNGTx: z.string(),
  rnlen: z.number().min(1).max(8),
  oracleDIDUnit: z.string(),
  currUpdatedOracleDIDTx: z.string(),
});

export const QueryOracleReq = z.object({
  network: NetworkEnum,
  blockfrostApiKey: z.string(),
  currUpdatedOracleDIDTx: z.string(),
});
