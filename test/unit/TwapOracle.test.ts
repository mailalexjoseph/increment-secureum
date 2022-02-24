import {expect} from 'chai';
import env, {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {deployMockContract, MockContract} from 'ethereum-waffle';

import {asBigNumber} from '..//helpers/utils/calculations';

import {BigNumber, BigNumberish} from 'ethers';
import {TwapOracle, ChainlinkOracle__factory} from '../../typechain';
import {CurveCryptoSwap2ETH__factory} from '../../contracts-vyper/typechain';

let nextBlockTimestamp: BigNumber = ethers.BigNumber.from(2000000000);

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

type User = {twapOracle: TwapOracle};

describe('TwapOracle', async function () {
  let chainlinkMock: MockContract;
  let curvePoolMock: MockContract;
  let user: User;
  let PERIOD: BigNumber;
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

    await _set_chainlinkOracle_indexPrice(INIT_PRICE); // update even before the TWAP oracle is deployed
    await _set_curvePool_price_oracle(INIT_PRICE); // update even before the TWAP oracle is deployed

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
  async function _set_chainlinkOracle_indexPrice(newIndexPrice: BigNumber) {
    // console.log(`newIndexPrice: ${newIndexPrice}`);

    await chainlinkMock.mock.getIndexPrice.returns(newIndexPrice);
  }
  async function _set_curvePool_price_oracle(newPoolPrice: BigNumber) {
    // console.log(`vBaseAmount: ${vBaseAmount} - vQuoteAmount: ${vQuoteAmount}`);

    await curvePoolMock.mock.last_prices.returns(newPoolPrice);
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

    await user.twapOracle.updateTwap();

    return timeStamp;
  }

  before(async () => {
    // init timeStamp
    await addTimeToNextBlockTimestamp(env, 0);

    // user = await setup();
    user = await _deploy_TWAPOracle();
    PERIOD = await user.twapOracle.PERIOD();

    // take snapshot
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  afterEach(async () => {
    await env.network.provider.send('evm_revert', [snapshotId]);
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  describe('Should test the Chainlink twap', async () => {
    it('Should initialize TWAP with initial price points values', async () => {
      expect(await user.twapOracle.getOracleTwap()).to.eq(INIT_PRICE);
    });
    it('TWAP value should properly account for variations of the underlying chainlink oracle index price', async () => {
      // start a fresh new period and start calculation example
      const timeStamp0 = await addTimeToNextBlockTimestamp(
        env,
        PERIOD.mul(2) // go far in future to force a new period
      );
      await user.twapOracle.updateTwap();

      // verify start values
      expect(await user.twapOracle.blockTimestampLast()).to.eq(timeStamp0);
      expect(await user.twapOracle.blockTimestampAtBeginningOfPeriod()).to.eq(
        timeStamp0
      );

      expect(await user.twapOracle.getOracleTwap()).to.eq(INIT_PRICE);

      const cumulativeAmountAtStart =
        await user.twapOracle.oracleCumulativeAmount();
      expect(
        await user.twapOracle.oracleCumulativeAmountAtBeginningOfPeriod()
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

      expect(await user.twapOracle.oracleCumulativeAmount()).to.eq(
        expectedCumulativeAmountFirstUpdate
      );
      expect(
        await user.twapOracle.oracleCumulativeAmountAtBeginningOfPeriod()
      ).to.eq(cumulativeAmountAtStart);

      expect(await user.twapOracle.blockTimestampLast()).to.eq(timeStamp1);
      expect(await user.twapOracle.blockTimestampAtBeginningOfPeriod()).to.eq(
        timeStamp0
      );

      expect(await user.twapOracle.getOracleTwap()).to.eq(INIT_PRICE);

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

      await expect(user.twapOracle.updateTwap())
        .to.emit(user.twapOracle, 'TwapUpdated')
        .withArgs(timeStamp5, eTwapOracle, INIT_PRICE);

      // verify end values
      expect(await user.twapOracle.blockTimestampLast()).to.eq(timeStamp5);
      expect(await user.twapOracle.blockTimestampAtBeginningOfPeriod()).to.eq(
        timeStamp5
      );

      expect(await user.twapOracle.getOracleTwap()).to.eq(eTwapOracle);

      expect(
        await user.twapOracle.oracleCumulativeAmountAtBeginningOfPeriod()
      ).to.eq(cumulativeAmountAtStart.add(weightedPrice));
      expect(await user.twapOracle.oracleCumulativeAmount()).to.eq(
        cumulativeAmountAtStart.add(weightedPrice)
      );
    });
    describe('Should test the Market twap', async () => {
      it('Should initialize TWAP with initial price points values', async () => {
        expect(await user.twapOracle.getMarketTwap()).to.eq(INIT_PRICE);
      });
      it('TWAP value should properly account for variations of the underlying curve oracle price', async () => {
        // start a fresh new period and start calculation example
        const timeStamp0 = await addTimeToNextBlockTimestamp(
          env,
          PERIOD.mul(2) // go far in future to force a new period
        );
        await user.twapOracle.updateTwap();

        // verify start values
        expect(await user.twapOracle.blockTimestampLast()).to.eq(timeStamp0);
        expect(await user.twapOracle.blockTimestampAtBeginningOfPeriod()).to.eq(
          timeStamp0
        );

        expect(await user.twapOracle.getMarketTwap()).to.eq(INIT_PRICE);

        const cumulativeAmountAtStart =
          await user.twapOracle.marketCumulativeAmount();
        expect(
          await user.twapOracle.marketCumulativeAmountAtBeginningOfPeriod()
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

        expect(await user.twapOracle.marketCumulativeAmount()).to.eq(
          expectedCumulativeAmountFirstUpdate
        );
        expect(
          await user.twapOracle.marketCumulativeAmountAtBeginningOfPeriod()
        ).to.eq(cumulativeAmountAtStart);

        expect(await user.twapOracle.blockTimestampLast()).to.eq(timeStamp1);
        expect(await user.twapOracle.blockTimestampAtBeginningOfPeriod()).to.eq(
          timeStamp0
        );

        expect(await user.twapOracle.getMarketTwap()).to.eq(INIT_PRICE);

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

        await expect(user.twapOracle.updateTwap())
          .to.emit(user.twapOracle, 'TwapUpdated')
          .withArgs(timeStamp5, INIT_PRICE, eTwapOracle);

        // verify end values
        expect(await user.twapOracle.blockTimestampLast()).to.eq(timeStamp5);
        expect(await user.twapOracle.blockTimestampAtBeginningOfPeriod()).to.eq(
          timeStamp5
        );

        expect(await user.twapOracle.getMarketTwap()).to.eq(eTwapOracle);

        expect(
          await user.twapOracle.marketCumulativeAmountAtBeginningOfPeriod()
        ).to.eq(cumulativeAmountAtStart.add(weightedPrice));
        expect(await user.twapOracle.marketCumulativeAmount()).to.eq(
          cumulativeAmountAtStart.add(weightedPrice)
        );
      });
    });
  });
});
