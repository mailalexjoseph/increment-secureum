[![Formatting and Linting](https://github.com/Increment-Finance/increment-protocol/actions/workflows/lint.yml/badge.svg)](https://github.com/Increment-Finance/increment-protocol/actions/workflows/lint.yml)
[![Slither](https://github.com/Increment-Finance/increment-protocol/actions/workflows/slither.yml/badge.svg)](https://github.com/Increment-Finance/increment-protocol/actions/workflows/slither.yml)
[![Unit tests](https://github.com/Increment-Finance/increment-protocol/actions/workflows/tests.yml/badge.svg)](https://github.com/Increment-Finance/increment-protocol/actions/workflows/tests.yml)
[![codecov](https://codecov.io/gh/Increment-Finance/increment-protocol/branch/main/graph/badge.svg?token=VN8BL4MS3Y)](https://codecov.io/gh/Increment-Finance/increment-protocol)

# Increment Protocol

This repository contains the smart contracts for Increment Protocol V1. The repository uses Hardhat as development environment for compilation, testing and deployment tasks. Repo uses [template ethereum contracts](https://github.com/wighawag/template-ethereum-contracts) by
wighawag.

## What is Increment?

Increment utilizes pooled virtual assets and Curve V2’s AMM trading engine to enable on-chain perpetual swaps, allowing traders to long or short global exchange rates with leverage. As the "virtual" part implies, there are only virtual balances in the Curve V2 AMM. Liquidity providers deposit real funds and the system mints the corresponding amount of virtual assets in the AMM as liquidity trading. Liquidity providers receive trading fees in exchange of taking the opposite side of traders.

## Audit scope

### main/

- ClearingHouse
- Insurance
- Perpetual
- Vault
- ~~ClearingHouseViewer~~

### tokens/

- VBase
- VQuote

### lib/

- LibPerpetual
- LibReserve

## External dependencies

### contracts-vyper/

Compilation with Hardhat Vyper takes a very long time. Also, no changes are made to the original curve contracts.
That is why in this folder you will find both written contracts and created objects.

## Documentation

click [here](https://increment-team.gitbook.io/developer-docs/).

## Setup

Install node modules by running

`yarn install`

Prepare a .env file with the following variables

```
# mainnet rpc for mainnet forking
ETH_NODE_URI_MAINNET= "https://eth-mainnet.alchemyapi.io/YOUR_API_KEY"

# your mnemonic
MNEMONIC="test test test test test test test test test test test test"
```

We use alchemy to fork Ethereum Mainnet. You can get a free API key [here](https://www.alchemy.com/).

Install additional dependencies via

`yarn prepare`

## Test

Run unit tests:

`yarn test:unit`

Run integration tests (require API key):

`yarn test:integration`

Run slither (see slither.sh)

`yarn slither`

Run coverage

`yarn coverage`
