# Increment Protocol

![MIT](https://img.shields.io/badge/license-MIT-blue.svg)
[![Formatting and Linting](https://github.com/Increment-Finance/increment-protocol/actions/workflows/lint.yml/badge.svg)](https://github.com/Increment-Finance/increment-protocol/actions/workflows/lint.yml)
[![Slither](https://github.com/Increment-Finance/increment-protocol/actions/workflows/slither.yml/badge.svg)](https://github.com/Increment-Finance/increment-protocol/actions/workflows/slither.yml)
[![Unit tests](https://github.com/Increment-Finance/increment-protocol/actions/workflows/tests.yml/badge.svg)](https://github.com/Increment-Finance/increment-protocol/actions/workflows/tests.yml)
[![Coverage](https://github.com/Increment-Finance/increment-protocol/actions/workflows/coverage.yml/badge.svg)](https://github.com/Increment-Finance/increment-protocol/actions/workflows/coverage.yml)

# Boilerplate for ethereum solidity smart contract development

## INSTALL

```bash
yarn
```

## TEST

```bash
yarn test
```

or

```bash
yarn fork:test mainnet
```

## COVERAGE

```bash
yarn test
```

## LINT

```bash
yarn lint(:fix)
```

## FORMAT

```bash
yarn format(:fix)
```

****\*\*\*\*****\*\*****\*\*\*\*****\*\*****\*\*\*\*****\*\*****\*\*\*\*****\*\*\*****\*\*\*\*****\*\*****\*\*\*\*****\*\*****\*\*\*\*****\*\*****\*\*\*\*****+

## OTHER

## SCRIPTS

Here is the list of npm scripts you can execute:

Some of them relies on [./\_scripts.js](./_scripts.js) to allow parameterizing it via command line argument (have a look inside if you need modifications)
<br/><br/>

`yarn prepare`

As a standard lifecycle npm script, it is executed automatically upon install. It generate config file and typechain to get you started with type safe contract interactions
<br/><br/>

`yarn lint`, `yarn lint:fix`, `yarn format` and `yarn format:fix`

These will lint and format check your code. the `:fix` version will modifiy the files to match the requirement specified in `.eslintrc` and `.prettierrc.`
<br/><br/>

`yarn compile`

These will compile your contracts
<br/><br/>

`yarn void:deploy`

This will deploy your contracts on the in-memory hardhat network and exit, leaving no trace. quick way to ensure deployments work as intended without consequences
<br/><br/>

`yarn test [mocha args...]`

These will execute your tests using mocha. you can pass extra arguments to mocha
<br/><br/>

`yarn coverage`

These will produce a coverage report in the `coverage/` folder
<br/><br/>

`yarn gas`

These will produce a gas report for function used in the tests
<br/><br/>

`yarn dev`

These will run a local hardhat network on `localhost:8545` and deploy your contracts on it. Plus it will watch for any changes and redeploy them.
<br/><br/>

`yarn local:dev`

This assumes a local node it running on `localhost:8545`. It will deploy your contracts on it. Plus it will watch for any changes and redeploy them.
<br/><br/>

`yarn execute <network> <file.ts> [args...]`

This will execute the script `<file.ts>` against the specified network
<br/><br/>

`yarn deploy <network> [args...]`

This will deploy the contract on the specified network.

Behind the scene it uses `hardhat deploy` command so you can append any argument for it
<br/><br/>

`yarn export <network> <file.json>`

This will export the abi+address of deployed contract to `<file.json>`
<br/><br/>

`yarn fork:execute <network> [--blockNumber <blockNumber>] [--deploy] <file.ts> [args...]`

This will execute the script `<file.ts>` against a temporary fork of the specified network

if `--deploy` is used, deploy scripts will be executed
<br/><br/>

`yarn fork:deploy <network> [--blockNumber <blockNumber>] [args...]`

This will deploy the contract against a temporary fork of the specified network.

Behind the scene it uses `hardhat deploy` command so you can append any argument for it
<br/><br/>

`yarn fork:test <network> [--blockNumber <blockNumber>] [mocha args...]`

This will test the contract against a temporary fork of the specified network.
<br/><br/>

`yarn fork:dev <network> [--blockNumber <blockNumber>] [args...]`

This will deploy the contract against a fork of the specified network and it will keep running as a node.

Behind the scene it uses `hardhat node` command so you can append any argument for it

Feel free to [copy and paste this list](https://gist.githubusercontent.com/maurelian/13831f1940340e0dcd0482555eb5c4fe/raw/4f771be560d48a6adf7a4caf1283f723ac81011e/audit_prep_checklist.md) into a README, issue or elsewhere in your project.

### Audit prep checklist ([reference](https://diligence.consensys.net/posts/2019/09/how-to-prepare-for-a-smart-contract-audit/))

- [ ] Documentation (A plain english description of what you are building, and why you are building it. Should indicate the actions and states that should and should not be possible)
  - [ ] For the overall system
  - [ ] For each unique contract within the system
- [ ] Clean code
  - [ ] Run a linter (like [EthLint](https://www.ethlint.com/))
  - [ ] Fix compiler warnings
  - [ ] Remove TODO and FIXME comments
  - [ ] Delete unused code
- [ ] Testing
  - [ ] README gives clear instructions for running tests
  - [ ] Testing dependencies are packaged with the code OR are listed including versions
- [ ] Automated Analysis
  - [ ] Analysis with [MythX](https://mythx.io/)
  - [ ] [Other tools](https://consensys.github.io/smart-contract-best-practices/security_tools/)
- [ ] Frozen code
  - [ ] Halt development of the contract code
  - [ ] Provide commit hash for the audit to target
