import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

import {CurveCryptoSwapTest} from '../contracts-vyper/typechain';
import {rDiv} from '../test/helpers/utils/calculations';

task(
  'ping-curve-pool',
  'Get information about a deployed curve pool'
).setAction(async (_, hre: HardhatRuntimeEnvironment) => {
  const {deployer} = await hre.getNamedAccounts();

  const cryptoSwap = <CurveCryptoSwapTest>(
    await hre.ethers.getContract('CurveCryptoSwapTest', deployer)
  );

  console.log("cryptoswap's address:", cryptoSwap.address);

  const lastPrice = await cryptoSwap.last_prices();
  const priceOracle = await cryptoSwap.price_oracle();

  const deviation = lastPrice.sub(priceOracle);
  const percentageDeviation = rDiv(deviation, priceOracle).mul(100);

  console.log(
    'cryptoswap last_prices:',
    hre.ethers.utils.formatEther(lastPrice)
  );
  console.log(
    'cryptoswap price_oracle:',
    hre.ethers.utils.formatEther(priceOracle)
  );

  console.log(
    'deviation = last_prices - price_oracle',
    hre.ethers.utils.formatEther(deviation)
  );
  console.log(
    '% deviation = deviation/priceOracle * 100',
    hre.ethers.utils.formatEther(percentageDeviation)
  );
});
