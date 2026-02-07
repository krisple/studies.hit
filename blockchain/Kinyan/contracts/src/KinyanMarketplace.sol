// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IKinyanTradableNFT.sol";

contract KinyanMarketplace is ReentrancyGuard
{
    // ===== Errors =====
    error InvalidNFTAddress();
    error PriceMustBePositive();

    error NotTokenOwner();
    error NotApprovedForNFT();
    error OfferDoesNotExist();

    error NFTNotTradable();
    error NFTMarketplaceMismatch();

    error ERC20TransferFailed();

    // ===== Constants =====
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant ROYALTY_BPS = 1000;

    // ===== Structs =====
    struct SaleOffer
    {
        address seller;
        uint256 price;
        uint256 createdAt;
    }

    struct Trade
    {
        address seller;
        address buyer;
        uint256 price;
        address creator;
        uint256 royalty;
        uint256 timestamp;
    }

    // ===== State =====
    IERC20 public immutable kny;

    mapping(address => mapping(uint256 => SaleOffer)) public saleOffers;
    mapping(address => mapping(uint256 => Trade[])) private _tradeHistory;

    // ===== Events =====
    event OfferCreated(address indexed nft, uint256 indexed tokenId,
                       address indexed seller, uint256 price, uint256 createdAt);

    event OfferCanceled(address indexed nft, uint256 indexed tokenId,
                        address indexed seller, uint256 timestamp);

    event OfferPriceUpdated(address indexed nft, uint256 indexed tokenId,
                            address indexed seller, uint256 newPrice, uint256 timestamp);

    event Purchased(address indexed nft, uint256 indexed tokenId,
                    address indexed buyer, address seller, uint256 price,
                    address creator, uint256 royalty, uint256 timestamp);

    // ===== Constructor =====
    constructor(address _kny)
    {
        kny = IERC20(_kny);
    }

    // ===== Public API =====
    function createOffer(address nft, uint256 tokenId, uint256 price) external
    {
        if (nft == address(0)) revert InvalidNFTAddress();
        if (price == 0) revert PriceMustBePositive();

        _requireTradableNFT(nft);

        IKinyanTradableNFT nftContract = IKinyanTradableNFT(nft);

        _requireAddressEquals(nftContract.ownerOf(tokenId), msg.sender);

        _requireMarketplaceApproved(IERC721(nft), tokenId, msg.sender);

        saleOffers[nft][tokenId] = SaleOffer({seller: msg.sender, price: price,
                                             createdAt: block.timestamp});

        emit OfferCreated(nft, tokenId, msg.sender, price, block.timestamp);
    }

    function cancelOffer(address nft, uint256 tokenId) external
    {
        SaleOffer memory offer = _getOfferOrRevert(nft, tokenId);

        _requireAddressEquals(offer.seller, msg.sender);

        delete saleOffers[nft][tokenId];

        emit OfferCanceled(nft, tokenId, msg.sender, block.timestamp);
    }

    function updateOfferPrice(address nft, uint256 tokenId, uint256 newPrice) external
    {
        if (newPrice == 0) revert PriceMustBePositive();

        SaleOffer memory offer = _getOfferOrRevert(nft, tokenId);

        _requireAddressEquals(offer.seller, msg.sender);

        saleOffers[nft][tokenId].price = newPrice;

        emit OfferPriceUpdated(nft, tokenId, msg.sender, newPrice, block.timestamp);
    }

    function purchase(address nft, uint256 tokenId) external nonReentrant
    {
        SaleOffer memory offer = _getOfferOrRevert(nft, tokenId);

        _requireTradableNFT(nft);

        IKinyanTradableNFT nftContract = IKinyanTradableNFT(nft);

        _requireAddressEquals(nftContract.ownerOf(tokenId), offer.seller);

        _requireMarketplaceApproved(IERC721(nft), tokenId, offer.seller);

        address creator = nftContract.originalCreatorByTokenId(tokenId);
        uint256 royalty = (offer.price * ROYALTY_BPS) / BPS_DENOMINATOR;
        uint256 sellerAmount = offer.price - royalty;

        delete saleOffers[nft][tokenId];

        if (royalty > 0)
        {
            _transferKNY(msg.sender, creator, royalty);
        }

        _transferKNY(msg.sender, offer.seller, sellerAmount);

        nftContract.safeTransferFrom(offer.seller, msg.sender, tokenId);

        _tradeHistory[nft][tokenId].push(Trade({seller: offer.seller, buyer: msg.sender,
                                               price: offer.price, creator: creator,
                                               royalty: royalty, timestamp: block.timestamp}));

        emit Purchased(nft, tokenId, msg.sender, offer.seller,
                       offer.price, creator, royalty, block.timestamp);
    }

    // ===== Views =====
    function tradeHistoryLength(address nft, uint256 tokenId) external view returns (uint256)
    {
        return _tradeHistory[nft][tokenId].length;
    }

    function getTrade(address nft, uint256 tokenId, uint256 index) external view returns (Trade memory)
    {
        return _tradeHistory[nft][tokenId][index];
    }

    function getTradeHistory(address nft, uint256 tokenId) external view returns (Trade[] memory)
    {
        Trade[] storage storedTrades = _tradeHistory[nft][tokenId];
        uint256 n = storedTrades.length;

        Trade[] memory trades = new Trade[](n);

        for (uint256 i = 0; i < n; i++)
        {
            trades[i] = storedTrades[i];
        }

        return trades;
    }

    // ===== Internal =====
    function _getOfferOrRevert(address nft, uint256 tokenId) internal view returns (SaleOffer memory offer)
    {
        offer = saleOffers[nft][tokenId];
        if (offer.seller == address(0)) revert OfferDoesNotExist();
    }

    function _requireAddressEquals(address actual, address expected) internal pure
    {
        if (actual != expected) revert NotTokenOwner();
    }

    function _transferKNY(address from, address to, uint256 amount) internal
    {
        bool ok = kny.transferFrom(from, to, amount);
        if (!ok) revert ERC20TransferFailed();
    }

    function _requireMarketplaceApproved(IERC721 nftContract, uint256 tokenId, address owner) internal view
    {
        if (nftContract.getApproved(tokenId) != address(this) &&
            !nftContract.isApprovedForAll(owner, address(this)))
        {
            revert NotApprovedForNFT();
        }
    }

    function _requireTradableNFT(address nft) internal view
    {
        try IERC165(nft).supportsInterface(type(IKinyanTradableNFT).interfaceId) returns (bool ok)
        {
            if (!ok) revert NFTNotTradable();
        }
        catch
        {
            revert NFTNotTradable();
        }

        if (IKinyanTradableNFT(nft).marketplace() != address(this))
        {
            revert NFTMarketplaceMismatch();
        }
    }
}
