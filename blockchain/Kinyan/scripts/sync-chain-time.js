const { ethers } = require("hardhat");

async function setNextBlockTimestamp(provider, ts) {
  // Hardhat supports evm_setNextBlockTimestamp; some clients support hardhat_setNextBlockTimestamp.
  try {
    await provider.send("evm_setNextBlockTimestamp", [ts]);
    return;
  } catch (_) {
    // fallthrough
  }
  await provider.send("hardhat_setNextBlockTimestamp", [ts]);
}

async function main() {
  const provider = ethers.provider;

  const latest = await provider.getBlock("latest");
  const latestTs = Number(latest?.timestamp || 0);

  const nowTs = Math.floor(Date.now() / 1000);
  const nextTs = Math.max(nowTs, latestTs + 1);

  await setNextBlockTimestamp(provider, nextTs);
  await provider.send("evm_mine", []);

  const after = await provider.getBlock("latest");
  const afterTs = Number(after?.timestamp || 0);

  console.log(
    `Chain time synced: ${afterTs} (${new Date(afterTs * 1000).toLocaleString()})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

