const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KinyanMarketplace (generic ERC721 <-> ERC20)", function () {
  async function deployAll() {
    const [seller, buyer, other] = await ethers.getSigners();

    // Deploy NFT (ERC721)
    const SongNFT = await ethers.getContractFactory("SongNFT");
    const nft = await SongNFT.deploy();
    await nft.waitForDeployment();

    // Deploy ERC20 (KNY)
    const KinyanToken = await ethers.getContractFactory("KinyanToken");
    const initialSupply = ethers.parseUnits("1000000", 18);
    const kny = await KinyanToken.deploy(initialSupply);
    await kny.waitForDeployment();

    // Deploy Marketplace (generic)
    const KinyanMarketplace = await ethers.getContractFactory("KinyanMarketplace");
    const market = await KinyanMarketplace.deploy(await kny.getAddress());
    await market.waitForDeployment();

    return { seller, buyer, other, nft, kny, market, initialSupply };
  }

  async function mintOneNFTToSeller(nft, seller, label = "asset #1") {
    const h = ethers.keccak256(ethers.toUtf8Bytes(label));
    await (await nft.connect(seller).registerSong(h, "ipfs://asset")).wait();
    return 1n; // first mint is tokenId 1
  }

  async function fundBuyer(kny, seller, buyer, amount) {
    await (await kny.connect(seller).transfer(buyer.address, amount)).wait();
  }

  describe("list()", function () {
    it("lists successfully when seller owns NFT and approved marketplace", async function () {
      const { seller, nft, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      // approve marketplace for this tokenId
      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();

      const price = ethers.parseUnits("50", 18);

      await expect(market.connect(seller).list(await nft.getAddress(), tokenId, price))
        .to.emit(market, "Listed");

      const offer = await market.offers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(seller.address);
      expect(offer.price).to.equal(price);
    });

    it("reverts if price is 0", async function () {
      const { seller, nft, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);
      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();

      await expect(
        market.connect(seller).list(await nft.getAddress(), tokenId, 0)
      ).to.be.revertedWithCustomError(market, "PriceMustBePositive");
    });

    it("reverts if nft address is zero", async function () {
      const { seller, market } = await deployAll();
      await expect(
        market.connect(seller).list(ethers.ZeroAddress, 1, 1)
      ).to.be.revertedWithCustomError(market, "InvalidNFTAddress");
    });

    it("reverts if caller is not the token owner", async function () {
      const { seller, buyer, nft, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      // seller approves marketplace but buyer tries to list
      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();

      const price = ethers.parseUnits("10", 18);
      await expect(
        market.connect(buyer).list(await nft.getAddress(), tokenId, price)
      ).to.be.revertedWithCustomError(market, "NotTokenOwner");
    });

    it("reverts if marketplace is not approved for the NFT", async function () {
      const { seller, nft, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      const price = ethers.parseUnits("10", 18);

      // no approve => should revert
      await expect(
        market.connect(seller).list(await nft.getAddress(), tokenId, price)
      ).to.be.revertedWithCustomError(market, "NotApprovedForNFT");
    });
  });

  describe("unlist()", function () {
    it("seller can unlist", async function () {
      const { seller, nft, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();
      const price = ethers.parseUnits("5", 18);
      await (await market.connect(seller).list(await nft.getAddress(), tokenId, price)).wait();

      await expect(market.connect(seller).unlist(await nft.getAddress(), tokenId))
        .to.emit(market, "Unlisted");

      const offer = await market.offers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(ethers.ZeroAddress);
      expect(offer.price).to.equal(0n);
    });

    it("reverts if token is not listed", async function () {
      const { seller, nft, market } = await deployAll();
      await expect(
        market.connect(seller).unlist(await nft.getAddress(), 1)
      ).to.be.revertedWithCustomError(market, "NotListed");
    });

    it("reverts if caller is not the seller who listed", async function () {
      const { seller, buyer, nft, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();
      const price = ethers.parseUnits("5", 18);
      await (await market.connect(seller).list(await nft.getAddress(), tokenId, price)).wait();

      await expect(
        market.connect(buyer).unlist(await nft.getAddress(), tokenId)
      ).to.be.revertedWithCustomError(market, "NotTokenOwner");
    });
  });

  describe("updatePrice()", function () {
    it("seller can update price", async function () {
      const { seller, nft, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();
      const price = ethers.parseUnits("5", 18);
      await (await market.connect(seller).list(await nft.getAddress(), tokenId, price)).wait();

      const newPrice = ethers.parseUnits("7", 18);
      await expect(market.connect(seller).updatePrice(await nft.getAddress(), tokenId, newPrice))
        .to.emit(market, "PriceUpdated");

      const offer = await market.offers(await nft.getAddress(), tokenId);
      expect(offer.price).to.equal(newPrice);
    });

    it("reverts if new price is 0", async function () {
      const { seller, nft, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();
      const price = ethers.parseUnits("5", 18);
      await (await market.connect(seller).list(await nft.getAddress(), tokenId, price)).wait();

      await expect(
        market.connect(seller).updatePrice(await nft.getAddress(), tokenId, 0)
      ).to.be.revertedWithCustomError(market, "PriceMustBePositive");
    });

    it("reverts if caller is not seller", async function () {
      const { seller, buyer, nft, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();
      const price = ethers.parseUnits("5", 18);
      await (await market.connect(seller).list(await nft.getAddress(), tokenId, price)).wait();

      const newPrice = ethers.parseUnits("6", 18);
      await expect(
        market.connect(buyer).updatePrice(await nft.getAddress(), tokenId, newPrice)
      ).to.be.revertedWithCustomError(market, "NotTokenOwner");
    });

    it("reverts if not listed", async function () {
      const { seller, nft, market } = await deployAll();
      await expect(
        market.connect(seller).updatePrice(await nft.getAddress(), 1, 1)
      ).to.be.revertedWithCustomError(market, "NotListed");
    });
  });

  describe("buy()", function () {
    it("happy path: buyer pays KNY and receives NFT; listing removed", async function () {
      const { seller, buyer, nft, kny, market, initialSupply } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      // seller approves marketplace for NFT
      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();

      const price = ethers.parseUnits("50", 18);

      // list
      await (await market.connect(seller).list(await nft.getAddress(), tokenId, price)).wait();

      // fund buyer and approve ERC20 spend
      await fundBuyer(kny, seller, buyer, price);
      await (await kny.connect(buyer).approve(await market.getAddress(), price)).wait();

      // balances before
      const sellerBalBefore = await kny.balanceOf(seller.address);
      const buyerBalBefore = await kny.balanceOf(buyer.address);

      // buy
      await expect(market.connect(buyer).buy(await nft.getAddress(), tokenId))
        .to.emit(market, "Purchased");

      // NFT moved
      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);

      // payment moved
      const sellerBalAfter = await kny.balanceOf(seller.address);
      const buyerBalAfter = await kny.balanceOf(buyer.address);

      expect(sellerBalAfter - sellerBalBefore).to.equal(price);
      expect(buyerBalBefore - buyerBalAfter).to.equal(price);

      // listing removed
      const offer = await market.offers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(ethers.ZeroAddress);
      expect(offer.price).to.equal(0n);

      // sanity: seller started with initialSupply, transferred price to buyer, then got it back
      expect(await kny.balanceOf(seller.address)).to.equal(initialSupply);
    });

    it("reverts if not listed", async function () {
      const { buyer, nft, market } = await deployAll();
      await expect(
        market.connect(buyer).buy(await nft.getAddress(), 1)
      ).to.be.revertedWithCustomError(market, "NotListed");
    });

    it("reverts if buyer did not approve ERC20 allowance (payment fails) and listing stays", async function () {
      const { seller, buyer, nft, kny, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();
      const price = ethers.parseUnits("10", 18);
      await (await market.connect(seller).list(await nft.getAddress(), tokenId, price)).wait();

      // buyer has balance but no approve
      await fundBuyer(kny, seller, buyer, price);

      await expect(
        market.connect(buyer).buy(await nft.getAddress(), tokenId)
      ).to.be.reverted; // OpenZeppelin ERC20 reverts on insufficient allowance

      // ensure listing rolled back (still listed)
      const offer = await market.offers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(seller.address);
      expect(offer.price).to.equal(price);
    });

    it("reverts if seller transferred NFT away after listing", async function () {
      const { seller, buyer, other, nft, kny, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();
      const price = ethers.parseUnits("10", 18);
      await (await market.connect(seller).list(await nft.getAddress(), tokenId, price)).wait();

      // seller transfers NFT to someone else after listing
      await (await nft.connect(seller).safeTransferFrom(seller.address, other.address, tokenId)).wait();

      // buyer funds + approves
      await fundBuyer(kny, seller, buyer, price);
      await (await kny.connect(buyer).approve(await market.getAddress(), price)).wait();

      // buy should revert (listing invalid)
      await expect(
        market.connect(buyer).buy(await nft.getAddress(), tokenId)
      ).to.be.revertedWithCustomError(market, "NotTokenOwner");

      // listing should remain due to revert rollback
      const offer = await market.offers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(seller.address);
      expect(offer.price).to.equal(price);
    });

    it("reverts if seller revoked NFT approval after listing", async function () {
      const { seller, buyer, nft, kny, market } = await deployAll();
      const tokenId = await mintOneNFTToSeller(nft, seller);

      await (await nft.connect(seller).approve(await market.getAddress(), tokenId)).wait();
      const price = ethers.parseUnits("10", 18);
      await (await market.connect(seller).list(await nft.getAddress(), tokenId, price)).wait();

      // seller revokes approval
      await (await nft.connect(seller).approve(ethers.ZeroAddress, tokenId)).wait();

      // buyer funds + approves payment
      await fundBuyer(kny, seller, buyer, price);
      await (await kny.connect(buyer).approve(await market.getAddress(), price)).wait();

      await expect(
        market.connect(buyer).buy(await nft.getAddress(), tokenId)
      ).to.be.revertedWithCustomError(market, "NotApprovedForNFT");

      // listing remains due to revert rollback
      const offer = await market.offers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(seller.address);
    });
  });
});
