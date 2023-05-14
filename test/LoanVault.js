const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("LoanVault", function () {
  let loanVault;
  let mockToken;
  let owner;
  let user;

  const ETH_USD_EXCHANGE_RATE = 3000; // Example exchange rate for testing purposes
  const COLLATERAL_AMOUNT = ethers.utils.parseEther("1"); // 1 ETH
  const STABLECOIN_AMOUNT = ethers.BigNumber.from(ETH_USD_EXCHANGE_RATE).mul(
    COLLATERAL_AMOUNT
  );
  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
    const LoanVault = await ethers.getContractFactory("LoanVaultTest");
    loanVault = await LoanVault.deploy(
      "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // Chainlink ETH/USD price feed oracle address
      "MockToken",
      "MTK"
    );
    mockTokenAddress = await loanVault.stablecoin();
    mockToken = await ethers.getContractAt("MockToken", mockTokenAddress);
  });

  describe("deposit()", function () {
    it("should allow a user to deposit ETH collateral and receive stablecoins in return", async function () {
      const tx = await loanVault.connect(user).deposit(COLLATERAL_AMOUNT, {
        value: COLLATERAL_AMOUNT,
      });

      await tx.wait();

      const userStablecoinBalance = await mockToken.balanceOf(user.address);
      expect(userStablecoinBalance.toString()).to.equal(
        STABLECOIN_AMOUNT.toString()
      );
    });

    it("should revert if the user sends an incorrect amount of ETH", async function () {
      await expect(
        loanVault.connect(user).deposit(COLLATERAL_AMOUNT, {
          value: COLLATERAL_AMOUNT.sub(ethers.utils.parseEther("0.01")),
        })
      ).to.be.revertedWith("Incorrect ETH amount");
    });
  });

  describe("withdraw()", function () {
    beforeEach(async function () {
      const tx = await loanVault.connect(user).deposit(COLLATERAL_AMOUNT, {
        value: COLLATERAL_AMOUNT,
      });
      await tx.wait();
    });

    it("should allow a user to withdraw up to 100% of the collateral they have on deposit", async function () {
      const stablecoinAmountToRepay = STABLECOIN_AMOUNT.div(2);
      const tx = await mockToken
        .connect(user)
        .approve(loanVault.address, stablecoinAmountToRepay);
      await tx.wait();

      const userBalanceBefore = await user.getBalance();
      const vaultBalanceBefore = await ethers.provider.getBalance(
        loanVault.address
      );

      const withdrawTx = await loanVault
        .connect(user)
        .withdraw(stablecoinAmountToRepay);
      await withdrawTx.wait();

      const userBalanceAfter = await user.getBalance();
      const vaultBalanceAfter = await ethers.provider.getBalance(
        loanVault.address
      );
      const userStablecoinBalance = await mockToken.balanceOf(user.address);
      const userVault = await loanVault.getVault(user.address);

      expect(vaultBalanceAfter).to.equal(
        vaultBalanceBefore.sub(COLLATERAL_AMOUNT.div(2))
      );
      expect(userStablecoinBalance).to.equal(STABLECOIN_AMOUNT.div(2));
      expect(userVault).to.deep.equal([
        STABLECOIN_AMOUNT.div(2),
        COLLATERAL_AMOUNT.div(2),
      ]);
      expect(userBalanceAfter).to.be.gt(userBalanceBefore);
    });

    it("should revert if the user tries to withdraw more stablecoins than they have on deposit", async function () {
      const stablecoinAmountToRepay = STABLECOIN_AMOUNT.add(
        ethers.utils.parseEther("1")
      );
      await expect(
        loanVault.connect(user).withdraw(stablecoinAmountToRepay)
      ).to.be.revertedWith("Withdraw limit exceeded");
    });

    it("should revert if the user tries to withdraw more collateral than they have on deposit", async function () {
      const stablecoinAmountToRepay = STABLECOIN_AMOUNT.mul(2);
      const tx = await mockToken
        .connect(user)
        .approve(loanVault.address, stablecoinAmountToRepay);
      await tx.wait();

      await expect(
        loanVault.connect(user).withdraw(stablecoinAmountToRepay)
      ).to.be.revertedWith("Withdraw limit exceeded");
    });
  });
});
