import {expect} from 'chai';
import env, {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {deployMockContract, MockContract} from 'ethereum-waffle';

import {
  TwapOracle,
  TwapOracle__factory,
  ChainlinkOracle__factory,
} from '../../typechain';
import {CurveCryptoSwap2ETH__factory} from '../../contracts-vyper/typechain';

import {rMul, rDiv} from '../helpers/utils/calculations';

async function getLatestTimestamp(
  hre: HardhatRuntimeEnvironment
): Promise<number> {
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  const block = await hre.ethers.provider.getBlock(blockNumber);
  return block.timestamp;
}

const nextBlockTimestamp = 2000000000;

async function addTimeToNextBlockTimestamp(
  hre: HardhatRuntimeEnvironment,
  additionalTimestamp: number
): Promise<number> {
  // nextBlockTimestamp += additionalTimestamp;

  // await hre.network.provider.request({
  //   method: 'evm_setNextBlockTimestamp',
  //   params: [nextBlockTimestamp],
  // });
  await hre.network.provider.request({
    method: 'evm_increaseTime',
    params: [additionalTimestamp - 1], // -1 to ensure we exclude the mining operation
  });
  const latestTimestamp = await getLatestTimestamp(hre);
  return latestTimestamp;
}

const DEFAULT_EUR_USD_PRICE = 1.131523;

type User = {twapOracle: TwapOracle};

describe.only('TwapOracle', async function () {
  let chainlinkMock: MockContract;
  let curvePoolMock: MockContract;
  let user: User;
  let PERIOD: number;
  let snapshotId: number;

  async function _deploy_TWAPOracle() {
    const [deployer] = await ethers.getSigners();

    // deploy chainlink oracle as a mock
    chainlinkMock = await deployMockContract(
      deployer,
      ChainlinkOracle__factory.abi
    );

    // deploy curve pool as a mock
    curvePoolMock = await deployMockContract(
      deployer,
      CurveCryptoSwap2ETH__factory.abi
    );

    await _set_chainlinkOracle_indexPrice(1); // update even before the TWAP oracle is deployed
    await _set_curvePool_price_oracle(1); // update even before the TWAP oracle is deployed

    const TWAPOracleContract = await ethers.getContractFactory('TwapOracle');
    const twapOracle = <TwapOracle>(
      await TWAPOracleContract.deploy(
        chainlinkMock.address,
        curvePoolMock.address
      )
    );

    return {twapOracle};
  }

  // @param newIndexPrice New price index (e.g. EUR/USD) with 1e18 decimal
  async function _set_chainlinkOracle_indexPrice(newIndexPrice: number) {
    // console.log(`newIndexPrice: ${newIndexPrice}`);

    const formattedNewIndexPrice = ethers.utils.parseEther(
      newIndexPrice.toString()
    );
    await chainlinkMock.mock.getIndexPrice.returns(formattedNewIndexPrice);
  }
  async function _set_curvePool_price_oracle(newPriceOracle: number) {
    // console.log(`vBaseAmount: ${vBaseAmount} - vQuoteAmount: ${vQuoteAmount}`);

    const formattedNewPriceOracle = ethers.utils.parseEther(
      newPriceOracle.toString()
    );
    await curvePoolMock.mock.last_prices.returns(formattedNewPriceOracle);
  }

  before(async () => {
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  beforeEach(async () => {
    // user = await setup();
    user = await _deploy_TWAPOracle();
    PERIOD = (await user.twapOracle.PERIOD()).toNumber();
  });

  after(async () => {
    await env.network.provider.send('evm_revert', [snapshotId]);
  });

  it('Should initialize TWAP with initial price points values', async () => {
    const initPrice = ethers.utils.parseEther('1');
    expect(await user.twapOracle.getOracleTwap()).to.be.equal(initPrice);
    expect(await user.twapOracle.getMarketTwap()).to.be.equal(initPrice);
    // TODO add other checks here
  });

  it('TWAP value should properly account for variations of the underlying chainlink oracle index price', async () => {
    await _set_chainlinkOracle_indexPrice(1);
    const firstTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.twapOracle.updateTwap();
    expect(await user.twapOracle.getOracleTwap()).to.eq(
      ethers.utils.parseEther('1')
    );

    const cumulativeAmountBeforeSecondUpdate = (
      await user.twapOracle.oraclePrice()
    ).cumulativeAmount;

    await _set_chainlinkOracle_indexPrice(3);
    const secondTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.twapOracle.updateTwap();

    // cumulativeAmount = cumulativeAmount + newPrice * timeElapsed;
    const newPrice = ethers.utils.parseEther('3');
    const timeElapsed = ethers.BigNumber.from(
      (secondTimestamp - firstTimestamp).toString()
    );
    const productPriceTime = newPrice.mul(timeElapsed);
    const expectedCumulativeAmount =
      cumulativeAmountBeforeSecondUpdate.add(productPriceTime);

    expect((await user.twapOracle.oraclePrice()).cumulativeAmount).to.eq(
      expectedCumulativeAmount
    );

    const cumulativeAmount = expectedCumulativeAmount;
    const timeOfCumulativeAmount = ethers.BigNumber.from(
      secondTimestamp.toString()
    );

    console.log(
      'TWAP is',
      (await user.twapOracle.getOracleTwap()).toString(),
      '\n'
    );

    // this far `cumulativeAmountAtBeginningOfPeriod` and `timeOfCumulativeAmountAtBeginningOfPeriod` are worth blockTimestamp
    const expectedTWAP = ethers.utils.parseEther('1'); // initial price
    expect(await user.twapOracle.getOracleTwap()).to.eq(expectedTWAP);

    console.log('++++++++++++++++++++++++++++++++++++++++++++++++++++++++');
    console.log('start simulation');
    await _set_chainlinkOracle_indexPrice(5);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.twapOracle.updateTwap();
    console.log(
      'TWAP is',
      (await user.twapOracle.getOracleTwap()).toString(),
      '\n'
    );

    await _set_chainlinkOracle_indexPrice(10);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.twapOracle.updateTwap();
    console.log(
      'TWAP is',
      (await user.twapOracle.getOracleTwap()).toString(),
      '\n'
    );

    await _set_chainlinkOracle_indexPrice(10);
    await addTimeToNextBlockTimestamp(env, PERIOD);
    await user.twapOracle.updateTwap();
    console.log(
      'TWAP is',
      (await user.twapOracle.getOracleTwap()).toString(),
      '\n'
    );

    await _set_chainlinkOracle_indexPrice(20);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.twapOracle.updateTwap();
    console.log(
      'TWAP is',
      (await user.twapOracle.getOracleTwap()).toString(),
      '\n'
    );

    await _set_chainlinkOracle_indexPrice(10);
    await addTimeToNextBlockTimestamp(env, PERIOD);
    await user.twapOracle.updateTwap();
    console.log(
      'TWAP is',
      (await user.twapOracle.getOracleTwap()).toString(),
      '\n'
    );

    await _set_chainlinkOracle_indexPrice(20);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.twapOracle.updateTwap();
    console.log(
      'TWAP is',
      (await user.twapOracle.getOracleTwap()).toString(),
      '\n'
    );

    await _set_chainlinkOracle_indexPrice(DEFAULT_EUR_USD_PRICE);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.twapOracle.updateTwap();
    console.log(
      'TWAP is',
      (await user.twapOracle.getOracleTwap()).toString(),
      '\n'
    );

    const cumulativeAmountBeforeLastUpdate = (
      await user.twapOracle.oraclePrice()
    ).cumulativeAmount;
    const timeOfCumulativeAmountBeforeLastUpdate = (
      await user.twapOracle.time()
    ).blockTimestampLast;

    await _set_chainlinkOracle_indexPrice(DEFAULT_EUR_USD_PRICE);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.twapOracle.updateTwap();

    // cumulativeAmount = cumulativeAmount + newPrice * timeElapsed;
    const newPriceLastUpdate = ethers.utils.parseEther(
      DEFAULT_EUR_USD_PRICE.toString()
    );

    const timeOfCumulativeAmountLastUpdate = (await user.twapOracle.time())
      .blockTimestampLast;
    const expectedTimeElapsed = timeOfCumulativeAmountLastUpdate.sub(
      timeOfCumulativeAmountBeforeLastUpdate
    );

    const productPriceTimeLastUpdate =
      newPriceLastUpdate.mul(expectedTimeElapsed);
    const expectedCumulativeAmountLastUpdate =
      cumulativeAmountBeforeLastUpdate.add(productPriceTimeLastUpdate);

    expect((await user.twapOracle.oraclePrice()).cumulativeAmount).to.eq(
      expectedCumulativeAmountLastUpdate
    );

    const cumulativeAmountLastUpdate = expectedCumulativeAmountLastUpdate;
    const cumulativeAmountAtBeginningOfPeriodAtLastUpdate = (
      await user.twapOracle.oraclePrice()
    ).cumulativeAmountAtBeginningOfPeriod;

    const expectedPriceDiffLastUpdate = cumulativeAmountLastUpdate.sub(
      cumulativeAmountAtBeginningOfPeriodAtLastUpdate
    );

    const timeOfCumulativeAmountAtBeginningOfPeriodAtLastUpdate = (
      await user.twapOracle.time()
    ).blockTimestampAtBeginningOfPeriod;
    const expectedTimeDiffLastUpdate = timeOfCumulativeAmountLastUpdate.sub(
      timeOfCumulativeAmountAtBeginningOfPeriodAtLastUpdate
    );

    const expectedTWAPLastUpdate = expectedPriceDiffLastUpdate.div(
      expectedTimeDiffLastUpdate
    );

    const TWAPLastUpdate = await user.twapOracle.getOracleTwap();
    console.log(TWAPLastUpdate.toString(), '\n');
    expect(TWAPLastUpdate).to.eq(expectedTWAPLastUpdate);
  });
});
