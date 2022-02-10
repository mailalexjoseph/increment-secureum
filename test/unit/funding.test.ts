// import {expect} from 'chai';
// import {BigNumber} from 'ethers';
// import {getNamedAccounts, deployments} from 'hardhat';
// import {ethers} from 'hardhat';
// import env = require('hardhat');
// import {TestLibFunding} from '../../typechain';
// import {asBigNumber, rMul, rDiv} from '../helpers/calculations';
// import {setupUser} from '../../helpers/misc-utils';

// // time-utils
// const minutes = (number: number) => number * 60;
// const hours = (number: number) => minutes(number) * 60;
// const days = (number: number) => hours(number) * 24;

// // getters
// const getLatestTimestamp = async () => {
//   const blockNumber = await ethers.provider.getBlockNumber();
//   const block = await ethers.provider.getBlock(blockNumber);
//   return block.timestamp;
// };

// // math econ functions
// const calcTradePremium = (marketPrice: BigNumber, indexPrice: BigNumber) =>
//   rDiv(marketPrice.sub(indexPrice), indexPrice);

// const calcCumTradePremium = (
//   premium: BigNumber,
//   START_TIME: number,
//   endTime: number
// ) =>
//   endTime > START_TIME
//     ? BigNumber.from(endTime - START_TIME).mul(premium)
//     : asBigNumber('0');

// const calcFundingRate = (
//   sensitivity: BigNumber,
//   cumTradePremium: BigNumber,
//   timePassed: number
// ) =>
//   rMul(sensitivity, cumTradePremium)
//     .mul(BigNumber.from(timePassed))
//     .div(BigNumber.from(days(1)));

// type User = {address: string} & {
//   funding: TestLibFunding;
// };

// describe('Funding library: Unit tests', async function () {
//   // contract and accounts
//   let user: User;

//   // position parameters
//   let cumTradePremium: BigNumber,
//     timeOfLastTrade: number,
//     timeStamp: number,
//     premium: BigNumber,
//     cumFundingRate: BigNumber;

//   // function arguments
//   let marketPrice: BigNumber, indexPrice: BigNumber, currentTime: number;

//   // constants
//   const SENSITIVITY = asBigNumber('1');
//   const START_TIME = await getLatestTimestamp();
//   const TWAP_FREQUENCY = minutes(15);

//   const setup = deployments.createFixture(async (): Promise<User> => {
//     const {deployer} = await getNamedAccounts();

//     await env.deployments.deploy('TestLibFunding', {
//       from: deployer,
//       log: true,
//     });

//     user = await setupUser(deployer, {
//       funding: await ethers.getContract('TestLibFunding', deployer),
//     });

//     return user;
//   });

//   beforeEach(async () => {
//     user = await setup();
//   });

//   describe('Can handle first transaction', async function () {
//     it('Expected initialized state', async () => {
//       const position = await user.funding.getGlobalPosition();
//       expect(position.cumTradePremium).to.be.equal(asBigNumber('0'));
//       expect(position.timeOfLastTrade).to.be.equal(0);
//       expect(position.timeStamp).to.be.equal(0);
//       expect(position.premium).to.be.equal(asBigNumber('0'));
//       expect(position.cumFundingRate).to.be.equal(asBigNumber('0'));
//     });
//     it('Should handle first transaction', async () => {
//       await user.funding.calculateFunding(
//         asBigNumber('1'),
//         asBigNumber('1'),
//         START_TIME,
//         minutes(15)
//       );
//       // check wether results are to be expected
//       const position = await user.funding.getGlobalPosition();
//       //console.log(position);
//       expect(position.cumTradePremium).to.be.equal(asBigNumber('0'));
//       expect(position.timeOfLastTrade).to.be.equal(START_TIME);
//       expect(position.timeStamp).to.be.equal(START_TIME);
//       expect(position.premium).to.be.equal(asBigNumber('0'));
//       expect(position.cumFundingRate).to.be.equal(asBigNumber('0'));
//     });
//   });
//   describe('Calculate correct new state', async function () {
//     beforeEach(async () => {
//       // initial parameters after first call
//       cumTradePremium = asBigNumber('0');
//       timeOfLastTrade = START_TIME;
//       timeStamp = START_TIME;
//       premium = asBigNumber('0');
//       cumFundingRate = asBigNumber('0');

//       await user.funding.__TestPerpetual_setGlobalPosition(
//         cumTradePremium,
//         timeOfLastTrade,
//         timeStamp,
//         premium,
//         cumFundingRate
//       );
//     });
//     it('trade in funding rate window', async () => {
//       marketPrice = asBigNumber('1');
//       indexPrice = asBigNumber('1.1');
//       currentTime = START_TIME + minutes(5);
//       await user.funding.calculateFunding(
//         marketPrice,
//         indexPrice,
//         currentTime,
//         TWAP_FREQUENCY
//       );
//       const position = await user.funding.getGlobalPosition();

//       // calculate expected values of functions
//       const eTradePremium: BigNumber = calcTradePremium(
//         marketPrice,
//         indexPrice
//       );
//       const eCumTradePremium: BigNumber = calcCumTradePremium(
//         eTradePremium,
//         START_TIME,
//         currentTime
//       );
//       // console.log('Time difference', currentTime - START_TIME);
//       // console.log('ePremium is: ' + eTradePremium);
//       // console.log('eCumTradePremium is: ' + eCumTradePremium);
//       expect(position.cumTradePremium).to.be.equal(eCumTradePremium);
//       expect(position.timeOfLastTrade).to.be.equal(currentTime);
//       expect(position.timeStamp).to.be.equal(START_TIME);
//       expect(position.premium).to.be.equal(asBigNumber('0'));
//       expect(position.cumFundingRate).to.be.equal(asBigNumber('0'));
//     });
//     it('trade after funding rate window', async () => {
//       marketPrice = asBigNumber('1');
//       indexPrice = asBigNumber('1.1');
//       currentTime = START_TIME + TWAP_FREQUENCY + 1; // after funding rate window
//       await user.funding.calculateFunding(
//         marketPrice,
//         indexPrice,
//         currentTime,
//         TWAP_FREQUENCY
//       );
//       const position = await user.funding.getGlobalPosition();

//       // calculate expected values of functions
//       const eTradePremium: BigNumber = calcTradePremium(
//         marketPrice,
//         indexPrice
//       );
//       const eCumTradePremium: BigNumber = calcCumTradePremium(
//         eTradePremium,
//         START_TIME,
//         currentTime
//       );
//       // console.log('Time difference', currentTime - START_TIME);
//       // console.log('ePremium is: ' + eTradePremium);
//       // console.log('eCumTradePremium is: ' + eCumTradePremium);
//       expect(position.cumTradePremium).to.be.equal(asBigNumber('0'));
//       expect(position.timeOfLastTrade).to.be.equal(currentTime);
//       expect(position.timeStamp).to.be.equal(currentTime);

//       const eFundingRate = calcFundingRate(
//         SENSITIVITY,
//         eCumTradePremium,
//         currentTime - START_TIME
//       );

//       // console.log(
//       //   'SENSITIVITY x cumTradePremium' + rMul(SENSITIVITY, eCumTradePremium)
//       // );
//       // console.log('timePassed is' + BigNumber.from(currentTime - START_TIME));
//       // console.log('1 days' + BigNumber.from(days(1)));
//       // console.log('eCumFundingRate is: ' + eFundingRate);
//       expect(position.cumFundingRate).to.be.equal(eFundingRate);
//     });
//     it('one trade in funding rate window and one trade after', async () => {
//       marketPrice = asBigNumber('1');
//       indexPrice = asBigNumber('1.1');

//       /************* FIRST TRADE ***************/
//       // initial parameters for first call

//       currentTime = START_TIME + minutes(5); // before end of funding rate window
//       const timeOfTradeOne = currentTime; // before end of funding rate window
//       await user.funding.calculateFunding(
//         marketPrice,
//         indexPrice,
//         currentTime,
//         TWAP_FREQUENCY
//       );

//       // expected values after first trade
//       const eTradePremium1: BigNumber = calcTradePremium(
//         marketPrice,
//         indexPrice
//       );
//       const eCumTradePremiumTmp: BigNumber = calcCumTradePremium(
//         eTradePremium1,
//         START_TIME,
//         currentTime
//       );

//       /************* SECOND TRADE ***************/
//       currentTime = START_TIME + TWAP_FREQUENCY + 1; // after end of funding rate window
//       await user.funding.calculateFunding(
//         marketPrice,
//         indexPrice,
//         currentTime,
//         TWAP_FREQUENCY
//       );

//       // expected values after first trade
//       const eTradePremium2: BigNumber = calcTradePremium(
//         marketPrice,
//         indexPrice
//       );
//       const eCumTradePremiumFinal: BigNumber = calcCumTradePremium(
//         eTradePremium2,
//         timeOfTradeOne, // only [tradeOfTradeOne, currentTime] is relevant
//         currentTime
//       ).add(eCumTradePremiumTmp); // add premium from first trade

//       /************* CHECK RSLTs ***************/

//       const position = await user.funding.getGlobalPosition();
//       // console.log('Time difference', currentTime - START_TIME);
//       // console.log('ePremium is: ' + eTradePremium);
//       // console.log('eCumTradePremium is: ' + eCumTradePremium);
//       expect(position.cumTradePremium).to.be.equal(asBigNumber('0'));
//       expect(position.timeOfLastTrade).to.be.equal(currentTime);
//       expect(position.timeStamp).to.be.equal(currentTime);

//       const eFundingRate = calcFundingRate(
//         SENSITIVITY,
//         eCumTradePremiumFinal,
//         currentTime - START_TIME
//       );

//       // console.log(
//       //   'SENSITIVITY x cumTradePremium' + rMul(SENSITIVITY, eCumTradePremium)
//       // );
//       // console.log('timePassed is' + BigNumber.from(currentTime - START_TIME));
//       // console.log('1 days' + BigNumber.from(days(1)));
//       // console.log('eCumFundingRate is: ' + eFundingRate);
//       expect(position.cumFundingRate).to.be.equal(eFundingRate);
//     });
//   });
// });
