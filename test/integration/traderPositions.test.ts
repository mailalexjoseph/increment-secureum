import {expect} from 'chai';
import {BigNumber} from 'ethers';
import env, {ethers} from 'hardhat';

import {rMul} from '../helpers/utils/calculations';
import {setup, funding, User} from '../helpers/setup';
import {setUpPoolLiquidity} from '../helpers/PerpetualUtils';
import {setNextBlockTimestamp} from '../../helpers/misc-utils';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {getLatestTimestamp} from '../../helpers/misc-utils';
import {Side} from '../helpers/utils/types';

const FULL_REDUCTION_RATIO = ethers.utils.parseEther('1');

describe('Increment: open/close long/short trading positions', () => {
  let alice: User;
  let bob: User;
  let lp: User;
  let lpTwo: User;
  let deployer: User;
  let depositAmountUSDC: BigNumber;
  let depositAmount: BigNumber; // with 1e18 decimals

  // protocol constants
  let INSURANCE_FEE: BigNumber;
  let VQUOTE_INDEX: BigNumber;

  before('Get protocol constants', async () => {
    const {deployer} = await setup();

    INSURANCE_FEE = await deployer.clearingHouse.INSURANCE_FEE();
    VQUOTE_INDEX = await deployer.perpetual.VQUOTE_INDEX();
  });

  beforeEach(
    'Give Alice funds and approve transfer by the vault to her balance',
    async () => {
      ({alice, bob, lp, lpTwo, deployer} = await setup());
      depositAmountUSDC = (await funding()).div(200); // amount used for collaterals (liquidity provisioning is 200x)
      depositAmount = await tokenToWad(
        await alice.vault.getReserveTokenDecimals(),
        depositAmountUSDC
      );

      await alice.usdc.approve(alice.vault.address, depositAmountUSDC);
    }
  );

  it('Should fail if the pool has no liquidity in it', async () => {
    await expect(
      alice.clearingHouse.extendPositionWithCollateral(
        0,
        depositAmountUSDC,
        alice.usdc.address,
        depositAmount.div(10),
        Side.Long,
        0
      )
    ).to.be.revertedWith(''); // no error message by curve
  });

  it('Should fail if the amount is null', async () => {
    await expect(
      alice.clearingHouse.extendPosition(0, 0, Side.Long, 0)
    ).to.be.revertedWith("The amount can't be null");
  });

  it('Should fail if user does not have enough funds deposited in the vault', async () => {
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));
    await setUpPoolLiquidity(lp, depositAmountUSDC.mul(200));
    await setUpPoolLiquidity(lpTwo, depositAmountUSDC.mul(200));
    await setUpPoolLiquidity(deployer, depositAmountUSDC.mul(200));

    await alice.clearingHouse.deposit(
      0,
      depositAmountUSDC.div(5),
      alice.usdc.address
    );

    // swap succeeds, then it fails when opening the position
    await expect(
      alice.clearingHouse.extendPosition(0, depositAmount.mul(20), Side.Long, 0)
    ).to.be.revertedWith('Not enough margin');
  });

  async function _openAndCheckPosition(
    direction: Side,
    expectedTokensBought: string,
    minAmount: BigNumber
  ) {
    // expected values
    const nextBlockTimestamp = await setNextBlockTimestamp(env);

    const initialVaultBalance = await alice.vault.getTraderBalance(
      0,
      alice.address
    );

    let positionSize, notionalAmount;
    if (direction === Side.Long) {
      notionalAmount = depositAmount.mul(-1);
      positionSize = expectedTokensBought;
    } else {
      notionalAmount = expectedTokensBought;
      positionSize = depositAmount.mul(-1);
    }

    await expect(
      alice.clearingHouse.extendPosition(0, depositAmount, direction, minAmount)
    )
      .to.emit(alice.clearingHouse, 'ExtendPosition')
      .withArgs(
        0,
        alice.address,
        nextBlockTimestamp,
        direction,
        notionalAmount,
        positionSize
      );

    const alicePosition = await alice.perpetual.getTraderPosition(
      alice.address
    );
    expect(alicePosition.positionSize).to.be.equal(positionSize);
    expect(alicePosition.openNotional).to.be.equal(notionalAmount);
    // cumFundingRate is set at 0 because there's no activity before in this test
    expect(alicePosition.cumFundingRate).to.be.equal(0);

    if (direction === Side.Long) {
      expect(alicePosition.positionSize).to.be.gte(minAmount);
    } else {
      expect(alicePosition.openNotional).to.be.gte(minAmount);
    }

    // the USDC amount (with 6 decimals) must be converted to 18 decimals
    expect(
      alicePosition.openNotional.abs().div(ethers.utils.parseEther('0.01'))
    ).to.be.above(ethers.BigNumber.from('1'));

    const vaultBalanceAfterPositionOpened = await alice.vault.getTraderBalance(
      0,
      alice.address
    );

    const eInsuranceFee = rMul(alicePosition.openNotional.abs(), INSURANCE_FEE);
    // note: fundingRate is null in this case
    const eNewVaultBalance = initialVaultBalance.sub(eInsuranceFee);

    // The last digit doesn't match by 1 unit for shorts...
    // Why? Solidity Math library adds one wei (see: https://github.com/paulrberg/prb-math/blob/da6400015454d52b90ec6fe97ffab3c98df4fefc/contracts/PRBMath.sol#L483)
    expect(eNewVaultBalance).to.closeTo(vaultBalanceAfterPositionOpened, 1);
  }

  it('Should open LONG position', async () => {
    // set-up (needed for `getExpectedVBaseAmount` to work)
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));
    await alice.clearingHouse.deposit(0, depositAmountUSDC, alice.usdc.address);

    const expectedVBase = await alice.clearingHouse.getExpectedVBaseAmount(
      0,
      depositAmount
    );
    const minVBaseAmount = rMul(expectedVBase, ethers.utils.parseEther('0.99'));

    // slippage is significant as Alice exchanges 10% of the liquidity of the pool
    const expectedVBaseBought = '44037297825551398848';
    await _openAndCheckPosition(Side.Long, expectedVBaseBought, minVBaseAmount);
  });

  it('Should open SHORT position', async () => {
    // set-up (needed for `getExpectedVQuoteAmount` to work)
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));
    await alice.clearingHouse.deposit(0, depositAmountUSDC, alice.usdc.address);

    const expectedVQuote = await alice.clearingHouse.getExpectedVQuoteAmount(
      0,
      depositAmount
    );
    const minVQuoteAmount = rMul(
      expectedVQuote,
      ethers.utils.parseEther('0.99')
    );

    // slippage is significant as Alice exchanges 10% of the liquidity of the pool
    const expectedVQuoteBought = '56710621484294309998';
    await _openAndCheckPosition(
      Side.Short,
      expectedVQuoteBought,
      minVQuoteAmount
    );
  });

  it('Should work if trader opens position after having closed one', async () => {
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));
    await alice.clearingHouse.extendPositionWithCollateral(
      0,
      depositAmountUSDC,
      alice.usdc.address,
      depositAmount,
      Side.Long,
      0
    );

    const alicePositionSize = (
      await alice.perpetual.getTraderPosition(alice.address)
    ).positionSize;

    await alice.clearingHouse.reducePosition(
      0,
      FULL_REDUCTION_RATIO,
      alicePositionSize,
      0
    );

    // expected values
    const nextBlockTimestamp = await setNextBlockTimestamp(env);
    await expect(
      alice.clearingHouse.extendPosition(0, depositAmount, Side.Long, 0)
    )
      .to.emit(alice.clearingHouse, 'ExtendPosition')
      .withArgs(
        0,
        alice.address,
        nextBlockTimestamp,
        Side.Long,
        depositAmount.mul(-1),
        '44037296890978559349' // very brittle
      );
  });

  it('Should deposit collateral & open position then close position & withdraw collateral', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));

    // deposit collateral & open position
    await alice.clearingHouse.extendPositionWithCollateral(
      0,
      depositAmountUSDC,
      alice.usdc.address,
      depositAmount,
      Side.Long,
      0
    );

    const alicePosition = await alice.clearingHouse.getTraderPosition(
      0,
      alice.address
    );

    const eInsuranceFee = rMul(alicePosition.openNotional.abs(), INSURANCE_FEE);
    const eCollateralAmount = depositAmount.sub(eInsuranceFee);

    const alicePositionCollateralAfterPositionOpened =
      await alice.vault.getTraderReserveValue(0, alice.address);

    expect(alicePositionCollateralAfterPositionOpened).to.eq(eCollateralAmount);

    // close position & withdraw collateral
    const alicePositionSize = (
      await alice.perpetual.getTraderPosition(alice.address)
    ).positionSize;

    await alice.clearingHouse.closePositionWithdrawCollateral(
      0,
      alicePositionSize,
      0,
      alice.usdc.address
    );

    const alicePositionCollateralAfterPositionClosed =
      await alice.vault.getTraderReserveValue(0, alice.address);

    expect(alicePositionCollateralAfterPositionClosed).to.eq(0);
  });

  async function _openPositionThenIncreasePositionWithinMarginRequirement(
    direction: Side
  ) {
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));

    const traderPositionBeforeFirstTrade =
      await alice.clearingHouse.getTraderPosition(0, alice.address);

    expect(traderPositionBeforeFirstTrade.openNotional).to.eq(0);
    expect(traderPositionBeforeFirstTrade.positionSize).to.eq(0);
    expect(traderPositionBeforeFirstTrade.cumFundingRate).to.eq(0);
    expect(traderPositionBeforeFirstTrade.liquidityBalance).to.eq(0);

    // position is 10% of the collateral
    await alice.clearingHouse.extendPositionWithCollateral(
      0,
      depositAmountUSDC,
      alice.usdc.address,
      depositAmount.div(10),
      direction,
      0
    );

    // CHECK TRADER POSITION
    const traderPositionAfterFirstTrade =
      await alice.clearingHouse.getTraderPosition(0, alice.address);

    if (direction === Side.Long) {
      expect(traderPositionAfterFirstTrade.positionSize).to.gt(0);
      expect(traderPositionAfterFirstTrade.openNotional).to.eq(
        depositAmount.div(10).mul(-1)
      );
    } else {
      expect(traderPositionAfterFirstTrade.openNotional).to.gt(0);
      expect(traderPositionAfterFirstTrade.positionSize).to.lt(0);
    }
    expect(traderPositionAfterFirstTrade.cumFundingRate).to.eq(0);

    const vaultBalanceAfterFirstTrade = await alice.vault.getTraderBalance(
      0,
      alice.address
    );

    // change the value of global.cumFundingRate to force a funding rate payment when extending the position
    const anteriorTimestamp = (await getLatestTimestamp(env)) - 15;
    let newCumFundingRate;
    if (direction === Side.Long) {
      newCumFundingRate = ethers.utils.parseEther('0.1'); // set very large positive cumFundingRate so that LONG position is impacted negatively
    } else {
      newCumFundingRate = ethers.utils.parseEther('0.1').mul(-1); // set very large negative cumFundingRate so that SHORT position is impacted negatively
    }

    await alice.perpetual.__TestPerpetual_setGlobalPosition(
      anteriorTimestamp,
      newCumFundingRate
    );

    // total position is 20% of the collateral
    await alice.clearingHouse.extendPosition(
      0,
      depositAmount.div(10),
      direction,
      0
    );

    // CHECK TRADER POSITION
    const traderPositionAfterSecondTrade =
      await alice.clearingHouse.getTraderPosition(0, alice.address);

    if (direction === Side.Long) {
      expect(traderPositionAfterSecondTrade.positionSize).to.gt(
        traderPositionAfterFirstTrade.positionSize
      );
      expect(traderPositionAfterSecondTrade.openNotional).to.eq(
        traderPositionAfterFirstTrade.openNotional.mul(2)
      );
    } else {
      expect(traderPositionAfterSecondTrade.positionSize).to.lt(
        traderPositionAfterFirstTrade.positionSize
      );
      expect(traderPositionAfterSecondTrade.openNotional).to.gt(
        traderPositionAfterFirstTrade.openNotional
      );
    }

    const vaultBalanceAfterSecondTrade = await alice.vault.getTraderBalance(
      0,
      alice.address
    );

    // expected vault after expansion of position

    let eUpcomingFundingRate;
    if (direction === Side.Long) {
      eUpcomingFundingRate = traderPositionAfterFirstTrade.cumFundingRate.sub(
        (await alice.perpetual.getGlobalPosition()).cumFundingRate
      );
    } else {
      eUpcomingFundingRate = (
        await alice.perpetual.getGlobalPosition()
      ).cumFundingRate.sub(traderPositionAfterFirstTrade.cumFundingRate);
    }
    const eFundingPayment = rMul(
      eUpcomingFundingRate,
      traderPositionAfterFirstTrade.positionSize.abs()
    );

    const addedOpenNotional = traderPositionAfterSecondTrade.openNotional
      .abs()
      .sub(traderPositionAfterFirstTrade.openNotional.abs());
    const eInsuranceFee = rMul(addedOpenNotional, INSURANCE_FEE);
    // note: fundingRate is null in this case
    const eNewVaultBalance = vaultBalanceAfterFirstTrade
      .add(eFundingPayment)
      .sub(eInsuranceFee);

    // The last digit doesn't match by 1 unit for shorts...
    // Why? Solidity Math library adds one wei (see: https://github.com/paulrberg/prb-math/blob/da6400015454d52b90ec6fe97ffab3c98df4fefc/contracts/PRBMath.sol#L483)
    expect(eNewVaultBalance).to.closeTo(vaultBalanceAfterSecondTrade, 1);
    expect(vaultBalanceAfterSecondTrade).to.lt(vaultBalanceAfterFirstTrade);

    if (direction === Side.Long) {
      await alice.clearingHouse.reducePosition(
        0,
        FULL_REDUCTION_RATIO,
        traderPositionAfterSecondTrade.positionSize,
        0
      );
    } else {
      // the amount passed to `reducePosition` is arbitrary,
      // though large enough to be able to buy the same of amount of vBase short

      const vQuoteAmountToBuyBackVBasePosition =
        traderPositionAfterSecondTrade.openNotional.add(
          traderPositionAfterSecondTrade.openNotional.div(4)
        );
      // const vQuoteAmountToBuyBackVBasePosition =
      //   await deriveCloseProposedAmount(
      //     traderPositionAfterSecondTrade,
      //     alice.market
      //   );

      await alice.clearingHouse.reducePosition(
        0,
        FULL_REDUCTION_RATIO,
        vQuoteAmountToBuyBackVBasePosition,
        0
      );
    }

    // CHECK TRADER POSITION
    const traderPositionAfterClosingPosition =
      await alice.clearingHouse.getTraderPosition(0, alice.address);

    expect(traderPositionAfterClosingPosition.openNotional).to.eq(0);
    expect(traderPositionAfterClosingPosition.positionSize).to.eq(0);
    expect(traderPositionAfterClosingPosition.cumFundingRate).to.eq(0);
    expect(traderPositionAfterClosingPosition.liquidityBalance).to.eq(0);
  }

  it('Should increase LONG position size if user tries to and his collateral is sufficient', async () => {
    await _openPositionThenIncreasePositionWithinMarginRequirement(Side.Long);
  });

  it('Should increase SHORT position size if user tries to and his collateral is sufficient', async () => {
    await _openPositionThenIncreasePositionWithinMarginRequirement(Side.Short);
  });

  async function _createPositionAndIncreaseItOutsideOfMargin(direction: Side) {
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));
    await setUpPoolLiquidity(lp, depositAmountUSDC.mul(200));
    await setUpPoolLiquidity(lpTwo, depositAmountUSDC.mul(200));
    await setUpPoolLiquidity(deployer, depositAmountUSDC.mul(200));

    // position is within the margin ratio
    await alice.clearingHouse.extendPositionWithCollateral(
      0,
      depositAmountUSDC,
      alice.usdc.address,
      depositAmount,
      direction,
      0
    );

    // new position is outside the margin ratio
    await expect(
      alice.clearingHouse.extendPosition(0, depositAmount.mul(20), direction, 0)
    ).to.be.revertedWith('Not enough margin');
  }

  it('Should fail to increase LONG position size if user collateral is insufficient', async () => {
    await _createPositionAndIncreaseItOutsideOfMargin(Side.Long);
  });

  it('Should fail to increase SHORT position size if user collateral is insufficient', async () => {
    await _createPositionAndIncreaseItOutsideOfMargin(Side.Short);
  });

  async function _createPositionThenCreateOneInTheOppositeDirection(
    directionFirstPosition: Side,
    directionSecondPosition: Side
  ) {
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));

    // create LONG position
    await alice.clearingHouse.extendPositionWithCollateral(
      0,
      depositAmountUSDC,
      alice.usdc.address,
      depositAmount,
      directionFirstPosition,
      0
    );

    let expectedErrorMessage;
    if (directionSecondPosition) {
      expectedErrorMessage =
        'Cannot reduce/close a LONG position by opening a SHORT position';
    } else {
      expectedErrorMessage =
        'Cannot reduce/close a SHORT position by opening a LONG position';
    }

    // try to reduce (or close) LONG position by opening a SHORT position of a symetric size
    await expect(
      alice.clearingHouse.extendPosition(
        0,
        depositAmount,
        directionSecondPosition,
        0
      )
    ).to.be.revertedWith(expectedErrorMessage);
  }

  it('Should fail if trader tries to reduce/close a LONG position by opening a SHORT one (to skip paying funding rates)', async () => {
    await _createPositionThenCreateOneInTheOppositeDirection(
      Side.Long,
      Side.Short
    );
  });

  it('Should fail if trader tries to reduce/close a SHORT position by opening a LONG one (to skip paying funding rates)', async () => {
    await _createPositionThenCreateOneInTheOppositeDirection(
      Side.Short,
      Side.Long
    );
  });

  it('Should fail to close position if callee has no opened position at the moment', async () => {
    await expect(
      alice.clearingHouse.reducePosition(
        0,
        FULL_REDUCTION_RATIO,
        ethers.utils.parseEther('1'),
        0
      )
    ).to.be.revertedWith('No position currently opened in this market');
  });

  it('Should fail to close position if proposedAmount is null', async () => {
    await expect(
      alice.clearingHouse.reducePosition(0, FULL_REDUCTION_RATIO, 0, 0)
    ).to.be.revertedWith("The proposed amount can't be null");
  });

  it('LONG positions entirely closed should return the expected profit (no funding payments involved in the profit)', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));
    await alice.clearingHouse.deposit(0, depositAmountUSDC, alice.usdc.address);
    const initialVaultBalance = await alice.vault.getTraderBalance(
      0,
      alice.address
    );

    const vQuoteLiquidityBeforePositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );

    await alice.clearingHouse.extendPosition(
      0,
      depositAmount.div(10),
      Side.Long,
      0
    );

    const vQuoteLiquidityAfterPositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );
    const alicePositionBeforeClosingPosition =
      await alice.perpetual.getTraderPosition(alice.address);
    const expectedAdditionalVQuote = vQuoteLiquidityBeforePositionCreated.add(
      alicePositionBeforeClosingPosition.openNotional.mul(-1)
    );

    expect(vQuoteLiquidityAfterPositionCreated).to.equal(
      expectedAdditionalVQuote
    );

    // sell the entire position, i.e. user.positionSize
    await alice.clearingHouse.reducePosition(
      0,
      FULL_REDUCTION_RATIO,
      alicePositionBeforeClosingPosition.positionSize,
      0
    );
    const vQuoteLiquidityAfterPositionClosed = await alice.market.balances(
      VQUOTE_INDEX
    );

    const vQuoteReceived = vQuoteLiquidityAfterPositionCreated.sub(
      vQuoteLiquidityAfterPositionClosed
    );

    const expectedProfit = vQuoteReceived.add(
      alicePositionBeforeClosingPosition.openNotional
    );
    const insurancePayed = rMul(
      alicePositionBeforeClosingPosition.openNotional.abs(),
      INSURANCE_FEE
    );

    const expectedNewVaultBalance = initialVaultBalance
      .add(expectedProfit)
      .sub(insurancePayed);

    const aliceVaultBalanceAfterClosingPosition =
      await alice.vault.getTraderBalance(0, alice.address);

    expect(expectedNewVaultBalance).to.equal(
      aliceVaultBalanceAfterClosingPosition
    );

    const alicePositionAfterClosingPosition =
      await alice.perpetual.getTraderPosition(alice.address);

    // when a position is entirely close, it's deleted
    expect(alicePositionAfterClosingPosition.positionSize).to.eq(0);
    expect(alicePositionAfterClosingPosition.openNotional).to.eq(0);
    expect(alicePositionAfterClosingPosition.cumFundingRate).to.eq(0);
  });

  it('SHORT positions entirely closed should return the expected profit (no funding payments involved in the profit)', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));
    await alice.clearingHouse.deposit(0, depositAmountUSDC, alice.usdc.address);
    const initialVaultBalance = await alice.vault.getTraderBalance(
      0,
      alice.address
    );

    const vQuoteLiquidityBeforePositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );

    await alice.clearingHouse.extendPosition(
      0,
      depositAmount.div(10),
      Side.Short,
      0
    );

    const vQuoteLiquidityAfterPositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );
    const aliceUserPosition = await alice.perpetual.getTraderPosition(
      alice.address
    );
    const aliceOpenNotional = aliceUserPosition.openNotional;
    const expectedVQuoteLiquidityAfterPositionOpened =
      vQuoteLiquidityBeforePositionCreated.sub(aliceOpenNotional);

    expect(vQuoteLiquidityAfterPositionCreated).to.equal(
      expectedVQuoteLiquidityAfterPositionOpened
    );

    // the amount passed to `reducePosition` is arbitrary,
    // though large enough to be able to buy the same of amount of vBase short
    const vQuoteAmountToBuyBackVBasePosition = aliceOpenNotional.add(
      aliceOpenNotional.div(4)
    );
    await alice.clearingHouse.reducePosition(
      0,
      FULL_REDUCTION_RATIO,
      vQuoteAmountToBuyBackVBasePosition,
      0
    );

    const vQuoteLiquidityAfterPositionClosed = await alice.market.balances(
      VQUOTE_INDEX
    );

    const vQuoteReceived = vQuoteLiquidityAfterPositionCreated.sub(
      vQuoteLiquidityAfterPositionClosed
    );

    const expectedProfit = vQuoteReceived.add(aliceOpenNotional);
    const insurancePayed = rMul(aliceOpenNotional.abs(), INSURANCE_FEE);

    const expectedNewVaultBalance = initialVaultBalance
      .add(expectedProfit)
      .sub(insurancePayed);

    const newVaultBalance = await alice.vault.getTraderBalance(
      0,
      alice.address
    );

    expect(expectedNewVaultBalance).to.equal(newVaultBalance);

    const alicePositionAfterClosingPosition =
      await alice.perpetual.getTraderPosition(alice.address);

    // when a position is entirely close, it's deleted
    expect(alicePositionAfterClosingPosition.positionSize).to.eq(0);
    expect(alicePositionAfterClosingPosition.openNotional).to.eq(0);
    expect(alicePositionAfterClosingPosition.cumFundingRate).to.eq(0);
  });

  async function _reducePosition(direction: Side, reductionRatio: number) {
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));

    const traderPositionBeforeFirstTrade =
      await alice.clearingHouse.getTraderPosition(0, alice.address);

    expect(traderPositionBeforeFirstTrade.openNotional).to.eq(0);
    expect(traderPositionBeforeFirstTrade.positionSize).to.eq(0);
    expect(traderPositionBeforeFirstTrade.cumFundingRate).to.eq(0);
    expect(traderPositionBeforeFirstTrade.liquidityBalance).to.eq(0);

    // position is 10% of the collateral
    const alicePosition = depositAmount.div(10);
    await alice.clearingHouse.extendPositionWithCollateral(
      0,
      depositAmountUSDC,
      alice.usdc.address,
      alicePosition,
      direction,
      0
    );

    // CHECK TRADER POSITION
    const traderPositionAfterFirstTrade =
      await alice.clearingHouse.getTraderPosition(0, alice.address);

    if (direction === Side.Long) {
      expect(traderPositionAfterFirstTrade.positionSize).to.gt(0);
      expect(traderPositionAfterFirstTrade.openNotional).to.eq(
        depositAmount.div(10).mul(-1)
      );
    } else {
      expect(traderPositionAfterFirstTrade.openNotional).to.gt(0);
      expect(traderPositionAfterFirstTrade.positionSize).to.lt(0);
    }
    expect(traderPositionAfterFirstTrade.cumFundingRate).to.eq(0);

    if (direction === Side.Long) {
      // reduce position by half
      await alice.clearingHouse.reducePosition(
        0,
        FULL_REDUCTION_RATIO.div(reductionRatio),
        traderPositionAfterFirstTrade.positionSize.div(reductionRatio),
        0
      );
    } else {
      // the amount passed to `reducePosition` is arbitrary,
      // though large enough to be able to buy the same of amount of vBase short
      const vQuoteAmountToRemove = traderPositionAfterFirstTrade.openNotional
        .div(reductionRatio)
        .add(
          traderPositionAfterFirstTrade.openNotional.div(reductionRatio).div(4)
        );

      await alice.clearingHouse.reducePosition(
        0,
        FULL_REDUCTION_RATIO.div(reductionRatio),
        vQuoteAmountToRemove,
        0
      );
    }

    // CHECK TRADER POSITION
    const traderPositionAfterSecondTrade =
      await alice.clearingHouse.getTraderPosition(0, alice.address);

    if (direction === Side.Long) {
      expect(traderPositionAfterSecondTrade.positionSize).to.lt(
        traderPositionAfterFirstTrade.positionSize
      );
      expect(traderPositionAfterSecondTrade.openNotional).to.gt(
        traderPositionAfterFirstTrade.openNotional
      );
    } else {
      expect(traderPositionAfterSecondTrade.positionSize).to.gt(
        traderPositionAfterFirstTrade.positionSize
      );
      expect(traderPositionAfterSecondTrade.openNotional).to.lt(
        traderPositionAfterFirstTrade.openNotional
      );
    }
    expect(traderPositionAfterSecondTrade.cumFundingRate).to.eq(0);

    if (direction === Side.Long) {
      await alice.clearingHouse.reducePosition(
        0,
        FULL_REDUCTION_RATIO,
        traderPositionAfterSecondTrade.positionSize,
        0
      );
    } else {
      // the amount passed to `reducePosition` is arbitrary,
      // though large enough to be able to buy the same of amount of vBase short
      const vQuoteAmountToBuyBackVBasePosition =
        traderPositionAfterSecondTrade.openNotional.add(
          traderPositionAfterSecondTrade.openNotional.div(4)
        );

      await alice.clearingHouse.reducePosition(
        0,
        FULL_REDUCTION_RATIO,
        vQuoteAmountToBuyBackVBasePosition,
        0
      );
    }

    // CHECK TRADER POSITION
    const traderPositionAfterClosingPosition =
      await alice.clearingHouse.getTraderPosition(0, alice.address);

    expect(traderPositionAfterClosingPosition.openNotional).to.eq(0);
    expect(traderPositionAfterClosingPosition.positionSize).to.eq(0);
    expect(traderPositionAfterClosingPosition.cumFundingRate).to.eq(0);
    expect(traderPositionAfterClosingPosition.liquidityBalance).to.eq(0);
  }

  it('Should reduce LONG position size by 50% if user tries to', async () => {
    await _reducePosition(Side.Long, 2);
  });

  it('Should reduce LONG position size by 20% if user tries to', async () => {
    await _reducePosition(Side.Long, 5);
  });

  it('Should reduce SHORT position size by 50% if user tries to', async () => {
    await _reducePosition(Side.Short, 2);
  });

  it('Should reduce SHORT position size by 20% if user tries to', async () => {
    await _reducePosition(Side.Short, 5);
  });

  it('Should fail if the price impact is too big', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));

    await alice.usdc.approve(alice.vault.address, depositAmountUSDC.mul(200));
    await expect(
      alice.clearingHouse.extendPositionWithCollateral(
        0,
        depositAmountUSDC.mul(200),
        alice.usdc.address,
        depositAmount.mul(1000),
        Side.Long,
        0
      )
    ).to.be.revertedWith('Price impact too large');
  });

  //TODO: add tests to assert the impact of the funding rate on the profit
});

// TEST CHECKING EXCHANGE RATES KEPT FOR REFERENCE
//
// it('No exchange rate applied for SHORT positions', async () => {
//   // set-up
//   await setUpPoolLiquidity(bob, depositAmountUSDC.mul(200));
//   await alice.clearingHouse.deposit(0,depositAmountUSDC, alice.usdc.address);

//   const vBaseLiquidityBeforePositionCreated = await alice.market.balances(
//     VBASE_INDEX
//   );

//   await alice.clearingHouse.extendPosition(0,depositAmount.div(10), Side.Short);

//   const vBaseLiquidityAfterPositionCreated = await alice.market.balances(
//     VBASE_INDEX
//   );
//   const alicePositionNotional = (
//     await alice.perpetual.getTraderPosition(alice.address)
//   ).openNotional;

//   // verify that EUR_USD exchange rate is applied to positionNotionalAmount
//   // vBaseLiquidityAfterPositionCreated = vBaseLiquidityBeforePositionCreated - rDiv(positionNotionalAmount, EUR_USD)

//   const positionNotionalAmount = await tokenToWad(
//     await alice.vault.getReserveTokenDecimals(),
//     depositAmountUSDC
//   );
//   // const alicePositionInEuro = rDiv(positionNotionalAmount, EUR_USD);
//   // const expectedVBaseLiquidityAfterPositionCreated =
//   //   vBaseLiquidityBeforePositionCreated.add(alicePositionInEuro);

//   // expect(vBaseLiquidityAfterPositionCreated).to.equal(
//   //   expectedVBaseLiquidityAfterPositionCreated
//   // );

//   await alice.clearingHouse.reducePosition(0,
//     (
//       await alice.perpetual.getTraderPosition(alice.address)
//     ).positionSize
//   );

//   const vBaseLiquidityAfterPositionClosed = await alice.market.balances(
//     VBASE_INDEX
//   );

//   // // expectedVBaseReceived = rMul((user.profit + user.openNotional), EUR_USD)
//   // const alicePositionProfit = (
//   //   await alice.perpetual.getTraderPosition(alice.address)
//   // ).profit;
//   // const expectedVQuoteProceeds = alicePositionProfit.add(
//   //   alicePositionNotional
//   // );
//   // const expectedVBaseReceived = rDiv(expectedVQuoteProceeds, EUR_USD);

//   // // expectedVBaseReceived = vBaseLiquidityAfterPositionCreated - vBaseLiquidityAfterPositionClosed
//   // const vBaseLiquidityDiff = vBaseLiquidityAfterPositionCreated.sub(
//   //   vBaseLiquidityAfterPositionClosed
//   // );

//   // // there's a difference of 1 wei between the 2 values
//   // // vBaseLiquidityDiff: 8796304059175223295
//   // // expectedVBaseReceived: 8796304059175223294
//   // // probably a rounding error in `rDiv`
// });
//   // expect(vBaseLiquidityDiff).to.be.closeTo(expectedVBaseReceived, 1);
