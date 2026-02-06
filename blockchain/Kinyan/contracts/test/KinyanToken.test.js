const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KinyanToken", function () {
  it("mints initial supply to deployer", async function () {
    const [deployer] = await ethers.getSigners();

    const KinyanToken = await ethers.getContractFactory("KinyanToken");
    const initial = ethers.parseUnits("1000000", 18); // 1,000,000 KNY
    const t = await KinyanToken.deploy(initial);
    await t.waitForDeployment();

    expect(await t.symbol()).to.equal("KNY");
    expect(await t.balanceOf(deployer.address)).to.equal(initial);
  });

  it("owner can mint", async function () {
    const [deployer, alice] = await ethers.getSigners();

    const KinyanToken = await ethers.getContractFactory("KinyanToken");
    const t = await KinyanToken.deploy(0);
    await t.waitForDeployment();

    const amount = ethers.parseUnits("10", 18);
    await t.mint(alice.address, amount);

    expect(await t.balanceOf(alice.address)).to.equal(amount);
  });

  it("non-owner cannot mint", async function () {
    const [, alice] = await ethers.getSigners();

    const KinyanToken = await ethers.getContractFactory("KinyanToken");
    const t = await KinyanToken.deploy(0);
    await t.waitForDeployment();

    await expect(t.connect(alice).mint(alice.address, 1)).to.be.reverted;
  });
});
