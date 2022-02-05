import {expect} from 'chai';
import env, {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {deployMockContract, MockContract} from 'ethereum-waffle';

import ChainlinkOracle from '../../artifacts/contracts/oracles/ChainlinkOracle.sol/ChainlinkOracle.json';
import {ChainlinkTWAPOracle} from '../../typechain';
import {rMul, rDiv} from '../helpers/utils/calculations';

let nextBlockTimestamp = 2000000000;
async function addTimeToNextBlockTimestamp(
  hre: HardhatRuntimeEnvironment,
  additionalTimestamp: number
): Promise<number> {
  nextBlockTimestamp += additionalTimestamp;

  await hre.network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [nextBlockTimestamp],
  });

  return nextBlockTimestamp;
}

const DEFAULT_EUR_USD_PRICE = 1.131523;

type User = {chainlinkTWAPOracle: ChainlinkTWAPOracle};

describe('ChainlinkTWAPOracle', async function () {
  let chainlinkOracle: MockContract;
  let user: User;
  let PERIOD: number;
  let snapshotId: number;

  async function _deploy_chainlinkTWAPOracle() {
    const [deployer] = await ethers.getSigners();

    // deploy chainlink oracle as a mock
    chainlinkOracle = await deployMockContract(deployer, ChainlinkOracle.abi);

    const ChainlinkTWAPOracleContract = await ethers.getContractFactory(
      'ChainlinkTWAPOracle'
    );
    const chainlinkTWAPOracle = <ChainlinkTWAPOracle>(
      await ChainlinkTWAPOracleContract.deploy(chainlinkOracle.address)
    );

    return {chainlinkTWAPOracle};
  }

  // @param newIndexPrice New price index (e.g. EUR/USD) with 1e18 decimal
  async function _set_chainlinkOracle_indexPrice(newIndexPrice: number) {
    // console.log(`newIndexPrice: ${newIndexPrice}`);

    const formattedNewIndexPrice = ethers.utils.parseEther(
      newIndexPrice.toString()
    );
    await chainlinkOracle.mock.getIndexPrice.returns(formattedNewIndexPrice);
  }

  before(async () => {
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  beforeEach(async () => {
    // user = await setup();
    user = await _deploy_chainlinkTWAPOracle();
    PERIOD = (await user.chainlinkTWAPOracle.PERIOD()).toNumber();
  });

  after(async () => {
    await env.network.provider.send('evm_revert', [snapshotId]);
  });

  it('Should not crash if TWAP read while no value set', async () => {
    expect(await user.chainlinkTWAPOracle.getEURUSDTWAP()).to.eq(0);
  });

  it('TWAP value should properly account for variations of the underlying chainlink oracle index price', async () => {
    await _set_chainlinkOracle_indexPrice(1);
    const firstTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();
    expect(await user.chainlinkTWAPOracle.getEURUSDTWAP()).to.eq(
      ethers.utils.parseEther('1')
    );

    const cumulativeAmountBeforeSecondUpdate =
      await user.chainlinkTWAPOracle.cumulativeAmount();

    await _set_chainlinkOracle_indexPrice(3);
    const secondTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();

    // cumulativeAmount = cumulativeAmount + newPrice * timeElapsed;
    const newPrice = ethers.BigNumber.from('3');
    const timeElapsed = ethers.BigNumber.from(
      (secondTimestamp - firstTimestamp).toString()
    );
    const productPriceTime = newPrice.mul(timeElapsed);
    const expectedCumulativeAmount =
      cumulativeAmountBeforeSecondUpdate.add(productPriceTime);

    expect(await user.chainlinkTWAPOracle.cumulativeAmount()).to.eq(
      expectedCumulativeAmount
    );

    const cumulativeAmount = expectedCumulativeAmount;
    const timeOfCumulativeAmount = ethers.BigNumber.from(
      secondTimestamp.toString()
    );
    // this far `cumulativeAmountAtBeginningOfPeriod` and `timeOfCumulativeAmountAtBeginningOfPeriod` are worth 0
    const expectedTWAP = rDiv(cumulativeAmount, timeOfCumulativeAmount);
    expect(await user.chainlinkTWAPOracle.getEURUSDTWAP()).to.eq(expectedTWAP);

    await _set_chainlinkOracle_indexPrice(5);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.chainlinkTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_chainlinkOracle_indexPrice(10);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.chainlinkTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_chainlinkOracle_indexPrice(10);
    await addTimeToNextBlockTimestamp(env, PERIOD);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.chainlinkTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_chainlinkOracle_indexPrice(20);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.chainlinkTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_chainlinkOracle_indexPrice(10);
    await addTimeToNextBlockTimestamp(env, PERIOD);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.chainlinkTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_chainlinkOracle_indexPrice(20);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.chainlinkTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_chainlinkOracle_indexPrice(DEFAULT_EUR_USD_PRICE);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.chainlinkTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    const cumulativeAmountBeforeLastUpdate =
      await user.chainlinkTWAPOracle.cumulativeAmount();
    const timeOfCumulativeAmountBeforeLastUpdate =
      await user.chainlinkTWAPOracle.timeOfCumulativeAmount();

    await _set_chainlinkOracle_indexPrice(DEFAULT_EUR_USD_PRICE);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.chainlinkTWAPOracle.updateEURUSDTWAP();

    // cumulativeAmount = cumulativeAmount + newPrice * timeElapsed;
    const newPriceLastUpdate = ethers.utils.parseEther(
      DEFAULT_EUR_USD_PRICE.toString()
    );

    const timeOfCumulativeAmountLastUpdate =
      await user.chainlinkTWAPOracle.timeOfCumulativeAmount();
    const expectedTimeElapsed = timeOfCumulativeAmountLastUpdate.sub(
      timeOfCumulativeAmountBeforeLastUpdate
    );

    const productPriceTimeLastUpdate = rMul(
      newPriceLastUpdate,
      expectedTimeElapsed
    );
    const expectedCumulativeAmountLastUpdate =
      cumulativeAmountBeforeLastUpdate.add(productPriceTimeLastUpdate);

    expect(await user.chainlinkTWAPOracle.cumulativeAmount()).to.eq(
      expectedCumulativeAmountLastUpdate
    );

    const cumulativeAmountLastUpdate = expectedCumulativeAmountLastUpdate;
    const cumulativeAmountAtBeginningOfPeriodAtLastUpdate =
      await user.chainlinkTWAPOracle.cumulativeAmountAtBeginningOfPeriod();

    const expectedPriceDiffLastUpdate = cumulativeAmountLastUpdate.sub(
      cumulativeAmountAtBeginningOfPeriodAtLastUpdate
    );

    const timeOfCumulativeAmountAtBeginningOfPeriodAtLastUpdate =
      await user.chainlinkTWAPOracle.timeOfCumulativeAmountAtBeginningOfPeriod();
    const expectedTimeDiffLastUpdate = timeOfCumulativeAmountLastUpdate.sub(
      timeOfCumulativeAmountAtBeginningOfPeriodAtLastUpdate
    );

    const expectedTWAPLastUpdate = rDiv(
      expectedPriceDiffLastUpdate,
      expectedTimeDiffLastUpdate
    );

    const TWAPLastUpdate = await user.chainlinkTWAPOracle.getEURUSDTWAP();
    // console.log(TWAPLastUpdate.toString(), '\n');
    expect(TWAPLastUpdate).to.eq(expectedTWAPLastUpdate);
  });
});
