import {expect} from 'chai';
import {BigNumber, Signer} from 'ethers';
import env, {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {deployMockContract, MockContract} from 'ethereum-waffle';

// dependency abis
import ChainlinkOracle from '../../artifacts/contracts/oracles/ChainlinkOracle.sol/ChainlinkOracle.json';
import PoolTWAPOracle from '../../artifacts/contracts/oracles/PoolTWAPOracle.sol/PoolTWAPOracle.json';
import ChainlinkTWAPOracle from '../../artifacts/contracts/oracles/ChainlinkTWAPOracle.sol/ChainlinkTWAPOracle.json';
import VirtualToken from '../../artifacts/contracts/tokens/VirtualToken.sol/VirtualToken.json';
import Vault from '../../artifacts/contracts/Vault.sol/Vault.json';
import CurveCryptoSwap2ETH from '../../contracts-vyper/artifacts/CurveCryptoSwap2ETH.vy/CurveCryptoSwap2ETH.json';

import {TestPerpetual} from '../../typechain';
import {asBigNumber, rMul, rDiv} from '../helpers/utils/calculations';

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

// math econ functions
const calcCurrentTraderPremium = (
  marketPrice: BigNumber,
  indexPrice: BigNumber
) => rDiv(marketPrice.sub(indexPrice), indexPrice);

const calcWeightedTradePremiumOverLastPeriod = (
  timePassedSinceLastTrade: BigNumber,
  currentTraderPremium: BigNumber
) => timePassedSinceLastTrade.mul(currentTraderPremium);

const calcFundingRate = (
  sensitivity: BigNumber,
  weightedTradePremiumOverLastPeriod: BigNumber,
  timePassed: number
) =>
  rMul(sensitivity, weightedTradePremiumOverLastPeriod)
    .mul(BigNumber.from(timePassed))
    .div(BigNumber.from(days(1)));

type User = {perpetual: TestPerpetual};

describe('Funding rate', async function () {
  // mock dependencies
  let chainlinkOracleMock: MockContract;
  let chainlinkTWAPOracleMock: MockContract;
  let marketMock: MockContract;
  let poolTWAPOracleMock: MockContract;
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
    chainlinkOracleMock = await deployMockContract(
      deployer,
      ChainlinkOracle.abi
    );
    chainlinkTWAPOracleMock = await deployMockContract(
      deployer,
      ChainlinkTWAPOracle.abi
    );
    marketMock = await deployMockContract(deployer, CurveCryptoSwap2ETH.abi);
    poolTWAPOracleMock = await deployMockContract(deployer, PoolTWAPOracle.abi);
    vaultMock = await deployMockContract(deployer, Vault.abi);
    vQuoteMock = await deployMockContract(deployer, VirtualToken.abi);
    vBaseMock = await deployMockContract(deployer, VirtualToken.abi);

    // needed in the constructor of Perpetual
    await vQuoteMock.mock.approve.returns(true);
    await vBaseMock.mock.approve.returns(true);

    const TestPerpetualContract = await ethers.getContractFactory(
      'TestPerpetual'
    );
    const perpetual = <TestPerpetual>(
      await TestPerpetualContract.deploy(
        chainlinkOracleMock.address,
        poolTWAPOracleMock.address,
        chainlinkTWAPOracleMock.address,
        vBaseMock.address,
        vQuoteMock.address,
        marketMock.address,
        vaultMock.address
      )
    );

    return {perpetual};
  }

  before(async () => {
    snapshotId = await env.network.provider.send('evm_snapshot', []);
  });

  beforeEach(async () => {
    user = await _deploy_perpetual();
  });

  after(async () => {
    await env.network.provider.send('evm_revert', [snapshotId]);
  });

  it('Expected initialized state', async () => {
    const position = await user.perpetual.getGlobalPosition();

    expect(position.timeOfLastTrade).to.be.equal(0);
    expect(position.cumFundingRate).to.be.equal(asBigNumber('0'));
  });

  it('Update funding rate correctly in subsequent calls', async () => {
    marketPrice = asBigNumber('1');
    indexPrice = asBigNumber('1.1');
    await poolTWAPOracleMock.mock.getEURUSDTWAP.returns(marketPrice);
    await chainlinkTWAPOracleMock.mock.getEURUSDTWAP.returns(indexPrice);

    // by default global.timeOfLastTrade = 0
    const START_TIME = 0;

    /************* FIRST TRADE ***************/
    // initial parameters for first call
    const timeFirstTransaction = await addTimeToNextBlockTimestamp(
      env,
      minutes(1)
    );

    await user.perpetual.updateFundingRate();

    // expected values after first trade
    const eCurrentTraderPremiumFirstTransac: BigNumber =
      calcCurrentTraderPremium(marketPrice, indexPrice);

    const eWeightedTradePremiumOverLastPeriodFirstTransac: BigNumber =
      calcWeightedTradePremiumOverLastPeriod(
        ethers.BigNumber.from(timeFirstTransaction.toString()),
        eCurrentTraderPremiumFirstTransac
      );

    const eTimePassedInFirstTransaction = timeFirstTransaction - START_TIME;

    const eFundingRateFirstTransac = calcFundingRate(
      SENSITIVITY,
      eWeightedTradePremiumOverLastPeriodFirstTransac,
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
    await user.perpetual.updateFundingRate();

    // expected values after second trade
    const eCurrentTraderPremiumSecondTransac: BigNumber =
      calcCurrentTraderPremium(marketPrice, indexPrice);

    const eTimePassedSinceLastTrade =
      timeSecondTransaction - timeFirstTransaction;

    const eWeightedTradePremiumOverLastPeriodSecondTransac: BigNumber =
      calcWeightedTradePremiumOverLastPeriod(
        ethers.BigNumber.from(eTimePassedSinceLastTrade.toString()),
        eCurrentTraderPremiumSecondTransac
      );

    const position = await user.perpetual.getGlobalPosition();
    expect(position.timeOfLastTrade).to.be.equal(timeSecondTransaction);

    const eFundingRateSecondTrans = calcFundingRate(
      SENSITIVITY,
      eWeightedTradePremiumOverLastPeriodSecondTransac,
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
      userPositionBeforeSecondUpdate.openNotional.mul(-1) // absolute value
    );

    const secondFundingPayment = await user.perpetual.getFundingPayments(
      userAddress
    );

    expect(expectedUpcomingFundingPayment).to.eq(secondFundingPayment);
  });
});
