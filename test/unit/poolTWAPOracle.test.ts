import {expect} from 'chai';
import env, {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {deployMockContract, MockContract} from 'ethereum-waffle';

import CryptoSwap from '../../contracts-vyper/artifacts/CryptoSwap.vy/CryptoSwap.json';
import {PoolTWAPOracle} from '../../typechain';
import {rMul, rDiv} from '../helpers/calculations';

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

type User = {poolTWAPOracle: PoolTWAPOracle};

describe('PoolTWAPOracle', async function () {
  let curvePoolMock: MockContract;
  let user: User;
  let PERIOD: number;
  let snapshotId: number;

  async function _set_vBase_vQuote(vBaseAmount: number, vQuoteAmount: number) {
    // console.log(`vBaseAmount: ${vBaseAmount} - vQuoteAmount: ${vQuoteAmount}`);

    await curvePoolMock.mock.balances
      .withArgs(0)
      .returns(ethers.utils.parseEther(vQuoteAmount.toString()));

    await curvePoolMock.mock.balances
      .withArgs(1)
      .returns(ethers.utils.parseEther(vBaseAmount.toString()));
  }

  async function _deploy_poolTWAPOracle() {
    const [deployer] = await ethers.getSigners();

    // deploy curve pool as a mock
    curvePoolMock = await deployMockContract(deployer, CryptoSwap.abi);

    const PoolTWAPOracleContract = await ethers.getContractFactory(
      'PoolTWAPOracle'
    );
    const poolTWAPOracle = <PoolTWAPOracle>(
      await PoolTWAPOracleContract.deploy(curvePoolMock.address)
    );

    return {poolTWAPOracle};
  }

  before(async () => {
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  beforeEach(async () => {
    // user = await _deploy_poolTWAPOracle();
    user = await _deploy_poolTWAPOracle();
    PERIOD = (await user.poolTWAPOracle.PERIOD()).toNumber();

    // by default, balances(0) and balances(1) will return 1e18
    await curvePoolMock.mock.balances.returns(ethers.utils.parseEther('1'));
  });

  after(async () => {
    await env.network.provider.send('evm_revert', [snapshotId]);
  });

  it('Should not crash if TWAP read while no value set', async () => {
    expect(await user.poolTWAPOracle.getEURUSDTWAP()).to.eq(0);
  });

  it('Should set TWAP value when contract is called for the first time, this value should be readable', async () => {
    expect(await user.poolTWAPOracle.cumulativeAmount()).to.eq(0);
    expect(await user.poolTWAPOracle.timeOfCumulativeAmount()).to.eq(0);
    expect(
      await user.poolTWAPOracle.cumulativeAmountAtBeginningOfPeriod()
    ).to.eq(0);
    expect(
      await user.poolTWAPOracle.timeOfCumulativeAmountAtBeginningOfPeriod()
    ).to.eq(0);

    const nextBlockTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.poolTWAPOracle.updateEURUSDTWAP();

    expect(
      await user.poolTWAPOracle.cumulativeAmountAtBeginningOfPeriod()
    ).to.eq(0);
    expect(
      await user.poolTWAPOracle.timeOfCumulativeAmountAtBeginningOfPeriod()
    ).to.eq(0);

    // given that `cumulativeAmountAtBeginningOfPeriod` equals 0 and `newPrice` (the ratio of both balances in the pool) equals 1,
    // the value of `cumulativeAmount` equals the timestamp of the block
    expect(await user.poolTWAPOracle.cumulativeAmount()).to.eq(
      nextBlockTimestamp
    );
    expect(await user.poolTWAPOracle.timeOfCumulativeAmount()).to.eq(
      nextBlockTimestamp
    );

    // 1 for the same reason that cumulativeAmount equals the same timestamp as the block
    expect(await user.poolTWAPOracle.getEURUSDTWAP()).to.eq(
      ethers.utils.parseEther('1')
    );
  });

  it('TWAP value should properly account for variations of the underlying pool balances', async () => {
    // Initially both the balance of vBase and vQuote are equal
    await _set_vBase_vQuote(1, 1);
    const firstTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.poolTWAPOracle.updateEURUSDTWAP();
    expect(await user.poolTWAPOracle.getEURUSDTWAP()).to.eq(
      ethers.utils.parseEther('1')
    );

    const cumulativeAmountBeforeSecondUpdate =
      await user.poolTWAPOracle.cumulativeAmount();

    await _set_vBase_vQuote(3, 1);
    const secondTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.poolTWAPOracle.updateEURUSDTWAP();

    // cumulativeAmount = cumulativeAmount + newPrice * timeElapsed;
    const newPrice = ethers.BigNumber.from('3'); // vBase / vQuote
    const timeElapsed = ethers.BigNumber.from(
      (secondTimestamp - firstTimestamp).toString()
    );
    const productPriceTime = newPrice.mul(timeElapsed);
    const expectedCumulativeAmount =
      cumulativeAmountBeforeSecondUpdate.add(productPriceTime);

    expect(await user.poolTWAPOracle.cumulativeAmount()).to.eq(
      expectedCumulativeAmount
    );

    const cumulativeAmount = expectedCumulativeAmount;
    const timeOfCumulativeAmount = ethers.BigNumber.from(
      secondTimestamp.toString()
    );
    // this far `cumulativeAmountAtBeginningOfPeriod` and `timeOfCumulativeAmountAtBeginningOfPeriod` are worth 0
    const expectedTWAP = rDiv(cumulativeAmount, timeOfCumulativeAmount);
    expect(await user.poolTWAPOracle.getEURUSDTWAP()).to.eq(expectedTWAP);

    await _set_vBase_vQuote(5, 1);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.poolTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_vBase_vQuote(10, 1);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.poolTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_vBase_vQuote(10, 1);
    await addTimeToNextBlockTimestamp(env, PERIOD);
    await user.poolTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.poolTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_vBase_vQuote(20, 1);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.poolTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_vBase_vQuote(10, 1);
    await addTimeToNextBlockTimestamp(env, PERIOD);
    await user.poolTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.poolTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_vBase_vQuote(20, 1);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.poolTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    await _set_vBase_vQuote(20, 15);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolTWAPOracle.updateEURUSDTWAP();
    // console.log((await user.poolTWAPOracle.getEURUSDTWAP()).toString(), '\n');

    const cumulativeAmountBeforeLastUpdate =
      await user.poolTWAPOracle.cumulativeAmount();
    const timeOfCumulativeAmountBeforeLastUpdate =
      await user.poolTWAPOracle.timeOfCumulativeAmount();

    await _set_vBase_vQuote(20, 25);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolTWAPOracle.updateEURUSDTWAP();

    // cumulativeAmount = cumulativeAmount + newPrice * timeElapsed;
    const vBaseAmount = ethers.BigNumber.from('20');
    const vQuoteAmount = ethers.BigNumber.from('25');
    const expectedNewPriceLastUpdate = rDiv(vBaseAmount, vQuoteAmount); // vBase / vQuote;

    const timeOfCumulativeAmountLastUpdate =
      await user.poolTWAPOracle.timeOfCumulativeAmount();
    const expectedTimeElapsed = timeOfCumulativeAmountLastUpdate.sub(
      timeOfCumulativeAmountBeforeLastUpdate
    );

    const productPriceTimeLastUpdate = rMul(
      expectedNewPriceLastUpdate,
      expectedTimeElapsed
    );
    const expectedCumulativeAmountLastUpdate =
      cumulativeAmountBeforeLastUpdate.add(productPriceTimeLastUpdate);

    expect(await user.poolTWAPOracle.cumulativeAmount()).to.eq(
      expectedCumulativeAmountLastUpdate
    );

    const cumulativeAmountLastUpdate = expectedCumulativeAmountLastUpdate;
    const cumulativeAmountAtBeginningOfPeriodAtLastUpdate =
      await user.poolTWAPOracle.cumulativeAmountAtBeginningOfPeriod();

    const expectedPriceDiffLastUpdate = cumulativeAmountLastUpdate.sub(
      cumulativeAmountAtBeginningOfPeriodAtLastUpdate
    );

    const timeOfCumulativeAmountAtBeginningOfPeriodAtLastUpdate =
      await user.poolTWAPOracle.timeOfCumulativeAmountAtBeginningOfPeriod();
    const expectedTimeDiffLastUpdate = timeOfCumulativeAmountLastUpdate.sub(
      timeOfCumulativeAmountAtBeginningOfPeriodAtLastUpdate
    );

    const expectedTWAPLastUpdate = rDiv(
      expectedPriceDiffLastUpdate,
      expectedTimeDiffLastUpdate
    );

    const TWAPLastUpdate = await user.poolTWAPOracle.getEURUSDTWAP();
    // console.log(TWAPLastUpdate.toString(), '\n');
    expect(TWAPLastUpdate).to.eq(expectedTWAPLastUpdate);
  });
});
