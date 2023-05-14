/**
 * @title LoanVault
 * @dev This contract allows users to deposit Ether (ETH) and receive stablecoins in return.
 * The amount of stablecoins that can be minted against the collateral is determined by the current ETH/USD exchange rate obtained from an oracle.
 */

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "./MockToken.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LoanVault is Ownable {
    AggregatorV3Interface internal priceFeed;
    mapping(address => Vault) vaults;
    MockToken public stablecoin;

    struct Vault {
        uint256 stablecoinDebt; // The amount of stablecoin that was minted against the collateral
        uint256 collateralAmount; // The amount of collateral held by the vault contract
    }

    event Deposit(uint256 collateralDeposited, uint256 stablecoinMinted);
    event Withdraw(uint256 collateralWithdrawn, uint256 stablecoinBurned);

    constructor(address _oracle, MockToken _stablecoin) {
        stablecoin = _stablecoin;
        priceFeed = AggregatorV3Interface(_oracle);
    }

    /**
     * @dev Retrieves the latest ETH/USD exchange rate from the price feed oracle.
     * @return The latest ETH/USD exchange rate.
     */
    function getEthUsdExchangeRate() public view returns (uint) {
        (, int price, , , ) = priceFeed.latestRoundData();
        return uint(price * 1e10);
    }

    /**
     * @notice Allows a user to deposit ETH collateral in exchange for stablecoins.
     * @param amountToDeposit The amount of Ether the user sent in the transaction.
     */
    function deposit(uint256 amountToDeposit) external payable {
        require(amountToDeposit == msg.value, "Incorrect ETH amount");
        uint256 stablecoinAmountToMint = amountToDeposit *
            getEthUsdExchangeRate();
        stablecoin.mint(msg.sender, stablecoinAmountToMint);
        vaults[msg.sender].stablecoinDebt += stablecoinAmountToMint;
        vaults[msg.sender].collateralAmount += amountToDeposit;
        emit Deposit(amountToDeposit, stablecoinAmountToMint);
    }

    /**
     * @notice Allows a user to withdraw up to 100% of the collateral they have on deposit.
     * @dev This function cannot allow a user to withdraw more than they deposited.
     * @param repaymentAmount The amount of stablecoins that a user is repaying to redeem their collateral.
     */
    function withdraw(uint256 repaymentAmount) external {
        require(
            repaymentAmount <= vaults[msg.sender].stablecoinDebt,
            "Withdraw limit exceeded"
        );
        require(
            stablecoin.balanceOf(msg.sender) >= repaymentAmount,
            "Insufficient tokens in balance"
        );
        uint256 collateralAmountToWithdraw = repaymentAmount /
            getEthUsdExchangeRate();
        stablecoin.burn(msg.sender, repaymentAmount);
        vaults[msg.sender].collateralAmount -= collateralAmountToWithdraw;
        vaults[msg.sender].stablecoinDebt -= repaymentAmount;
        payable(msg.sender).transfer(collateralAmountToWithdraw);
        emit Withdraw(collateralAmountToWithdraw, repaymentAmount);
    }

    /**
     * @notice Retrieves the details of a user's vault.
     * @param userAddress The address of the vault owner.
     * @return The amount of stablecoin debt and collateral held by the user's vault.
     */
    function getVault(
        address userAddress
    ) external view returns (uint256, uint256) {
        return (
            vaults[userAddress].stablecoinDebt,
            vaults[userAddress].collateralAmount
        );
    }

    /**
     * @notice Provides an estimate of how much collateral could be withdrawn for a given amount of stablecoins.
     * @param stablecoinAmount The amount of stablecoins that would be repaid.
     * @return The estimated amount of collateral that would be returned.
     */
    function estimateCollateralAmount(
        uint256 stablecoinAmount
    ) external view returns (uint256) {
        return stablecoinAmount / getEthUsdExchangeRate();
    }

    /**
     * @notice Provides an estimate of how many stablecoins could be minted at the current rate.
     * @param collateralAmount The amount of ETH that would be deposited.
     * @return The estimated amount of stablecoins that would be minted.
     */
    function estimateStablecoinAmount(
        uint256 collateralAmount
    ) external view returns (uint256) {
        return collateralAmount * getEthUsdExchangeRate();
    }

    /**
     * @dev Allows the owner to update the price feed oracle.
     * @param _oracle The address of the new price feed oracle.
     */
    function updatePriceFeed(address _oracle) public onlyOwner {
        priceFeed = AggregatorV3Interface(_oracle);
    }
}
