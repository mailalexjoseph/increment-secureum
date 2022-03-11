import {expect} from 'chai';
import env, {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {deployMockContract, MockContract} from 'ethereum-waffle';
import {Signer} from 'ethers';
import {asBigNumber} from '../helpers/utils/calculations';

import {BigNumber, BigNumberish} from 'ethers';

import {TestPerpetual} from '../../typechain';

// dependency abis
import VBase from '../../artifacts/contracts/tokens/VBase.sol/VBase.json';
import VQuote from '../../artifacts/contracts/tokens/VQuote.sol/VQuote.json';
import Vault from '../../artifacts/contracts/Vault.sol/Vault.json';
import CurveCryptoSwap2ETH from '../../contracts-vyper/artifacts/CurveCryptoSwap2ETH.vy/CurveCryptoSwap2ETH.json';

let nextBlockTimestamp: BigNumber = ethers.BigNumber.from(2100000000);

async function addTimeToNextBlockTimestamp(
  hre: HardhatRuntimeEnvironment,
  additionalTimestamp: BigNumber | BigNumberish
): Promise<BigNumber> {
  nextBlockTimestamp = nextBlockTimestamp.add(additionalTimestamp);
  await hre.network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [nextBlockTimestamp.toNumber()],
  });
  return nextBlockTimestamp;
}

const INIT_PRICE = asBigNumber('1');

type User = {perpetual: TestPerpetual};

describe('TwapOracle', async function () {
  // mock dependencies
  let marketMock: MockContract;
  let vaultMock: MockContract;
  let vQuoteMock: MockContract;
  let vBaseMock: MockContract;

  let PERIOD: BigNumber;

  // contract and accounts
  let deployer: Signer;
  let user: User;
  let snapshotId: number;

  async function _deploy_perpetual() {
    [deployer] = await ethers.getSigners();

    // build dependencies as mocks
    marketMock = await deployMockContract(deployer, CurveCryptoSwap2ETH.abi);
    vaultMock = await deployMockContract(deployer, Vault.abi);
    vQuoteMock = await deployMockContract(deployer, VQuote.abi);
    vBaseMock = await deployMockContract(deployer, VBase.abi);

    await _set_chainlinkOracle_indexPrice(INIT_PRICE); // update even before the TWAP oracle is deployed
    await _set_curvePool_price_oracle(INIT_PRICE); // update even before the TWAP oracle is deployed

    // needed in the constructor of Perpetual
    await vQuoteMock.mock.approve.returns(true);
    await vBaseMock.mock.approve.returns(true);

    const TestPerpetualContract = await ethers.getContractFactory(
      'TestPerpetual'
    );
    const perpetual = <TestPerpetual>(
      await TestPerpetualContract.deploy(
        vBaseMock.address,
        vQuoteMock.address,
        marketMock.address,
        vaultMock.address
      )
    );

    return {perpetual};
  }

  // @param newIndexPrice New price index (e.g. EUR/USD) with 1e18 decimal
  async function _set_chainlinkOracle_indexPrice(newIndexPrice: BigNumber) {
    // console.log(`newIndexPrice: ${newIndexPrice}`);

    await vBaseMock.mock.getIndexPrice.returns(newIndexPrice);
  }
  async function _set_curvePool_price_oracle(newPoolPrice: BigNumber) {
    // console.log(`vBaseAmount: ${vBaseAmount} - vQuoteAmount: ${vQuoteAmount}`);

    await marketMock.mock.last_prices.returns(newPoolPrice);
  }

  /// @dev records a state for the next
  /// @param price Price for period
  /// @param timeElapsed Time for which price exists
  /// @returns The new time
  async function record_chainlink_price(
    hre: HardhatRuntimeEnvironment,
    user: User,
    price: BigNumber,
    timeElapsed: BigNumber
  ): Promise<BigNumber> {
    await _set_chainlinkOracle_indexPrice(price);

    return await _record_time(hre, user, timeElapsed);
  }

  /// @dev records a state for the next
  /// @param price Price for period
  /// @param timeElapsed Time for which price exists
  /// @returns The new time
  async function record_market_price(
    hre: HardhatRuntimeEnvironment,
    user: User,
    price: BigNumber,
    timeElapsed: BigNumber
  ): Promise<BigNumber> {
    await _set_curvePool_price_oracle(price);

    return await _record_time(hre, user, timeElapsed);
  }

  async function _record_time(
    hre: HardhatRuntimeEnvironment,
    user: User,
    timeElapsed: BigNumber
  ): Promise<BigNumber> {
    const timeStamp = await addTimeToNextBlockTimestamp(hre, timeElapsed);

    await user.perpetual.updateGenericProtocolState();

    return timeStamp;
  }
  before(async () => {
    // init timeStamp
    await addTimeToNextBlockTimestamp(env, 0);

    // user = await setup();
    user = await _deploy_perpetual();
    PERIOD = await user.perpetual.TWAP_FREQUENCY();

    // take snapshot
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  afterEach(async () => {
    await env.network.provider.send('evm_revert', [snapshotId]);
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  describe('Should test the Chainlink twap', async () => {
    it('Should initialize TWAP with initial price points values', async () => {
      expect(await user.perpetual.getOracleTwap()).to.eq(INIT_PRICE);
    });
    it('TWAP value should properly account for variations of the underlying chainlink oracle index price', async () => {
      // start a fresh new period and start calculation example
      const timeStamp0 = await addTimeToNextBlockTimestamp(
        env,
        PERIOD.mul(2) // go far in future to force a new period
      );
      await user.perpetual.updateGenericProtocolState(); // call updateGenericProtocolState() here to update timeOfLastTrade

      // verify start values
      expect((await user.perpetual.getGlobalPosition()).timeOfLastTrade).to.eq(
        timeStamp0
      );
      expect(
        (await user.perpetual.getGlobalPosition()).timeOfLastFunding
      ).to.eq(timeStamp0);

      expect(await user.perpetual.getOracleTwap()).to.eq(INIT_PRICE);

      const cumulativeAmountAtStart =
        await user.perpetual.oracleCumulativeAmount();
      expect(
        await user.perpetual.oracleCumulativeAmountAtBeginningOfPeriod()
      ).to.eq(cumulativeAmountAtStart);

      // price of 2 for 1/4 th of the period
      const price0 = asBigNumber('2');
      const timeElapsed0 = PERIOD.div(4);
      const timeStamp1 = await record_chainlink_price(
        env,
        user,
        price0,
        timeElapsed0
      );

      /* check that function updates variables correctly */

      /* cumulativeAmount += timeElapsed * newPrice */
      const timeElapsed = timeStamp1.sub(timeStamp0);
      const productPriceTime = price0.mul(timeElapsed);
      const expectedCumulativeAmountFirstUpdate =
        cumulativeAmountAtStart.add(productPriceTime);

      expect(await user.perpetual.oracleCumulativeAmount()).to.eq(
        expectedCumulativeAmountFirstUpdate
      );
      expect(
        await user.perpetual.oracleCumulativeAmountAtBeginningOfPeriod()
      ).to.eq(cumulativeAmountAtStart);

      expect((await user.perpetual.getGlobalPosition()).timeOfLastTrade).to.eq(
        timeStamp1
      );
      expect(
        (await user.perpetual.getGlobalPosition()).timeOfLastFunding
      ).to.eq(timeStamp0);

      expect(await user.perpetual.getOracleTwap()).to.eq(INIT_PRICE);

      // price of 3 for 1/4 th of the period
      const price1 = asBigNumber('3');
      const timeElapsed1 = PERIOD.div(4);
      await record_chainlink_price(env, user, price1, timeElapsed1);

      // price of 4 for 1/4 th of the period
      const price2 = asBigNumber('4');
      const timeElapsed2 = PERIOD.div(4);
      await record_chainlink_price(env, user, price2, timeElapsed2);

      // price of 5 for 1/4 th of the period
      const price3 = asBigNumber('5');
      const timeElapsed3 = PERIOD.div(4);

      await _set_chainlinkOracle_indexPrice(price3);
      const timeStamp5 = await addTimeToNextBlockTimestamp(env, timeElapsed3);

      // calculate TWAP = sum(timeElapsed * price)/sum(timeElapsed))
      const weightedPrice = price0
        .mul(timeElapsed0)
        .add(price1.mul(timeElapsed1))
        .add(price2.mul(timeElapsed2))
        .add(price3.mul(timeElapsed3));
      const eTwapOracle = weightedPrice.div(PERIOD);

      await expect(user.perpetual.updateGenericProtocolState())
        .to.emit(user.perpetual, 'TwapUpdated')
        .withArgs(timeStamp5, eTwapOracle, INIT_PRICE);

      // verify end values
      expect((await user.perpetual.getGlobalPosition()).timeOfLastTrade).to.eq(
        timeStamp5
      );
      expect(
        (await user.perpetual.getGlobalPosition()).timeOfLastFunding
      ).to.eq(timeStamp5);

      expect(await user.perpetual.getOracleTwap()).to.eq(eTwapOracle);

      expect(
        await user.perpetual.oracleCumulativeAmountAtBeginningOfPeriod()
      ).to.eq(cumulativeAmountAtStart.add(weightedPrice));
      expect(await user.perpetual.oracleCumulativeAmount()).to.eq(
        cumulativeAmountAtStart.add(weightedPrice)
      );
    });
  });
  describe('Should test the Market twap', async () => {
    it('Should initialize TWAP with initial price points values', async () => {
      expect(await user.perpetual.getMarketTwap()).to.eq(INIT_PRICE);
    });
    it('TWAP value should properly account for variations of the underlying curve oracle price', async () => {
      // start a fresh new period and start calculation example
      const timeStamp0 = await addTimeToNextBlockTimestamp(
        env,
        PERIOD.mul(2) // go far in future to force a new period
      );
      await user.perpetual.updateGenericProtocolState();

      // verify start values
      expect((await user.perpetual.getGlobalPosition()).timeOfLastTrade).to.eq(
        timeStamp0
      );
      expect(
        (await user.perpetual.getGlobalPosition()).timeOfLastFunding
      ).to.eq(timeStamp0);

      expect(await user.perpetual.getMarketTwap()).to.eq(INIT_PRICE);

      const cumulativeAmountAtStart =
        await user.perpetual.marketCumulativeAmount();
      expect(
        await user.perpetual.marketCumulativeAmountAtBeginningOfPeriod()
      ).to.eq(cumulativeAmountAtStart);

      // price of 2 for 1/4 th of the period
      const price0 = asBigNumber('2');
      const timeElapsed0 = PERIOD.div(4);
      const timeStamp1 = await record_market_price(
        env,
        user,
        price0,
        timeElapsed0
      );

      /* check that function updates variables correctly */

      /* cumulativeAmount += timeElapsed * newPrice */
      const timeElapsed = timeStamp1.sub(timeStamp0);
      const productPriceTime = price0.mul(timeElapsed);
      const expectedCumulativeAmountFirstUpdate =
        cumulativeAmountAtStart.add(productPriceTime);

      expect(await user.perpetual.marketCumulativeAmount()).to.eq(
        expectedCumulativeAmountFirstUpdate
      );
      expect(
        await user.perpetual.marketCumulativeAmountAtBeginningOfPeriod()
      ).to.eq(cumulativeAmountAtStart);

      expect((await user.perpetual.getGlobalPosition()).timeOfLastTrade).to.eq(
        timeStamp1
      );
      expect(
        (await user.perpetual.getGlobalPosition()).timeOfLastFunding
      ).to.eq(timeStamp0);

      expect(await user.perpetual.getMarketTwap()).to.eq(INIT_PRICE);

      // price of 3 for 1/4 th of the period
      const price1 = asBigNumber('3');
      const timeElapsed1 = PERIOD.div(4);
      await record_market_price(env, user, price1, timeElapsed1);

      // price of 4 for 1/4 th of the period
      const price2 = asBigNumber('4');
      const timeElapsed2 = PERIOD.div(4);
      await record_market_price(env, user, price2, timeElapsed2);

      // price of 5 for 1/4 th of the period
      const price3 = asBigNumber('5');
      const timeElapsed3 = PERIOD.div(4);

      await _set_curvePool_price_oracle(price3);
      const timeStamp5 = await addTimeToNextBlockTimestamp(env, timeElapsed3);

      // calculate TWAP = sum(timeElapsed * price)/sum(timeElapsed))
      const weightedPrice = price0
        .mul(timeElapsed0)
        .add(price1.mul(timeElapsed1))
        .add(price2.mul(timeElapsed2))
        .add(price3.mul(timeElapsed3));
      const eTwapOracle = weightedPrice.div(PERIOD);

      await expect(user.perpetual.updateGenericProtocolState())
        .to.emit(user.perpetual, 'TwapUpdated')
        .withArgs(timeStamp5, INIT_PRICE, eTwapOracle);

      // verify end values
      expect((await user.perpetual.getGlobalPosition()).timeOfLastTrade).to.eq(
        timeStamp5
      );
      expect(
        (await user.perpetual.getGlobalPosition()).timeOfLastFunding
      ).to.eq(timeStamp5);

      expect(await user.perpetual.getMarketTwap()).to.eq(eTwapOracle);

      expect(
        await user.perpetual.marketCumulativeAmountAtBeginningOfPeriod()
      ).to.eq(cumulativeAmountAtStart.add(weightedPrice));
      expect(await user.perpetual.marketCumulativeAmount()).to.eq(
        cumulativeAmountAtStart.add(weightedPrice)
      );
    });
  });
});
