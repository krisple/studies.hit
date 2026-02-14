const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer, buyer] = await ethers.getSigners();
  const net = await deployer.provider.getNetwork();
  const chainId = Number(net.chainId);

  const KinyanToken = await ethers.getContractFactory("KinyanToken");
  const initialSupply = ethers.parseUnits("1000000", 18);
  const kny = await KinyanToken.deploy(initialSupply);
  await kny.waitForDeployment();

  const KinyanMarketplace = await ethers.getContractFactory("KinyanMarketplace");
  const marketplace = await KinyanMarketplace.deploy(await kny.getAddress());
  await marketplace.waitForDeployment();

  const SongNFT = await ethers.getContractFactory("SongNFT");
  const songNft = await SongNFT.deploy();
  await songNft.waitForDeployment();

  const txLink = await songNft.setMarketplace(await marketplace.getAddress());
  await txLink.wait();

  const buyerAmount = ethers.parseUnits("10000", 18);
  const txFund = await kny.transfer(buyer.address, buyerAmount);
  await txFund.wait();

  const addresses = {
    chainId,
    kny: await kny.getAddress(),
    marketplace: await marketplace.getAddress(),
    songNft: await songNft.getAddress(),
  };

  const outPath = path.join(__dirname, "..", "frontend", "config", "contracts.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(addresses, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
