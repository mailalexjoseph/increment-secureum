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
import '@primitivefi/hardhat-dodoc';
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
      default: 6,
    },
    lpTwo: {
      default: 7,
    },
    liquidator: {
      default: '0x57485dDa80B2eA63F1f0bB5a8877Abf4C6d14f52',
    },
    frontend: {
      default: '0xB2a98504D0943163701202301f13E07aCE53bD11',
    },
    backend: {
      default: '0x43aC7bc6b21f6cCEC8d55e08ed752FEF9aFd174C',
    },
    tester: {
      default: '0xD8D12d91f2B52eE858CB34619979B2A80f9a9261',
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
    runOnCompile: false,
    strict: true,
    only: [
      'Perpetual',
      'Vault',
      'Insurance',
      'ClearingHouse',
      'VBase',
      'VQuote',
    ],
  },
  dodoc: {
    outputDir: 'wiki/',
    include: [
      'Insurance',
      'Vault',
      'Perpetual',
      'ClearingHouse',
      'VBase',
      'VQuote',
    ],
    exclude: ['node_modules'],
  },
};
export default config;
