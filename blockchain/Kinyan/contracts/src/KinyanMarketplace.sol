// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract KinyanMarketplace is ReentrancyGuard {
    error PriceMustBePositive();
    error NotTokenOwner();
    error NotApprovedForNFT();
    error NotListed();
    error InvalidNFTAddress();
    error ERC20TransferFailed();

    struct SaleOffer {
        address seller;
        uint256 price;
    }

    IERC20 public immutable paymentToken; // KNY on deployment

    mapping(address => mapping(uint256 => SaleOffer)) public offers; // nftContract -> tokenId -> offer

    event Listed(address indexed nft, uint256 indexed tokenId, address indexed seller, uint256 price);
    event Unlisted(address indexed nft, uint256 indexed tokenId, address indexed seller);
    event PriceUpdated(address indexed nft, uint256 indexed tokenId, address indexed seller, uint256 newPrice);
    event Purchased(address indexed nft, uint256 indexed tokenId, address indexed buyer, address seller, uint256 price);

    constructor(address _paymentToken) {
        paymentToken = IERC20(_paymentToken);
    }

    function list(address nft, uint256 tokenId, uint256 price) external {
        if (nft == address(0)) revert InvalidNFTAddress();
        if (price == 0) revert PriceMustBePositive();

        IERC721 nftContract = IERC721(nft);

        if (nftContract.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        _requireMarketplaceApproved(nftContract, tokenId, msg.sender);

        offers[nft][tokenId] = SaleOffer({ seller: msg.sender, price: price });
        emit Listed(nft, tokenId, msg.sender, price);
    }

    function unlist(address nft, uint256 tokenId) external {
        SaleOffer memory o = _getOfferOrRevert(nft, tokenId);
        if (o.seller != msg.sender) revert NotTokenOwner();

        delete offers[nft][tokenId];
        emit Unlisted(nft, tokenId, msg.sender);
    }

    function updatePrice(address nft, uint256 tokenId, uint256 newPrice) external {
        if (newPrice == 0) revert PriceMustBePositive();

        SaleOffer memory o = _getOfferOrRevert(nft, tokenId);
        if (o.seller != msg.sender) revert NotTokenOwner();

        offers[nft][tokenId].price = newPrice;
        emit PriceUpdated(nft, tokenId, msg.sender, newPrice);
    }

    function buy(address nft, uint256 tokenId) external nonReentrant {
        SaleOffer memory o = _getOfferOrRevert(nft, tokenId);

        IERC721 nftContract = IERC721(nft);

        // Make sure listing is still valid at purchase time
        if (nftContract.ownerOf(tokenId) != o.seller) revert NotTokenOwner();
        _requireMarketplaceApproved(nftContract, tokenId, o.seller);

        // Effects first
        delete offers[nft][tokenId];

        // Pay seller (buyer must approve ERC20 beforehand)
        bool ok = paymentToken.transferFrom(msg.sender, o.seller, o.price);
        if (!ok) revert ERC20TransferFailed();

        // Transfer NFT to buyer
        nftContract.safeTransferFrom(o.seller, msg.sender, tokenId);

        emit Purchased(nft, tokenId, msg.sender, o.seller, o.price);
    }

    function _getOfferOrRevert(address nft, uint256 tokenId) internal view returns (SaleOffer memory o) {
        o = offers[nft][tokenId];
        if (o.seller == address(0)) revert NotListed();
    }

    function _requireMarketplaceApproved(IERC721 nftContract, uint256 tokenId, address owner) internal view {
        if (
            nftContract.getApproved(tokenId) != address(this) &&
            !nftContract.isApprovedForAll(owner, address(this))
        ) {
            revert NotApprovedForNFT();
        }
    }
}
