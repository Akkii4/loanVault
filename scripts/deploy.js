const { ethers } = require("hardhat");

async function main() {
  const LoanVault = await ethers.getContractFactory("LoanVault");
  const loanVault = await LoanVault.deploy(
    "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", // Chainlink ETH/USD price feed oracle address
    "MockToken",
    "MTK"
  );
  const mockTokenAddress = await loanVault.stablecoin();
  console.log("LoanVault deployed to:", loanVault.address);
  console.log("MockToken deployed to:", mockTokenAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
