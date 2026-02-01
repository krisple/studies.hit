const hre = require("hardhat");

async function main() {
  const SongNFT = await hre.ethers.getContractFactory("SongNFT");
  const songNFT = await SongNFT.deploy();

  await songNFT.waitForDeployment();

  const address = await songNFT.getAddress();
  console.log("SongNFT deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
