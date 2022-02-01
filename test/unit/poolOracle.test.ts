import {expect} from 'chai';
import env, {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {deployMockContract, MockContract} from 'ethereum-waffle';

import CryptoSwap from '../../contracts-vyper/artifacts/CryptoSwap.vy/CryptoSwap.json';
import {PoolOracle} from '../../typechain';
// import {setNextBlockTimestamp} from '../../helpers/misc-utils';

let nextBlockTimestamp = 2000000000;
export async function setNextBlockTimestamp(
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

  beforeEach(async () => {
    user = await _deploy_poolOracle();
    PERIOD = (await user.poolOracle.PERIOD()).toNumber();

    // by default, balances(0) and balances(1) will return 1e18
    await curvePoolMock.mock.balances.returns(ethers.utils.parseEther('1'));
  });

  // it('Should not crash if TWAP read while no value set', async () => {
  //   expect(await user.poolOracle.getTWAP()).to.eq(0);
  // });

  // it('Should set TWAP value when contract is called for the first time, this value should be readable', async () => {
  //   expect(await user.poolOracle.timeOfCumulativePriceOne()).to.eq(0);
  //   expect(await user.poolOracle.cumulativePriceOne()).to.eq(0);
  //   expect(await user.poolOracle.timeOfCumulativePriceTwo()).to.eq(0);
  //   expect(await user.poolOracle.cumulativePriceTwo()).to.eq(0);

  //   const nextBlockTimestamp = await setNextBlockTimestamp(env);
  //   await user.poolOracle.updateTWAP();

  //   expect(await user.poolOracle.timeOfCumulativePriceOne()).to.eq(0);
  //   expect(await user.poolOracle.cumulativePriceOne()).to.eq(0);

  //   expect(await user.poolOracle.timeOfCumulativePriceTwo()).to.eq(
  //     nextBlockTimestamp
  //   );
  //   // given that `cumulativePriceOne` equals 0 and `newPrice` (the ratio of both balances in the pool) equals 1,
  //   // the value of `cumulativePriceTwo` equals the timestamp of the block
  //   expect(await user.poolOracle.cumulativePriceTwo()).to.eq(
  //     nextBlockTimestamp
  //   );

  //   // 1 for the same reason that cumulativePriceTwo equals the same timestamp as the block
  //   expect(await user.poolOracle.getTWAP()).to.eq(1);
  // });

  // it('Should update TWAP value when contract is called subsequently (2nd, 3rd times and more) & values should be readable', async () => {
  //   const firstTimestamp = await setNextBlockTimestamp(env);
  //   await user.poolOracle.updateTWAP();

  //   const secondTimestamp = await setNextBlockTimestamp(env);
  //   await user.poolOracle.updateTWAP();

  //   expect(await user.poolOracle.timeOfCumulativePriceOne()).to.eq(
  //     firstTimestamp
  //   );
  //   expect(await user.poolOracle.cumulativePriceOne()).to.eq(firstTimestamp);
  //   expect(await user.poolOracle.timeOfCumulativePriceTwo()).to.eq(
  //     secondTimestamp
  //   );

  //   // cumulativePriceTwo = cumulativePriceOne + newPrice * timeElapsed;
  //   const expectedCumulativePriceTwo =
  //     firstTimestamp + 1 * (secondTimestamp - firstTimestamp);
  //   expect(await user.poolOracle.cumulativePriceTwo()).to.eq(
  //     expectedCumulativePriceTwo
  //   );
  // });

  // it('Should not update TWAP value when value has been updated recently & we should get the previous value', async () => {
  //   const firstTimestamp = await setNextBlockTimestamp(env);
  //   await expect(user.poolOracle.updateTWAP()).to.emit(
  //     user.poolOracle,
  //     'TWAPUpdated'
  //   );

  //   expect(await user.poolOracle.timeOfCumulativePriceTwo()).to.eq(
  //     firstTimestamp
  //   );
  //   expect(await user.poolOracle.cumulativePriceTwo()).to.eq(firstTimestamp);

  //   await env.network.provider.request({
  //     method: 'evm_setNextBlockTimestamp',
  //     params: [firstTimestamp + 100], // PERIOD = 15min = 900sec
  //   });
  //   await expect(user.poolOracle.updateTWAP()).not.to.emit(
  //     user.poolOracle,
  //     'TWAPUpdated'
  //   );

  //   // oracle values should not have been updated
  //   expect(await user.poolOracle.timeOfCumulativePriceTwo()).to.eq(
  //     firstTimestamp
  //   );
  //   expect(await user.poolOracle.cumulativePriceTwo()).to.eq(firstTimestamp);
  // });

  it.only('TWAP value should properly account for variations of the underlying pool balances', async () => {
    // initially both the balance of vBase and vQuote are equal
    console.log('newPrice: 1');
    const firstTimestamp = await setNextBlockTimestamp(env, 0);
    await user.poolOracle.updateTWAP();

    console.log((await user.poolOracle.getTWAP()).toString());
    // console.log('Zero is expected the first time');
    console.log();

    // the balance of vBase is now double that of vQuote (vQuote is still 1e18)
    console.log('newPrice: 3');
    await curvePoolMock.mock.balances
      .withArgs(1)
      .returns(ethers.utils.parseEther('3'));
    // await curvePoolMock.mock.balances
    //   .withArgs(0)
    //   .returns(ethers.utils.parseEther('6'));

    const secondTimestamp = await setNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();

    // cumulativePrice = cumulativePriceOne + newPrice * timeElapsed;
    // const cumulativePriceOne = firstTimestamp;
    // const newPrice = 3 / 6;
    // const timeElapsed = secondTimestamp - firstTimestamp;
    // const expectedCumulativePrice = cumulativePriceOne + newPrice * timeElapsed;

    // expect(await user.poolOracle.cumulativePrice()).to.eq(
    //   expectedCumulativePrice
    // );

    console.log((await user.poolOracle.getTWAP()).toString());
    console.log();

    console.log('newPrice: 5');
    // update balance of vBase to 5e18 (vQuote is still 1e18)
    await curvePoolMock.mock.balances
      .withArgs(1)
      .returns(ethers.utils.parseEther('5'));
    await setNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();

    console.log((await user.poolOracle.getTWAP()).toString());
    console.log();

    console.log('newPrice: 10');
    // update balance of vBase to 10e18 (vQuote is still 1e18)
    await curvePoolMock.mock.balances
      .withArgs(1)
      .returns(ethers.utils.parseEther('10'));
    await setNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();

    console.log((await user.poolOracle.getTWAP()).toString());
    console.log();

    console.log('newPrice: 10');
    await curvePoolMock.mock.balances
      .withArgs(1)
      .returns(ethers.utils.parseEther('10'));
    await setNextBlockTimestamp(env, PERIOD);
    await user.poolOracle.updateTWAP();

    console.log((await user.poolOracle.getTWAP()).toString());
    console.log();

    console.log('newPrice: 20');
    await curvePoolMock.mock.balances
      .withArgs(1)
      .returns(ethers.utils.parseEther('20'));
    await setNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();

    console.log((await user.poolOracle.getTWAP()).toString());
    console.log();

    console.log('newPrice: 10');
    await curvePoolMock.mock.balances
      .withArgs(1)
      .returns(ethers.utils.parseEther('10'));
    await setNextBlockTimestamp(env, PERIOD);
    await user.poolOracle.updateTWAP();

    console.log((await user.poolOracle.getTWAP()).toString());
    console.log();

    console.log('newPrice: 20');
    await curvePoolMock.mock.balances
      .withArgs(1)
      .returns(ethers.utils.parseEther('20'));
    await setNextBlockTimestamp(env, 100);
    await user.poolOracle.updateTWAP();

    console.log((await user.poolOracle.getTWAP()).toString());
    console.log();
  });

  // TODO: test to compute TWAP from pool.price_oracle()
});
