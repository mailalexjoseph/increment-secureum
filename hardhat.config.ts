import fs from 'fs';
import path from 'path';

import 'dotenv/config';
import 'hardhat-gas-reporter';
// import '@nomiclabs/hardhat-vyper';
import 'hardhat-contract-sizer';

import 'hardhat-contract-sizer';
import 'hardhat-deploy';
import '@typechain/hardhat';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';

import 'solidity-coverage';
import 'hardhat-gas-reporter';
import 'hardhat-spdx-license-identifier';
import {HardhatUserConfig} from 'hardhat/types';
import {node_url, accounts} from './helpers/network';

// While waiting for hardhat PR: https://github.com/nomiclabs/hardhat/pull/1542
if (process.env.HARDHAT_FORK) {
  process.env['HARDHAT_DEPLOY_FORK'] = process.env.HARDHAT_FORK;
}

// Prevent to load scripts before compilation and typechain
const tasksPath = path.join(__dirname, 'tasks');
fs.readdirSync(tasksPath)
  .filter((pth) => pth.includes('.ts'))
  .forEach((task) => {
    require(`${tasksPath}/${task}`);
  });

const getHardhatConf = () => {
  if (process.env.HARDHAT_FORK == 'mainnet') {
    return {
      // process.env.HARDHAT_FORK will specify the network that the fork is made from.
      // this line ensure the use of the corresponding accounts
      accounts: accounts(process.env.HARDHAT_FORK),
      forking: {
        url: node_url('MAINNET'),
        blockNumber: 14191019,
      },
      allowUnlimitedContractSize: true,
    };
  }
  return {};
};

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: getHardhatConf(),
    localhost: {
      url: node_url('localhost'),
      accounts: accounts(),
    },
    staging: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby'),
    },
    production: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
    },
    mainnet: {
      url: node_url('mainnet'),
      accounts: accounts('mainnet'),
    },
    rinkeby: {
      url: node_url('rinkeby'),
      accounts: accounts('rinkeby'),
    },
    kovan: {
      url: node_url('kovan'),
      accounts: accounts('kovan'),
    },
    goerli: {
      url: node_url('goerli'),
      accounts: accounts('goerli'),
    },
  },
  solidity: {
    compilers: [
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    user: {
      default: 1,
    },
    bob: {
      default: 2,
    },
    alice: {
      default: 3,
    },
    trader: {
      default: 4,
    },
    lp: {
      default: 5,
    },
    traderTwo: {
      default: 4,
    },
    lpTwo: {
      default: 5,
    },
  },
  etherscan: {
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: process.env.ETHERSCAN_API,
  },
  paths: {
    artifacts: 'artifacts',
    sources: 'contracts',
    tests: 'test',
    deploy: ['deploy'],
  },
  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
    enabled: process.env.REPORT_GAS ? true : false,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    maxMethodDiff: 10,
    remoteContracts: [],
  },
  typechain: {
    outDir: 'typechain',
    target: 'ethers-v5',
  },
  mocha: {
    timeout: 0,
  },
  // vyper: {
  //   version: '0.3.1',
  // },
  external: {
    contracts: [
      {
        artifacts: 'contracts-vyper',
      },
    ],
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [
      'Perpetual',
      'Vault',
      'Insurance',
      'TWAPOracle',
      'ChainlinkOracle',
      'ChainlinkTWAPOracle',
      'PoolTWAPOracle',
      'ClearingHouse',
    ],
  },
};
export default config;
