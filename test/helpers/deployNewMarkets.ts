import env, {ethers} from 'hardhat';

// helpers
import {
  getChainlinkOracle,
  getChainlinkPrice,
  getCryptoSwap,
  getCryptoSwapFactory,
} from '../../helpers/contracts-getters';
import {getCryptoSwapConstructorArgs} from '../../helpers/contracts-deployments';

// types
import {TestPerpetual, ClearingHouse} from '../../typechain';

/*
What contracts don't we need to deploy?
- USDC (public token)
- Chainlink oracle

What contracts do we need to deploy once (for all trading pairs)?
- Vault
- Insurance
- ClearingHouse (+ ClearingHouseViewer)

What contracts do we need to deploy for a new trading pair?
- 2 virtual tokens, vBase and vQuote
- Curve pool for these 2 tokens, at their current ratio
- Perpetual
*/

// The function can't be totally flexible in the argument it takes to create new markets
// because it relies on values which are hardcoded elsewhere like the Chainlink pair addresses
export async function deployJPYUSDMarket(): Promise<TestPerpetual> {
  const [deployer] = await ethers.getSigners();

  // Addresses of Increment contracts deployed once only
  const clearingHouse = <ClearingHouse>(
    await ethers.getContract('ClearingHouse', deployer)
  );

  // 1. Deploy virtual tokens (vJPY & vUSD)
  const VBase = await ethers.getContractFactory('VBase', deployer);
  const vJPY = await VBase.deploy(
    'vJPY base token (JPY/USD pair)',
    'vJPY',
    getChainlinkOracle(env, 'JPY_USD')
  );
  const VQuote = await ethers.getContractFactory('VQuote', deployer);
  const vUSD = await VQuote.deploy('vUSD quote token (JPY/USD pair)', 'vUSD');

  // 2. Create JPY/USD Curve pool
  const initialPrice = await getChainlinkPrice(env, 'JPY_USD');
  console.log(
    'Initial JPY/USD price: ',
    ethers.utils.formatEther(initialPrice)
  );

  const args = getCryptoSwapConstructorArgs(
    'JPY_USD',
    vUSD.address,
    vJPY.address,
    initialPrice
  );

  const cryptoSwapFactory = await getCryptoSwapFactory(env);
  await cryptoSwapFactory.deploy_pool(
    args._name,
    args._symbol,
    args._coins,
    args.A,
    args.gamma,
    args.mid_fee,
    args.out_fee,
    args.allowed_extra_profit,
    args.fee_gamma,
    args.adjustment_step,
    args.admin_fee,
    args.ma_half_time,
    args.initial_price
  );

  const pool = await getCryptoSwap(
    cryptoSwapFactory,
    vUSD.address,
    vJPY.address
  );

  // 3. Deploy JPY/USD Perpetual
  const TestPerpetual = await ethers.getContractFactory(
    'TestPerpetual',
    deployer
  );
  const JPYUSDPerpetual = <TestPerpetual>(
    await TestPerpetual.deploy(
      vJPY.address,
      vUSD.address,
      pool.address,
      clearingHouse.address
    )
  );

  // Register vJPY/vUSD in ClearingHouse
  await (await vJPY.transferOwner(JPYUSDPerpetual.address, true)).wait();
  await (await vUSD.transferOwner(JPYUSDPerpetual.address, true)).wait();
  // Register new Perpetual market in ClearingHouse
  await (
    await clearingHouse.allowListPerpetual(JPYUSDPerpetual.address)
  ).wait();

  return JPYUSDPerpetual;
}
