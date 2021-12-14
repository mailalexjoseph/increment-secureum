import {BigNumber} from 'ethers';
import {TestLibFunding} from '../typechain';
import {TestLibFunding__factory} from '../typechain';
import {ethers} from 'hardhat';
// import {expect} from 'chai';

import chaiModule = require('./chai-setup');
const {expect} = chaiModule;

// utils
const asBigNumber = (number: string) => ethers.utils.parseEther(number);
const asDecimal = (number: BigNumber) => ethers.utils.formatEther(number);

// time-utils
const minutes = (number: number) => number * 60;
const hours = (number: number) => minutes(number) * 60;
const days = (number: number) => hours(number) * 24;

// getters
const getLatestTimestamp = async () => {
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  return block.timestamp;
};

// constants
const WAY = ethers.utils.parseEther('1');

// math  util functions
const rMul = (a: BigNumber, b: BigNumber) => a.mul(b).div(WAY);
const rDiv = (a: BigNumber, b: BigNumber) => a.mul(WAY).div(b);

// math econ functions
const calcTradePremium = (marketPrice: BigNumber, indexPrice: BigNumber) =>
  rDiv(marketPrice.sub(indexPrice), indexPrice);

const calcCumTradePremium = (
  premium: BigNumber,
  startTime: number,
  endTime: number
) =>
  endTime > startTime
    ? BigNumber.from(endTime - startTime).mul(premium)
    : asBigNumber('0');

const calcFundingRate = (
  sensitivity: BigNumber,
  cumTradePremium: BigNumber,
  timePassed: number
) =>
  rMul(sensitivity, cumTradePremium)
    .mul(BigNumber.from(timePassed))
    .div(BigNumber.from(days(1)));

describe('Funding libary: Unit tests', function () {
  // contract and accounts
  let deployer: any;
  let fundingContract: TestLibFunding;
  let funding: any;

  // position parameters
  let cumTradePremium: BigNumber,
    timeOfLastTrade: number,
    timeStamp: number,
    premium: BigNumber,
    cumFundingRate: BigNumber;

  // function arguments
  let marketPrice: BigNumber,
    indexPrice: BigNumber,
    currentTime: number,
    TWAP_FREQUENCY: number;

  // test parameters
  let startTime: number;

  // constants
  const SENSITIVITY = asBigNumber('1');

  beforeEach(async () => {
    [deployer] = await ethers.getSigners();
    const FundingFactory = new TestLibFunding__factory(deployer);
    fundingContract = await FundingFactory.deploy();
    funding = fundingContract.connect(deployer);

    // default parameters
    startTime = await getLatestTimestamp();
    TWAP_FREQUENCY = minutes(15);
  });

  describe('Can handle first transaction', async function () {
    it('Expected initialized state', async () => {
      const position = await funding.getGlobalPosition();
      expect(position.cumTradePremium).to.be.equal(asBigNumber('0'));
      expect(position.timeOfLastTrade).to.be.equal(0);
      expect(position.timeStamp).to.be.equal(0);
      expect(position.premium).to.be.equal(asBigNumber('0'));
      expect(position.cumFundingRate).to.be.equal(asBigNumber('0'));
    });
    it('Should handle first transaction', async () => {
      await funding.calculateFunding(
        asBigNumber('1'),
        asBigNumber('1'),
        startTime,
        minutes(15)
      );
      // check wether results are to be expected
      const position = await funding.getGlobalPosition();
      //console.log(position);
      expect(position.cumTradePremium).to.be.equal(asBigNumber('0'));
      expect(position.timeOfLastTrade).to.be.equal(startTime);
      expect(position.timeStamp).to.be.equal(startTime);
      expect(position.premium).to.be.equal(asBigNumber('0'));
      expect(position.cumFundingRate).to.be.equal(asBigNumber('0'));
    });
  });
  describe('Calculate correct new state', async function () {
    beforeEach(async () => {
      // initial parameters after first call
      cumTradePremium = asBigNumber('0');
      timeOfLastTrade = startTime;
      timeStamp = startTime;
      premium = asBigNumber('0');
      cumFundingRate = asBigNumber('0');

      await funding.setGlobalPosition(
        cumTradePremium,
        timeOfLastTrade,
        timeStamp,
        premium,
        cumFundingRate
      );
    });
    it('trade in funding rate window', async () => {
      marketPrice = asBigNumber('1');
      indexPrice = asBigNumber('1.1');
      currentTime = startTime + minutes(5);
      await funding.calculateFunding(
        marketPrice,
        indexPrice,
        currentTime,
        TWAP_FREQUENCY
      );
      const position = await funding.getGlobalPosition();

      // calculate expected values of functions
      const eTradePremium: BigNumber = calcTradePremium(
        marketPrice,
        indexPrice
      );
      const eCumTradePremium: BigNumber = calcCumTradePremium(
        eTradePremium,
        startTime,
        currentTime
      );
      // console.log('Time difference', currentTime - startTime);
      // console.log('ePremium is: ' + eTradePremium);
      // console.log('eCumTradePremium is: ' + eCumTradePremium);
      expect(position.cumTradePremium).to.be.equal(eCumTradePremium);
      expect(position.timeOfLastTrade).to.be.equal(currentTime);
      expect(position.timeStamp).to.be.equal(startTime);
      expect(position.premium).to.be.equal(asBigNumber('0'));
      expect(position.cumFundingRate).to.be.equal(asBigNumber('0'));
    });
    it('trade after funding rate window', async () => {
      marketPrice = asBigNumber('1');
      indexPrice = asBigNumber('1.1');
      currentTime = startTime + TWAP_FREQUENCY + 1; // after funding rate window
      await funding.calculateFunding(
        marketPrice,
        indexPrice,
        currentTime,
        TWAP_FREQUENCY
      );
      const position = await funding.getGlobalPosition();

      // calculate expected values of functions
      const eTradePremium: BigNumber = calcTradePremium(
        marketPrice,
        indexPrice
      );
      const eCumTradePremium: BigNumber = calcCumTradePremium(
        eTradePremium,
        startTime,
        currentTime
      );
      // console.log('Time difference', currentTime - startTime);
      // console.log('ePremium is: ' + eTradePremium);
      // console.log('eCumTradePremium is: ' + eCumTradePremium);
      expect(position.cumTradePremium).to.be.equal(asBigNumber('0'));
      expect(position.timeOfLastTrade).to.be.equal(currentTime);
      expect(position.timeStamp).to.be.equal(currentTime);

      const eFundingRate = calcFundingRate(
        SENSITIVITY,
        eCumTradePremium,
        currentTime - startTime
      );

      // console.log(
      //   'SENSITIVITY x cumTradePremium' + rMul(SENSITIVITY, eCumTradePremium)
      // );
      // console.log('timePassed is' + BigNumber.from(currentTime - startTime));
      // console.log('1 days' + BigNumber.from(days(1)));
      // console.log('eCumFundingRate is: ' + eFundingRate);
      expect(position.cumFundingRate).to.be.equal(eFundingRate);
    });
    it('one trade in funding rate window and one trade after', async () => {
      marketPrice = asBigNumber('1');
      indexPrice = asBigNumber('1.1');

      /************* FIRST TRADE ***************/
      // initial parameters for first call

      currentTime = startTime + minutes(5); // before end of funding rate window
      const timeOfTradeOne = currentTime; // before end of funding rate window
      await funding.calculateFunding(
        marketPrice,
        indexPrice,
        currentTime,
        TWAP_FREQUENCY
      );

      // expected values after first trade
      const eTradePremium1: BigNumber = calcTradePremium(
        marketPrice,
        indexPrice
      );
      const eCumTradePremiumTmp: BigNumber = calcCumTradePremium(
        eTradePremium1,
        startTime,
        currentTime
      );

      /************* SECOND TRADE ***************/
      currentTime = startTime + TWAP_FREQUENCY + 1; // after end of funding rate window
      await funding.calculateFunding(
        marketPrice,
        indexPrice,
        currentTime,
        TWAP_FREQUENCY
      );

      // expected values after first trade
      const eTradePremium2: BigNumber = calcTradePremium(
        marketPrice,
        indexPrice
      );
      const eCumTradePremiumFinal: BigNumber = calcCumTradePremium(
        eTradePremium2,
        timeOfTradeOne, // only [tradeOfTradeOne, currentTime] is relevant
        currentTime
      ).add(eCumTradePremiumTmp); // add premium from first trade

      /************* CHECK RSLTs ***************/

      const position = await funding.getGlobalPosition();
      // console.log('Time difference', currentTime - startTime);
      // console.log('ePremium is: ' + eTradePremium);
      // console.log('eCumTradePremium is: ' + eCumTradePremium);
      expect(position.cumTradePremium).to.be.equal(asBigNumber('0'));
      expect(position.timeOfLastTrade).to.be.equal(currentTime);
      expect(position.timeStamp).to.be.equal(currentTime);

      const eFundingRate = calcFundingRate(
        SENSITIVITY,
        eCumTradePremiumFinal,
        currentTime - startTime
      );

      // console.log(
      //   'SENSITIVITY x cumTradePremium' + rMul(SENSITIVITY, eCumTradePremium)
      // );
      // console.log('timePassed is' + BigNumber.from(currentTime - startTime));
      // console.log('1 days' + BigNumber.from(days(1)));
      // console.log('eCumFundingRate is: ' + eFundingRate);
      expect(position.cumFundingRate).to.be.equal(eFundingRate);
    });
  });
});
