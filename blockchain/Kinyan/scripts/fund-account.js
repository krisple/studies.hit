const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

function parseAddressesFromFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];

  // JSON support
  if (raw.startsWith("[") || raw.startsWith("{")) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.addresses)) return parsed.addresses;
    throw new Error("Invalid FUND_FILE JSON. Expected an array or { addresses: [...] }");
  }

  // Plain text support: one address per line (comments allowed with #)
  return raw
    .split(/\r?\n/g)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

async function main() {
  const fundFile = process.env.FUND_FILE;
  const single = process.env.FUND_ADDRESS;

  let recipients = [];
  if (fundFile) {
    recipients = parseAddressesFromFile(fundFile);
  } else if (single) {
    recipients = [single];
  } else {
    const defaultPath = path.join(__dirname, "fund-wallets.json");
    if (fs.existsSync(defaultPath)) {
      recipients = parseAddressesFromFile(defaultPath);
    } else {
      throw new Error("Missing FUND_ADDRESS or FUND_FILE (and no scripts/fund-wallets.json found)");
    }
  }

  recipients = [...new Set(recipients.map((a) => String(a).trim()))].filter(Boolean);
  if (recipients.length === 0) throw new Error("No recipients found");

  const cfgPath = path.join(__dirname, "..", "frontend", "config", "contracts.json");
  const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));

  const [deployer] = await ethers.getSigners();

  // ETH
  const ethAmount = process.env.FUND_ETH || "10";

  // KNY
  const knyAmount = process.env.FUND_KNY || "5000";
  const token = await ethers.getContractAt("KinyanToken", cfg.kny);

  for (const recipient of recipients) {
    if (!ethers.isAddress(recipient)) {
      throw new Error(`Invalid recipient address: ${recipient}`);
    }

    console.log("Funding address:", recipient);

    await deployer.sendTransaction({
      to: recipient,
      value: ethers.parseEther(ethAmount),
    });
    console.log(`  Sent ${ethAmount} ETH`);

    await token.transfer(recipient, ethers.parseUnits(knyAmount, 18));
    console.log(`  Sent ${knyAmount} KNY`);
  }

  console.log("Funding complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
