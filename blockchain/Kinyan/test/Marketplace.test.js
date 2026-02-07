const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("KinyanMarketplace", function ()
{
  async function deployAll()
  {
    const [deployer, creator, seller, buyer, other] = await ethers.getSigners();

    const SongNFT = await ethers.getContractFactory("SongNFT");
    const nft = await SongNFT.deploy();
    await nft.waitForDeployment();

    const KinyanToken = await ethers.getContractFactory("KinyanToken");
    const initialSupply = ethers.parseUnits("1000000", 18);
    const kny = await KinyanToken.deploy(initialSupply);
    await kny.waitForDeployment();

    const KinyanMarketplace = await ethers.getContractFactory("KinyanMarketplace");
    const market = await KinyanMarketplace.deploy(await kny.getAddress());
    await market.waitForDeployment();

    await (await nft.connect(deployer).setMarketplace(await market.getAddress())).wait();

    return { deployer, creator, seller, buyer, other, nft, kny, market, initialSupply };
  }

  async function registerTo(nft, signer, label, uri = "ipfs://asset")
  {
    const h = ethers.keccak256(ethers.toUtf8Bytes(label));
    const tx = await nft.connect(signer).registerSong(h, uri);
    const receipt = await tx.wait();

    // Parse SongRegistered event to extract tokenId
    const parsed = [];
    for (const l of receipt.logs)
    {
      try { parsed.push(nft.interface.parseLog(l)); } catch (e) {}
    }

    const ev = parsed.find(p => p && p.name === "SongRegistered");
    expect(ev, "SongRegistered event not found").to.not.equal(undefined);

    return ev.args.tokenId;
  }

  async function fundFromDeployer(kny, deployer, to, amount)
  {
    await (await kny.connect(deployer).transfer(to.address, amount)).wait();
  }

  async function approveNFT(nft, owner, market, tokenId)
  {
    await (await nft.connect(owner).approve(await market.getAddress(), tokenId)).wait();
  }

  describe("createOffer()", function ()
  {
    it("creates offer when owner approved marketplace", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");
      await approveNFT(nft, creator, market, tokenId);

      const price = ethers.parseUnits("50", 18);

      await expect(market.connect(creator).createOffer(await nft.getAddress(), tokenId, price))
        .to.emit(market, "OfferCreated")
        .withArgs(await nft.getAddress(), tokenId, creator.address, price, anyValue);

      const offer = await market.saleOffers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(creator.address);
      expect(offer.price).to.equal(price);
      expect(offer.createdAt).to.be.gt(0n);
    });

    it("reverts if price is 0", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");
      await approveNFT(nft, creator, market, tokenId);

      await expect(
        market.connect(creator).createOffer(await nft.getAddress(), tokenId, 0)
      ).to.be.revertedWithCustomError(market, "PriceMustBePositive");
    });

    it("reverts if nft address is zero", async function ()
    {
      const { creator, market } = await deployAll();

      await expect(
        market.connect(creator).createOffer(ethers.ZeroAddress, 1, 1)
      ).to.be.revertedWithCustomError(market, "InvalidNFTAddress");
    });

    it("reverts if caller is not token owner", async function ()
    {
      const { creator, buyer, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");
      await approveNFT(nft, creator, market, tokenId);

      const price = ethers.parseUnits("10", 18);

      await expect(
        market.connect(buyer).createOffer(await nft.getAddress(), tokenId, price)
      ).to.be.revertedWithCustomError(market, "NotTokenOwner");
    });

    it("reverts if marketplace not approved for token", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");
      const price = ethers.parseUnits("10", 18);

      await expect(
        market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)
      ).to.be.revertedWithCustomError(market, "NotApprovedForNFT");
    });
  });

  describe("cancelOffer()", function ()
  {
    it("seller can cancel offer", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");
      await approveNFT(nft, creator, market, tokenId);

      const price = ethers.parseUnits("5", 18);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)).wait();

      await expect(market.connect(creator).cancelOffer(await nft.getAddress(), tokenId))
        .to.emit(market, "OfferCanceled")
        .withArgs(await nft.getAddress(), tokenId, creator.address, anyValue);

      const offer = await market.saleOffers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(ethers.ZeroAddress);
      expect(offer.price).to.equal(0n);
      expect(offer.createdAt).to.equal(0n);
    });

    it("reverts if offer does not exist", async function ()
    {
      const { creator, nft, market } = await deployAll();

      await expect(
        market.connect(creator).cancelOffer(await nft.getAddress(), 1)
      ).to.be.revertedWithCustomError(market, "OfferDoesNotExist");
    });

    it("reverts if caller is not seller", async function ()
    {
      const { creator, buyer, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");
      await approveNFT(nft, creator, market, tokenId);

      const price = ethers.parseUnits("5", 18);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)).wait();

      await expect(
        market.connect(buyer).cancelOffer(await nft.getAddress(), tokenId)
      ).to.be.revertedWithCustomError(market, "NotTokenOwner");
    });
  });

  describe("updateOfferPrice()", function ()
  {
    it("seller can update price", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");
      await approveNFT(nft, creator, market, tokenId);

      const price = ethers.parseUnits("5", 18);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)).wait();

      const newPrice = ethers.parseUnits("7", 18);

      await expect(market.connect(creator).updateOfferPrice(await nft.getAddress(), tokenId, newPrice))
        .to.emit(market, "OfferPriceUpdated")
        .withArgs(await nft.getAddress(), tokenId, creator.address, newPrice, anyValue);

      const offer = await market.saleOffers(await nft.getAddress(), tokenId);
      expect(offer.price).to.equal(newPrice);
    });

    it("reverts if new price is 0", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");
      await approveNFT(nft, creator, market, tokenId);

      const price = ethers.parseUnits("5", 18);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)).wait();

      await expect(
        market.connect(creator).updateOfferPrice(await nft.getAddress(), tokenId, 0)
      ).to.be.revertedWithCustomError(market, "PriceMustBePositive");
    });

    it("reverts if offer does not exist", async function ()
    {
      const { creator, nft, market } = await deployAll();

      await expect(
        market.connect(creator).updateOfferPrice(await nft.getAddress(), 1, 1)
      ).to.be.revertedWithCustomError(market, "OfferDoesNotExist");
    });
  });

  describe("purchase()", function ()
  {
    it("happy path + royalty: second sale pays 10% to original creator", async function ()
    {
      const { deployer, creator, seller, buyer, nft, kny, market, initialSupply } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");

      const firstPrice = ethers.parseUnits("100", 18);

      await approveNFT(nft, creator, market, tokenId);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, firstPrice)).wait();

      await fundFromDeployer(kny, deployer, seller, firstPrice);
      await (await kny.connect(seller).approve(await market.getAddress(), firstPrice)).wait();

      await (await market.connect(seller).purchase(await nft.getAddress(), tokenId)).wait();
      expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

      const secondPrice = ethers.parseUnits("50", 18);

      await approveNFT(nft, seller, market, tokenId);
      await (await market.connect(seller).createOffer(await nft.getAddress(), tokenId, secondPrice)).wait();

      await fundFromDeployer(kny, deployer, buyer, secondPrice);
      await (await kny.connect(buyer).approve(await market.getAddress(), secondPrice)).wait();

      const creatorBalBefore = await kny.balanceOf(creator.address);
      const sellerBalBefore = await kny.balanceOf(seller.address);
      const buyerBalBefore = await kny.balanceOf(buyer.address);

      await expect(market.connect(buyer).purchase(await nft.getAddress(), tokenId))
        .to.emit(market, "Purchased");

      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);

      const royalty = (secondPrice * 1000n) / 10000n; // 10%
      const sellerAmount = secondPrice - royalty;

      const creatorBalAfter = await kny.balanceOf(creator.address);
      const sellerBalAfter = await kny.balanceOf(seller.address);
      const buyerBalAfter = await kny.balanceOf(buyer.address);

      expect(creatorBalAfter - creatorBalBefore).to.equal(royalty);
      expect(sellerBalAfter - sellerBalBefore).to.equal(sellerAmount);
      expect(buyerBalBefore - buyerBalAfter).to.equal(secondPrice);

      const offer = await market.saleOffers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(ethers.ZeroAddress);
      expect(offer.price).to.equal(0n);

      expect(await kny.balanceOf(deployer.address)).to.equal(initialSupply - firstPrice - secondPrice);
    });

    it("reverts if offer does not exist", async function ()
    {
      const { buyer, nft, market } = await deployAll();

      await expect(
        market.connect(buyer).purchase(await nft.getAddress(), 1)
      ).to.be.revertedWithCustomError(market, "OfferDoesNotExist");
    });

    it("reverts if buyer did not approve ERC20 allowance and offer stays", async function ()
    {
      const { deployer, creator, buyer, nft, kny, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");

      const price = ethers.parseUnits("10", 18);

      await approveNFT(nft, creator, market, tokenId);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)).wait();

      await fundFromDeployer(kny, deployer, buyer, price);

      await expect(
        market.connect(buyer).purchase(await nft.getAddress(), tokenId)
      ).to.be.reverted;

      const offer = await market.saleOffers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(creator.address);
      expect(offer.price).to.equal(price);
    });

    it("reverts if seller revoked NFT approval after offer", async function ()
    {
      const { deployer, creator, buyer, nft, kny, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#1");
      const price = ethers.parseUnits("10", 18);

      await approveNFT(nft, creator, market, tokenId);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)).wait();

      await (await nft.connect(creator).approve(ethers.ZeroAddress, tokenId)).wait();

      await fundFromDeployer(kny, deployer, buyer, price);
      await (await kny.connect(buyer).approve(await market.getAddress(), price)).wait();

      await expect(
        market.connect(buyer).purchase(await nft.getAddress(), tokenId)
      ).to.be.revertedWithCustomError(market, "NotApprovedForNFT");

      const offer = await market.saleOffers(await nft.getAddress(), tokenId);
      expect(offer.seller).to.equal(creator.address);
      expect(offer.price).to.equal(price);
    });
  });

  describe("Offer Indexing (getActiveOffers / getOffersBySeller)", function ()
  {
    it("starts empty", async function ()
    {
      const { market, creator } = await deployAll();

      const active = await market.getActiveOffers();
      expect(active.length).to.equal(0);

      const mine = await market.getOffersBySeller(creator.address);
      expect(mine.length).to.equal(0);
    });

    it("indexes offer on createOffer", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#index#1");
      await approveNFT(nft, creator, market, tokenId);

      const price = ethers.parseUnits("123", 18);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)).wait();

      const active = await market.getActiveOffers();
      expect(active.length).to.equal(1);

      expect(active[0].nft).to.equal(await nft.getAddress());
      expect(active[0].tokenId).to.equal(tokenId);
      expect(active[0].seller).to.equal(creator.address);
      expect(active[0].price).to.equal(price);
      expect(active[0].createdAt).to.be.gt(0n);

      const mine = await market.getOffersBySeller(creator.address);
      expect(mine.length).to.equal(1);
      expect(mine[0].tokenId).to.equal(tokenId);
      expect(mine[0].price).to.equal(price);
    });

    it("reflects price updates in OfferView", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#index#2");
      await approveNFT(nft, creator, market, tokenId);

      const price1 = ethers.parseUnits("10", 18);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price1)).wait();

      const price2 = ethers.parseUnits("25", 18);
      await (await market.connect(creator).updateOfferPrice(await nft.getAddress(), tokenId, price2)).wait();

      const active = await market.getActiveOffers();
      expect(active.length).to.equal(1);
      expect(active[0].price).to.equal(price2);

      const mine = await market.getOffersBySeller(creator.address);
      expect(mine.length).to.equal(1);
      expect(mine[0].price).to.equal(price2);
    });

    it("deindexes on cancelOffer (active + seller lists)", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#index#3");
      await approveNFT(nft, creator, market, tokenId);

      const price = ethers.parseUnits("50", 18);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)).wait();

      expect((await market.getActiveOffers()).length).to.equal(1);
      expect((await market.getOffersBySeller(creator.address)).length).to.equal(1);

      await (await market.connect(creator).cancelOffer(await nft.getAddress(), tokenId)).wait();

      expect((await market.getActiveOffers()).length).to.equal(0);
      expect((await market.getOffersBySeller(creator.address)).length).to.equal(0);
    });

    it("deindexes on purchase and trade history still works", async function ()
    {
      const { deployer, creator, buyer, nft, kny, market } = await deployAll();

      const tokenId = await registerTo(nft, creator, "song#index#4");
      await approveNFT(nft, creator, market, tokenId);

      const price = ethers.parseUnits("100", 18);
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId, price)).wait();

      await fundFromDeployer(kny, deployer, buyer, price);
      await (await kny.connect(buyer).approve(await market.getAddress(), price)).wait();

      await (await market.connect(buyer).purchase(await nft.getAddress(), tokenId)).wait();

      expect((await market.getActiveOffers()).length).to.equal(0);
      expect((await market.getOffersBySeller(creator.address)).length).to.equal(0);

      expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);

      const len = await market.tradeHistoryLength(await nft.getAddress(), tokenId);
      expect(len).to.equal(1);
    });

    it("swap&pop keeps remaining offers consistent", async function ()
    {
      const { creator, nft, market } = await deployAll();

      const tokenId1 = await registerTo(nft, creator, "song#index#5-a", "ipfs://a");
      const tokenId2 = await registerTo(nft, creator, "song#index#5-b", "ipfs://b");

      await approveNFT(nft, creator, market, tokenId1);
      await approveNFT(nft, creator, market, tokenId2);

      const p1 = ethers.parseUnits("11", 18);
      const p2 = ethers.parseUnits("22", 18);

      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId1, p1)).wait();
      await (await market.connect(creator).createOffer(await nft.getAddress(), tokenId2, p2)).wait();

      expect((await market.getActiveOffers()).length).to.equal(2);
      expect((await market.getOffersBySeller(creator.address)).length).to.equal(2);

      await (await market.connect(creator).cancelOffer(await nft.getAddress(), tokenId1)).wait();

      const active = await market.getActiveOffers();
      expect(active.length).to.equal(1);
      expect(active[0].tokenId).to.equal(tokenId2);
      expect(active[0].price).to.equal(p2);

      const mine = await market.getOffersBySeller(creator.address);
      expect(mine.length).to.equal(1);
      expect(mine[0].tokenId).to.equal(tokenId2);
      expect(mine[0].price).to.equal(p2);
    });
  });
});
