import {expect} from 'chai';
import env, {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {deployMockContract, MockContract} from 'ethereum-waffle';

import {rMul, rDiv} from '../integration/helpers/utils/calculations';
import CryptoSwap from '../../contracts-vyper/artifacts/CryptoSwap.vy/CryptoSwap.json';
import {PoolOracle} from '../../typechain';

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

describe('PoolOracle', async function () {
  let curvePoolMock: MockContract;
  let user: {poolOracle: PoolOracle};
  let PERIOD: number;

  async function _deploy_poolOracle() {
    const [deployer] = await ethers.getSigners();

    // deploy curve pool as a mock
    curvePoolMock = await deployMockContract(deployer, CryptoSwap.abi);

    const PoolOracleContract = await ethers.getContractFactory('PoolOracle');
    const poolOracle = <PoolOracle>(
      await PoolOracleContract.deploy(curvePoolMock.address)
    );

    return {poolOracle};
  }

  async function _set_vBase_vQuote(vBaseAmount: number, vQuoteAmount: number) {
    // console.log(`vBaseAmount: ${vBaseAmount} - vQuoteAmount: ${vQuoteAmount}`);

    await curvePoolMock.mock.balances
      .withArgs(0)
      .returns(ethers.utils.parseEther(vQuoteAmount.toString()));

    await curvePoolMock.mock.balances
      .withArgs(1)
      .returns(ethers.utils.parseEther(vBaseAmount.toString()));
  }

  beforeEach(async () => {
    user = await _deploy_poolOracle();
    PERIOD = (await user.poolOracle.PERIOD()).toNumber();

    // by default, balances(0) and balances(1) will return 1e18
    await curvePoolMock.mock.balances.returns(ethers.utils.parseEther('1'));
  });

  it('Should not crash if TWAP read while no value set', async () => {
    expect(await user.poolOracle.getTWAP()).to.eq(0);
  });

  it('Should set TWAP value when contract is called for the first time, this value should be readable', async () => {
    expect(await user.poolOracle.cumulativeAmount()).to.eq(0);
    expect(await user.poolOracle.timeOfCumulativeAmount()).to.eq(0);
    expect(await user.poolOracle.cumulativeAmountAtBeginningOfPeriod()).to.eq(
      0
    );
    expect(
      await user.poolOracle.timeOfCumulativeAmountAtBeginningOfPeriod()
    ).to.eq(0);

    const nextBlockTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();

    expect(await user.poolOracle.cumulativeAmountAtBeginningOfPeriod()).to.eq(
      0
    );
    expect(
      await user.poolOracle.timeOfCumulativeAmountAtBeginningOfPeriod()
    ).to.eq(0);

    // given that `cumulativeAmountAtBeginningOfPeriod` equals 0 and `newPrice` (the ratio of both balances in the pool) equals 1,
    // the value of `cumulativeAmount` equals the timestamp of the block
    expect(await user.poolOracle.cumulativeAmount()).to.eq(nextBlockTimestamp);
    expect(await user.poolOracle.timeOfCumulativeAmount()).to.eq(
      nextBlockTimestamp
    );

    // 1 for the same reason that cumulativeAmount equals the same timestamp as the block
    expect(await user.poolOracle.getTWAP()).to.eq(ethers.utils.parseEther('1'));
  });

  it('TWAP value should properly account for variations of the underlying pool balances', async () => {
    // Initially both the balance of vBase and vQuote are equal
    await _set_vBase_vQuote(1, 1);
    const firstTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();
    expect(await user.poolOracle.getTWAP()).to.eq(ethers.utils.parseEther('1'));

    const cumulativeAmountBeforeSecondUpdate =
      await user.poolOracle.cumulativeAmount();

    await _set_vBase_vQuote(3, 1);
    const secondTimestamp = await addTimeToNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();

    // cumulativeAmount = cumulativeAmount + newPrice * timeElapsed;
    const newPrice = ethers.BigNumber.from('3'); // vBase / vQuote
    const timeElapsed = ethers.BigNumber.from(
      (secondTimestamp - firstTimestamp).toString()
    );
    const productPriceTime = newPrice.mul(timeElapsed);
    const expectedCumulativeAmount =
      cumulativeAmountBeforeSecondUpdate.add(productPriceTime);

    expect(await user.poolOracle.cumulativeAmount()).to.eq(
      expectedCumulativeAmount
    );

    const cumulativeAmount = expectedCumulativeAmount;
    const timeOfCumulativeAmount = ethers.BigNumber.from(
      secondTimestamp.toString()
    );
    // this far `cumulativeAmountAtBeginningOfPeriod` and `timeOfCumulativeAmountAtBeginningOfPeriod` are worth 0
    const expectedTWAP = rDiv(cumulativeAmount, timeOfCumulativeAmount);
    expect(await user.poolOracle.getTWAP()).to.eq(expectedTWAP);

    await _set_vBase_vQuote(5, 1);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();
    // console.log((await user.poolOracle.getTWAP()).toString());

    await _set_vBase_vQuote(10, 1);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();
    // console.log((await user.poolOracle.getTWAP()).toString());

    await _set_vBase_vQuote(10, 1);
    await addTimeToNextBlockTimestamp(env, PERIOD);
    await user.poolOracle.updateTWAP();
    // console.log((await user.poolOracle.getTWAP()).toString());

    await _set_vBase_vQuote(20, 1);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();
    // console.log((await user.poolOracle.getTWAP()).toString());

    await _set_vBase_vQuote(10, 1);
    await addTimeToNextBlockTimestamp(env, PERIOD);
    await user.poolOracle.updateTWAP();
    // console.log((await user.poolOracle.getTWAP()).toString());

    await _set_vBase_vQuote(20, 1);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();
    // console.log((await user.poolOracle.getTWAP()).toString());

    await _set_vBase_vQuote(20, 15);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();
    // console.log((await user.poolOracle.getTWAP()).toString());

    const cumulativeAmountBeforeLastUpdate =
      await user.poolOracle.cumulativeAmount();
    const timeOfCumulativeAmountBeforeLastUpdate =
      await user.poolOracle.timeOfCumulativeAmount();

    await _set_vBase_vQuote(20, 25);
    await addTimeToNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();

    // cumulativeAmount = cumulativeAmount + newPrice * timeElapsed;
    const vBaseAmount = ethers.BigNumber.from('20');
    const vQuoteAmount = ethers.BigNumber.from('25');
    const expectedNewPriceLastUpdate = rDiv(vBaseAmount, vQuoteAmount); // vBase / vQuote;

    const timeOfCumulativeAmountLastUpdate =
      await user.poolOracle.timeOfCumulativeAmount();
    const expectedTimeElapsed = timeOfCumulativeAmountLastUpdate.sub(
      timeOfCumulativeAmountBeforeLastUpdate
    );

    const productPriceTimeLastUpdate = rMul(
      expectedNewPriceLastUpdate,
      expectedTimeElapsed
    );
    const expectedCumulativeAmountLastUpdate =
      cumulativeAmountBeforeLastUpdate.add(productPriceTimeLastUpdate);

    expect(await user.poolOracle.cumulativeAmount()).to.eq(
      expectedCumulativeAmountLastUpdate
    );

    const cumulativeAmountLastUpdate = expectedCumulativeAmountLastUpdate;
    const cumulativeAmountAtBeginningOfPeriodAtLastUpdate =
      await user.poolOracle.cumulativeAmountAtBeginningOfPeriod();

    const expectedPriceDiffLastUpdate = cumulativeAmountLastUpdate.sub(
      cumulativeAmountAtBeginningOfPeriodAtLastUpdate
    );

    const timeOfCumulativeAmountAtBeginningOfPeriodAtLastUpdate =
      await user.poolOracle.timeOfCumulativeAmountAtBeginningOfPeriod();
    const expectedTimeDiffLastUpdate = timeOfCumulativeAmountLastUpdate.sub(
      timeOfCumulativeAmountAtBeginningOfPeriodAtLastUpdate
    );

    const expectedTWAPLastUpdate = rDiv(
      expectedPriceDiffLastUpdate,
      expectedTimeDiffLastUpdate
    );
    expect(await user.poolOracle.getTWAP()).to.eq(expectedTWAPLastUpdate);
  });
});
