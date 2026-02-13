// scripts/deploy-and-export.js
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer, buyer] = await ethers.getSigners();
  const net = await deployer.provider.getNetwork();
  const chainId = Number(net.chainId);

  console.log("Deployer:", deployer.address);
  console.log("Buyer:", buyer.address);
  console.log("ChainId:", chainId);

  // Deploy ERC20 (constructor requires initialSupply)
  const KinyanToken = await ethers.getContractFactory("KinyanToken");
  const initialSupply = ethers.parseUnits("1000000", 18); // 1,000,000 KNY for demo
  const kny = await KinyanToken.deploy(initialSupply);
  await kny.waitForDeployment();

  // Deploy Marketplace (constructor requires token address)
  const KinyanMarketplace = await ethers.getContractFactory("KinyanMarketplace");
  const marketplace = await KinyanMarketplace.deploy(await kny.getAddress());
  await marketplace.waitForDeployment();

  // Deploy SongNFT (no constructor args in your project)
  const SongNFT = await ethers.getContractFactory("SongNFT");
  const songNft = await SongNFT.deploy();
  await songNft.waitForDeployment();

  // Link NFT -> Marketplace (required for restricted transfers)
  const txLink = await songNft.setMarketplace(await marketplace.getAddress());
  await txLink.wait();

  // Fund buyer with KNY so purchase flow works in UI without console steps
  const buyerAmount = ethers.parseUnits("10000", 18); // 10,000 KNY
  const txFund = await kny.transfer(buyer.address, buyerAmount);
  await txFund.wait();

  const addresses = {
    chainId,
    kny: await kny.getAddress(),
    marketplace: await marketplace.getAddress(),
    songNft: await songNft.getAddress(),
  };

  console.log("Deployed:", addresses);

  // Export addresses to frontend
  const outPath = path.join(__dirname, "..", "frontend", "config", "contracts.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
  console.log("Wrote:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
