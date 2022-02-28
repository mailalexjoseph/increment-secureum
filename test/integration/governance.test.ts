import {expect} from 'chai';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {setup, funding, User} from '../helpers/setup';
import {BigNumber} from 'ethers';

const newPerpAddress = '0x494E435245000000000000000000000000000000';

describe('Increment Protocol: Governance', function () {
  let deployer: User;
  let user: User;

  beforeEach('Set up', async () => {
    ({user, deployer} = await setup());
  });

  describe('Allowlist markets', function () {
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
        user.clearingHouse.openPosition(0, 1, 1, 0)
      ).to.be.revertedWith('Pausable: paused');
      await expect(
        user.clearingHouse.createPositionWithCollateral(
          0,
          1,
          user.usdc.address,
          0,
          0,
          1
        )
      ).to.be.revertedWith('Pausable: paused');
      await expect(
        user.clearingHouse.closePosition(0, 1, 1)
      ).to.be.revertedWith('Pausable: paused');

      await expect(
        user.clearingHouse.provideLiquidity(0, 1, user.usdc.address)
      ).to.be.revertedWith('Pausable: paused');
      await expect(user.clearingHouse.removeLiquidity(0, 1)).to.be.revertedWith(
        'Pausable: paused'
      );
      await expect(
        user.clearingHouse.settleAndWithdrawLiquidity(0, 1, user.usdc.address)
      ).to.be.revertedWith('Pausable: paused');

      await expect(
        user.clearingHouse.liquidate(0, user.address, 1)
      ).to.be.revertedWith('Pausable: paused');
    });
  });
});