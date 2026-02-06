const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SongNFT", function () {
  async function deploy() {
    const [deployer, buyer] = await ethers.getSigners();
    const SongNFT = await ethers.getContractFactory("SongNFT");
    const c = await SongNFT.deploy();
    await c.waitForDeployment();
    return { c, deployer, buyer };
  }

  it("deploys with correct name and symbol", async function () {
    const { c } = await deploy();
    expect(await c.name()).to.equal("KinyanSong");
    expect(await c.symbol()).to.equal("KNYSONG");
  });

  it("registerSong mints NFT, stores mappings, and sets tokenURI", async function () {
    const { c, deployer } = await deploy();

    const songHash = ethers.keccak256(ethers.toUtf8Bytes("song one"));
    const uri = "ipfs://song-one";

    const tx = await c.registerSong(songHash, uri);
    await tx.wait();

    // tokenId should be 1
    expect(await c.ownerOf(1)).to.equal(deployer.address);

    // mapping: hash -> tokenId
    expect(await c.getTokenIdBySongHash(songHash)).to.equal(1n);

    // creator + timestamp
    expect(await c.originalCreatorByTokenId(1)).to.equal(deployer.address);
    expect(await c.registeredAtByTokenId(1)).to.be.gt(0n);

    // metadata
    expect(await c.tokenURI(1)).to.equal(uri);
  });

  it("prevents duplicate registration (reverts) and does not advance nextTokenId", async function () {
    const { c } = await deploy();

    const songHash = ethers.keccak256(ethers.toUtf8Bytes("same song"));
    const uri = "ipfs://same";

    // first ok
    await (await c.registerSong(songHash, uri)).wait();
    expect(await c.nextTokenId()).to.equal(2n);

    // second should revert
    await expect(c.registerSong(songHash, uri)).to.be.reverted;

    // ensure rollback: still next token is 2
    expect(await c.nextTokenId()).to.equal(2n);
  });

  it("reverts on zero hash", async function () {
    const { c } = await deploy();

    const zeroHash =
      "0x0000000000000000000000000000000000000000000000000000000000000000";

    await expect(c.registerSong(zeroHash, "ipfs://bad")).to.be.reverted;
  });

  it("emits SongRegistered event with correct fields", async function () {
    const { c, deployer } = await deploy();

    const songHash = ethers.keccak256(ethers.toUtf8Bytes("event song"));
    const uri = "ipfs://event-song";

    await expect(c.registerSong(songHash, uri))
      .to.emit(c, "SongRegistered")
      .withArgs(deployer.address, 1n, songHash, anyValue, uri);
  });
});

// helper for matching any uint (timestamp) in event args
const anyValue = (value) => value !== null;
