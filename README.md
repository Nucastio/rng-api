# RNG API

## Prerequisites
- [Deno](https://deno.com/) <= v1.44.1


## Running the Server
To start the server, run the following command:
```sh
deno run -A app.ts
```

## Endpoints

### RNG ID

#### `POST rng/generate`
- **Description**: Mints an RNG ID and locks it into the RNG Contract, to be used for getting the random number and updating it to the oracle.
- **Request**:
  - `network`: The network to use (0 for testnet, 1 for mainnet).
  - `blockfrostApiKey`: Your Blockfrost API key.
  - `walletSeed`: The seed phrase for your wallet, must contain exactly 12, 15, or 24 words.
  - `CBORhex`: RNG Contract CBOR-encoded hexadecimal string.
  - `rngfid`: An identifier for the RNG, must be between 4 and 32 characters.
  - `rnlen`: The length of the random number, must be between 1 and 8.

- **Response**:
    - `txHash`: The transaction hash.
    - `datum`: The datum in transaction.
    - `rngfid`: The identifier for the RNG.
    - `rnlen`: The length of the random number.

### Oracle DID

#### `POST oracle/mint`
- **Description**: Mints an Oracle DID to the wallet.
- **Request**:
  - `network`: The network to use (0 for testnet, 1 for mainnet).
  - `blockfrostApiKey`: Your Blockfrost API key.
  - `walletSeed`: The seed phrase for your wallet, must contain exactly 12, 15, or 24 words.
  - `oracleDIDName`: The name of the Oracle DID

- **Response**:
    - `txHash`: The transaction hash.
    - `oracleDIDUnit`: The unit ID of the Oracle DID.

#### `GET oracle/register`
- **Description**: Registers the Oracle DID from the wallet to the contract, which holds the RNG data.
- **Request**:
  - `network`: The network to use (0 for testnet, 1 for mainnet).
  - `blockfrostApiKey`: Your Blockfrost API key.
  - `ogmiosUrl`: The URL of the Ogmios server.
  - `walletSeed`: The seed phrase for your wallet, must contain exactly 12, 15, or 24 words.
  - `CBORhex`: Oracle Contract CBOR-encoded hexadecimal string.
  - `rngfid`: An identifier for the RNG, must be between 4 and 32 characters.
  - `initRNGTx`: The initial RNG transaction.
  - `rnlen`: The length of the random number, must be between 1 and 8.
  - `oracleDIDUnit`: The unit ID of the Oracle DID.

- **Response**:
    - `txHash`: The transaction hash.
    - `oracleDIDUnit`: The unit ID of the Oracle DID.
    - `rngOutput`: RNG data.

#### `POST oracle/update`
- **Description**: Updates the RNG data of Oracle DID in the contract.
- **Request**:

  - `network`: The network to use (0 for testnet, 1 for mainnet).
  - `blockfrostApiKey`: Your Blockfrost API key.
  - `ogmiosUrl`: The URL of the Ogmios server.
  - `walletSeed`: The seed phrase for your wallet, must contain exactly 12, 15, or 24 words.
  - `CBORhex`: Oracle Contract CBOR-encoded hexadecimal string.
  - `rngfid`: An identifier for the RNG, must be between 4 and 32 characters.
  - `initRNGTx`: The initial RNG transaction.
  - `rnlen`: The length of the random number, must be between 1 and 8.
  - `oracleDIDUnit`: The unit ID of the Oracle DID.
  - `currUpdatedOracleDIDTx`: The current updated Oracle DID transaction.

- **Response**:
    - `txHash`: The transaction hash.
    - `oracleDIDUnit`: The unit ID of the Oracle DID.
    - `rngOutput`: RNG data.

#### `GET oracle/query`
- **Description**: Queries the current RNG data from the Oracle DID in the contract.
- **Request**:
  - `network`: The network to use (0 for testnet, 1 for mainnet).
  - `blockfrostApiKey`: Your Blockfrost API key.
  - `currUpdatedOracleDIDTx`: The current updated Oracle DID transaction.

- **Response**:
    - `rngOutput`: RNG data

