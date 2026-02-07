const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("SongNFT", function ()
{
  async function deploy()
  {
    const [deployer, alice, bob] = await ethers.getSigners();

    const SongNFT = await ethers.getContractFactory("SongNFT");
    const c = await SongNFT.deploy();
    await c.waitForDeployment();

    return { c, deployer, alice, bob };
  }

  it("deploys with correct name and symbol", async function ()
  {
    const { c } = await deploy();
    expect(await c.name()).to.equal("KinyanSong");
    expect(await c.symbol()).to.equal("KNYSONG");
  });

  it("registerSong mints NFT and stores metadata", async function ()
  {
    const { c, deployer } = await deploy();

    const songHash = ethers.keccak256(ethers.toUtf8Bytes("song one"));
    const uri = "ipfs://song-one";

    await (await c.registerSong(songHash, uri)).wait();

    expect(await c.ownerOf(1)).to.equal(deployer.address);
    expect(await c.getTokenIdBySongHash(songHash)).to.equal(1n);

    expect(await c.originalCreatorByTokenId(1)).to.equal(deployer.address);
    expect(await c.registeredAtByTokenId(1)).to.be.gt(0n);

    expect(await c.tokenURI(1)).to.equal(uri);
  });

  it("prevents duplicate registration and does not advance nextTokenId", async function ()
  {
    const { c } = await deploy();

    const songHash = ethers.keccak256(ethers.toUtf8Bytes("same song"));
    const uri = "ipfs://same";

    await (await c.registerSong(songHash, uri)).wait();
    expect(await c.nextTokenId()).to.equal(2n);

    await expect(c.registerSong(songHash, uri)).to.be.reverted;
    expect(await c.nextTokenId()).to.equal(2n);
  });

  it("reverts on zero hash", async function ()
  {
    const { c } = await deploy();

    const zeroHash =
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    await expect(c.registerSong(zeroHash, "ipfs://bad")).to.be.reverted;
  });

  it("emits SongRegistered with correct fields", async function ()
  {
    const { c, deployer } = await deploy();

    const songHash = ethers.keccak256(ethers.toUtf8Bytes("event song"));
    const uri = "ipfs://event-song";

    await expect(c.registerSong(songHash, uri))
      .to.emit(c, "SongRegistered")
      .withArgs(deployer.address, 1n, songHash, anyValue, uri);
  });

  it("setMarketplace is onlyOwner and one-time", async function ()
  {
    const { c, deployer, alice } = await deploy();

    const m = alice.address;

    await expect(c.connect(alice).setMarketplace(m)).to.be.reverted;

    await expect(c.connect(deployer).setMarketplace(m))
      .to.emit(c, "MarketplaceSet")
      .withArgs(m);

    await expect(c.connect(deployer).setMarketplace(m)).to.be.reverted;
  });

  it("direct transfers revert after marketplace is set", async function ()
  {
    const { c, deployer, alice, bob } = await deploy();

    const songHash = ethers.keccak256(ethers.toUtf8Bytes("t1"));
    await (await c.connect(alice).registerSong(songHash, "ipfs://t1")).wait();

    await (await c.connect(deployer).setMarketplace(bob.address)).wait();

    await expect(
      c.connect(alice).safeTransferFrom(alice.address, bob.address, 1n)
    ).to.be.revertedWithCustomError(c, "TransfersOnlyViaMarketplace");
  });
});
