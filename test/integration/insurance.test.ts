import env = require('hardhat');
import {expect} from 'chai';
import {BigNumber} from 'ethers';

import {setup, funding, User} from '../helpers/setup';
import {setUpPoolLiquidity} from '../helpers/PerpetualUtils';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {setUSDCBalance} from '../helpers/utils/manipulateStorage';
import {Side} from '../helpers/utils/types';
import {rMul} from '../helpers/utils/calculations';

async function removeTokensAllTokensFromVault(user: User) {
  const previousBalance = await user.usdc.balanceOf(user.vault.address);
  // set USDC balance to zero
  await removeTokensFromVault(user, previousBalance);
}

async function removeTokensFromVault(user: User, amount: BigNumber) {
  const previousBalance = await user.usdc.balanceOf(user.vault.address);
  // set new balance
  await setUSDCBalance(
    env,
    user.usdc,
    user.vault.address,
    previousBalance.sub(amount)
  );
}

async function addTokensToInsurance(user: User, amount: BigNumber) {
  await setUSDCBalance(env, user.usdc, user.insurance.address, amount);
}

async function depositIntoPerpetual(user: User, amount: BigNumber) {
  await user.usdc.approve(user.vault.address, amount);
  await user.perpetual.deposit(amount, user.usdc.address);
}

describe('Increment App: Insurance', function () {
  let user: User;
  let lp: User;
  let trader: User;
  let INSURANCE_FEE: BigNumber;

  let depositAmountUSDC: BigNumber;
  let depositAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({user, lp, trader} = await setup());
    INSURANCE_FEE = await user.perpetual.INSURANCE_FEE();

    depositAmountUSDC = await funding();
    depositAmount = await tokenToWad(
      await user.vault.getReserveTokenDecimals(),
      depositAmountUSDC
    );
  });

  it('Should revert if not enough money in insurance ', async function () {
    // deposit
    await depositIntoPerpetual(user, depositAmountUSDC);

    await removeTokensAllTokensFromVault(user);
    await addTokensToInsurance(user, depositAmountUSDC.sub(1));

    // withdraw
    await expect(
      user.perpetual.withdraw(
        await user.vault.getReserveValue(user.address, user.perpetual.address),
        user.usdc.address
      )
    ).to.be.revertedWith('Insufficient insurance balance');
  });

  it('Should payout insurance when enough', async function () {
    // deposit
    await depositIntoPerpetual(user, depositAmountUSDC);

    await removeTokensAllTokensFromVault(user);
    await addTokensToInsurance(user, depositAmountUSDC);

    // withdraw
    await expect(
      user.perpetual.withdraw(
        await user.vault.getReserveValue(user.address, user.perpetual.address),
        user.usdc.address
      )
    )
      .to.emit(user.insurance, 'DebtSettled')
      .withArgs(user.vault.address, depositAmountUSDC);

    expect(await user.vault.badDebt()).to.be.eq(depositAmountUSDC);
  });

  it('Trader should pay insurance fee when opening a position', async function () {
    // set-up
    await setUpPoolLiquidity(lp, depositAmountUSDC);

    // deposit tokens
    const [tradeAmountUSDC, tradeAmount] = [
      depositAmountUSDC.div(100),
      depositAmount.div(100),
    ]; // 1% of lp is traded

    await depositIntoPerpetual(trader, tradeAmountUSDC);

    const traderReserveDeposited = await trader.vault.getBalance(
      trader.address,
      trader.perpetual.address
    );

    // open position
    await trader.perpetual.openPosition(tradeAmount, Side.Long);

    const traderPosition = await trader.perpetual.getTraderPosition(
      trader.address
    );

    const insurancePayed = rMul(
      traderPosition.openNotional.abs(),
      INSURANCE_FEE
    );

    expect(
      await trader.vault.getBalance(trader.address, trader.perpetual.address)
    ).to.be.eq(traderReserveDeposited.sub(insurancePayed));

    expect(
      await trader.vault.getBalance(
        trader.insurance.address,
        trader.perpetual.address
      )
    ).to.be.eq(insurancePayed);
  });
});
