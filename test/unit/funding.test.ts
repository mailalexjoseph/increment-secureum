import {expect} from 'chai';
import {BigNumber, BigNumberish, Signer} from 'ethers';
import env, {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {deployMockContract, MockContract} from 'ethereum-waffle';

import {asBigNumber, rMul, rDiv} from '../helpers/utils/calculations';

// dependency abis
import VBase from '../../artifacts/contracts/tokens/VBase.sol/VBase.json';
import VQuote from '../../artifacts/contracts/tokens/VQuote.sol/VQuote.json';
import Vault from '../../artifacts/contracts/Vault.sol/Vault.json';
import CurveCryptoSwap2ETH from '../../contracts-vyper/artifacts/CurveCryptoSwap2ETH.vy/CurveCryptoSwap2ETH.json';

import {TestPerpetual} from '../../typechain';
import {days, minutes} from '../helpers/utils/time';

let nextBlockTimestamp = 2000000000;
async function addTimeToNextBlockTimestamp(
  hre: HardhatRuntimeEnvironment,
  additionalTimestamp: number
): Promise<BigNumber> {
  nextBlockTimestamp += additionalTimestamp;

  await hre.network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [nextBlockTimestamp],
  });

  return BigNumber.from(nextBlockTimestamp);
}

// math econ functions
const calcCurrentTraderPremium = (
  marketPrice: BigNumber,
  indexPrice: BigNumber
) => rDiv(marketPrice.sub(indexPrice), indexPrice);

const calcFundingRate = (
  sensitivity: BigNumber,
  weightedTradePremiumOverLastPeriod: BigNumber,
  timePassed: BigNumber | BigNumberish
) =>
  rMul(sensitivity, weightedTradePremiumOverLastPeriod)
    .mul(timePassed)
    .div(BigNumber.from(days(1)));

type User = {perpetual: TestPerpetual};

describe('Funding rate', async function () {
  // mock dependencies
  let marketMock: MockContract;
  let vaultMock: MockContract;
  let vQuoteMock: MockContract;
  let vBaseMock: MockContract;

  // contract and accounts
  let deployer: Signer;
  let user: User;
  let snapshotId: number;

  // function arguments
  let marketPrice: BigNumber, indexPrice: BigNumber;

  // constants
  const SENSITIVITY = asBigNumber('1');

  async function _deploy_perpetual() {
    [deployer] = await ethers.getSigners();

    // build dependencies as mocks
    marketMock = await deployMockContract(deployer, CurveCryptoSwap2ETH.abi);
    vaultMock = await deployMockContract(deployer, Vault.abi);
    vQuoteMock = await deployMockContract(deployer, VQuote.abi);
    vBaseMock = await deployMockContract(deployer, VBase.abi);

    // needed in the constructor of Perpetual
    await vQuoteMock.mock.approve.returns(true);
    await vBaseMock.mock.approve.returns(true);

    marketPrice = asBigNumber('1');
    indexPrice = asBigNumber('1.1');

    await marketMock.mock.last_prices.returns(marketPrice);
    await vBaseMock.mock.getIndexPrice.returns(indexPrice);

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

  before(async () => {
    // init timeStamp
    await addTimeToNextBlockTimestamp(env, 0);

    user = await _deploy_perpetual();

    // take snapshot
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  afterEach(async () => {
    await env.network.provider.send('evm_revert', [snapshotId]);
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  it('Expected initialized state', async () => {
    const position = await user.perpetual.getGlobalPosition();

    // expect(position.timeOfLastTrade).to.be.equal(0);
    expect(position.cumFundingRate).to.be.equal(asBigNumber('0'));
  });

  it('Update funding rate correctly in subsequent calls', async () => {
    marketPrice = asBigNumber('1');
    indexPrice = asBigNumber('1.1');
    await user.perpetual.__TestPerpetual_setTWAP(marketPrice, indexPrice);

    // START_TIME is getting set in constructor
    // by default global.timeOfLastTrade = 0
    const START_TIME = (await user.perpetual.getGlobalPosition())
      .timeOfLastTrade;

    /************* FIRST TRADE ***************/
    // initial parameters for first call
    const timeFirstTransaction = await addTimeToNextBlockTimestamp(
      env,
      minutes(1)
    );

    await user.perpetual.__TestPerpetual_updateFunding();

    // expected values after first trade
    const eCurrentTraderPremiumFirstTransac: BigNumber =
      calcCurrentTraderPremium(marketPrice, indexPrice);

    const eTimePassedInFirstTransaction = timeFirstTransaction.sub(START_TIME);

    const eFundingRateFirstTransac = calcFundingRate(
      SENSITIVITY,
      eCurrentTraderPremiumFirstTransac,
      eTimePassedInFirstTransaction
    );

    expect(eFundingRateFirstTransac).to.be.eq(
      (await user.perpetual.getGlobalPosition()).cumFundingRate
    );

    /************* SECOND TRADE ***************/
    const timeSecondTransaction = await addTimeToNextBlockTimestamp(
      env,
      minutes(5)
    );
    await user.perpetual.__TestPerpetual_updateFunding();

    // expected values after second trade
    const eCurrentTraderPremiumSecondTransac = calcCurrentTraderPremium(
      marketPrice,
      indexPrice
    );

    const eTimePassedSinceLastTrade =
      timeSecondTransaction.sub(timeFirstTransaction);

    const position = await user.perpetual.getGlobalPosition();
    expect(position.timeOfLastTrade).to.be.equal(timeSecondTransaction);

    const eFundingRateSecondTrans = calcFundingRate(
      SENSITIVITY,
      eCurrentTraderPremiumSecondTransac,
      eTimePassedSinceLastTrade
    ).add(eFundingRateFirstTransac);

    expect(position.cumFundingRate).to.be.equal(eFundingRateSecondTrans);
  });

  it('Get funding payments from global for user', async () => {
    const initialBlockTime = await addTimeToNextBlockTimestamp(env, 100);
    const initialCumFundingRate = ethers.utils.parseEther('1');
    // set starting values of the global state
    await user.perpetual.__TestPerpetual_setGlobalPosition(
      initialBlockTime,
      initialCumFundingRate
    );

    // set starting values of the user state
    const userAddress = await deployer.getAddress();
    await user.perpetual.__TestPerpetual_setTraderPosition(
      userAddress,
      ethers.utils.parseEther('-1.3'),
      ethers.utils.parseEther('1'),
      initialCumFundingRate
    );

    const firstFundingPayment = await user.perpetual.getFundingPayments(
      userAddress
    );

    // firstFundingPaymentOne is 0 because global.cumFundingRate and user.cumFundingRate are equal
    expect(firstFundingPayment).to.eq(0);

    // set new global position
    const secondBlockTime = await addTimeToNextBlockTimestamp(env, 100);
    const secondCumFundingRate = ethers.utils.parseEther('1.2');
    await user.perpetual.__TestPerpetual_setGlobalPosition(
      secondBlockTime,
      secondCumFundingRate
    );

    const userPositionBeforeSecondUpdate =
      await user.perpetual.getTraderPosition(userAddress);
    const globalPositionBeforeSecondUpdate =
      await user.perpetual.getGlobalPosition();

    const expectedUpcomingFundingRate =
      userPositionBeforeSecondUpdate.cumFundingRate.sub(
        globalPositionBeforeSecondUpdate.cumFundingRate
      );
    const expectedUpcomingFundingPayment = rMul(
      expectedUpcomingFundingRate,
      userPositionBeforeSecondUpdate.positionSize.abs() // absolute value
    );

    const secondFundingPayment = await user.perpetual.getFundingPayments(
      userAddress
    );

    expect(expectedUpcomingFundingPayment).to.eq(secondFundingPayment);
  });
});
