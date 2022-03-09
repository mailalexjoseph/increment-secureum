import {expect} from 'chai';
import {clear} from 'console';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {provideLiquidity} from '../helpers/PerpetualUtils';
import {funding, setup, User} from '../helpers/setup';
import {asBigNumber} from '../helpers/utils/calculations';

const newPerpAddress = '0x494E435245000000000000000000000000000000';

describe('Increment Protocol: Governance', function () {
  let deployer: User;
  let user: User;
  let lp: User;

  beforeEach('Set up', async () => {
    ({user, deployer, lp} = await setup());
  });

  describe('IncreOwnable', function () {
    it('Can transfer ownership directly ', async function () {
      await expect(deployer.clearingHouse.transferOwner(user.address, true))
        .to.emit(user.clearingHouse, 'TransferOwner')
        .withArgs(deployer.address, user.address);

      expect(await user.clearingHouse.owner()).to.eq(user.address);
    });

    it('Can transfer ownership with claim process ', async function () {
      await expect(deployer.clearingHouse.transferOwner(user.address, false))
        .to.emit(user.clearingHouse, 'TransferOwnerClaim')
        .withArgs(deployer.address, user.address);

      await expect(user.clearingHouse.claimOwner())
        .to.emit(user.clearingHouse, 'TransferOwner')
        .withArgs(deployer.address, user.address);
    });
  });

  describe('Allowlist markets', function () {
    it('User should not be able to allowlist market ', async function () {
      await expect(
        user.clearingHouse.allowListPerpetual(newPerpAddress)
      ).to.be.revertedWith('NOT_OWNER');
    });

    it('Deployer should be able to allowlist market ', async function () {
      const numMarkets = await user.clearingHouse.getNumMarkets();

      await expect(deployer.clearingHouse.allowListPerpetual(newPerpAddress))
        .to.emit(deployer.clearingHouse, 'MarketAdded')
        .withArgs(newPerpAddress, numMarkets.add(1));

      expect(await deployer.clearingHouse.getNumMarkets()).to.eq(
        numMarkets.add(1)
      );
      expect(await deployer.clearingHouse.perpetuals(1)).to.eq(newPerpAddress);
    });
  });
  describe('Pause markets', async function () {
    it('User should not be able to pause ', async function () {
      await expect(user.clearingHouse.pause()).to.be.revertedWith('NOT_OWNER');
    });

    it('Deployer should be able to pause ', async function () {
      await expect(deployer.clearingHouse.pause())
        .to.emit(deployer.clearingHouse, 'Paused')
        .withArgs(deployer.address);
    });

    it('User should not be able to unpause ', async function () {
      await expect(deployer.clearingHouse.pause());

      await expect(user.clearingHouse.unpause()).to.be.revertedWith(
        'NOT_OWNER'
      );
    });

    it('Deployer should able to unpause ', async function () {
      await expect(deployer.clearingHouse.pause());

      await expect(deployer.clearingHouse.unpause())
        .to.emit(deployer.clearingHouse, 'Unpaused')
        .withArgs(deployer.address);
    });

    it('No deposit/withdrawal/trading/liquidity/liquidation possible when paused ', async function () {
      await expect(deployer.clearingHouse.pause());

      await expect(
        user.clearingHouse.deposit(0, 1, user.usdc.address)
      ).to.be.revertedWith('Pausable: paused');
      await expect(
        user.clearingHouse.withdraw(0, 1, user.usdc.address)
      ).to.be.revertedWith('Pausable: paused');

      await expect(
        user.clearingHouse.extendPosition(0, 1, 1, 0)
      ).to.be.revertedWith('Pausable: paused');
      await expect(
        user.clearingHouse.extendPositionWithCollateral(
          0,
          1,
          user.usdc.address,
          0,
          0,
          1
        )
      ).to.be.revertedWith('Pausable: paused');
      await expect(
        user.clearingHouse.reducePosition(0, 1, 1)
      ).to.be.revertedWith('Pausable: paused');

      await expect(
        user.clearingHouse.provideLiquidity(0, 1, user.usdc.address)
      ).to.be.revertedWith('Pausable: paused');
      await expect(user.clearingHouse.removeLiquidity(0, 1)).to.be.revertedWith(
        'Pausable: paused'
      );
      await expect(
        user.clearingHouse.settleAndWithdrawLiquidity(
          0,
          1,
          0,
          user.usdc.address
        )
      ).to.be.revertedWith('Pausable: paused');

      await expect(
        user.clearingHouse.liquidate(0, user.address, 1)
      ).to.be.revertedWith('Pausable: paused');
    });
  });
  describe('Usage limits', function () {
    it('Can not set maxTVL to 0', async function () {
      await expect(deployer.vault.setMaxTVL(0)).to.be.revertedWith(
        'MaxTVL must be greater than 0'
      );
    });

    it('Can set maxTVL ', async function () {
      const newMaxTVL = asBigNumber('100');
      await expect(deployer.vault.setMaxTVL(newMaxTVL))
        .to.emit(user.vault, 'MaxTVLChanged')
        .withArgs(newMaxTVL);
    });
  });

  describe('Dust', function () {
    it('Owner can withdraw dust', async function () {
      // provide initial liquidity
      const liquidityAmountUSDC = await funding();
      const liquidityAmount = await tokenToWad(
        await lp.usdc.decimals(),
        liquidityAmountUSDC
      );
      await provideLiquidity(lp, lp.usdc, liquidityAmount);

      // generate some dust
      const dustAmount = liquidityAmount.div(20);
      await user.perpetual.__TestPerpetual_setTraderPosition(
        user.clearingHouse.address,
        0,
        dustAmount,
        (
          await lp.perpetual.getGlobalPosition()
        ).cumFundingRate
      );
      expect(await user.perpetual.getBaseDust()).to.eq(dustAmount);

      // withdraw dust
      await deployer.clearingHouse.sellDust(0, dustAmount, 0);

      expect(
        await deployer.vault.getBalance(0, deployer.clearingHouse.address)
      ).to.gt(0);
    });
  });
});
