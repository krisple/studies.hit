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

    struct OfferKey
    {
        address nft;
        uint256 tokenId;
    }

    struct OfferView
    {
        address nft;
        uint256 tokenId;
        address seller;
        uint256 price;
        uint256 createdAt;
    }

    // ===== State =====
    IERC20 public immutable kny;

    mapping(address => mapping(uint256 => SaleOffer)) public saleOffers;
    mapping(address => mapping(uint256 => Trade[])) private _tradeHistory;

    // Active offers (global)
    OfferKey[] private _activeOfferKeys;
    mapping(bytes32 => uint256) private _activeIndexPlus1; // keyHash -> index+1

    // Active offers per seller
    mapping(address => OfferKey[]) private _sellerOfferKeys;
    mapping(address => mapping(bytes32 => uint256)) private _sellerIndexPlus1; // seller -> keyHash -> index+1

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

        _indexOffer(nft, tokenId, msg.sender);

        emit OfferCreated(nft, tokenId, msg.sender, price, block.timestamp);
    }

    function cancelOffer(address nft, uint256 tokenId) external
    {
        SaleOffer memory offer = _getOfferOrRevert(nft, tokenId);

        _requireAddressEquals(offer.seller, msg.sender);

        _deindexOffer(nft, tokenId, offer.seller);

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

        _deindexOffer(nft, tokenId, offer.seller);

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

    function getActiveOffers() external view returns (OfferView[] memory)
    {
        uint256 n = _activeOfferKeys.length;
        OfferView[] memory out = new OfferView[](n);

        for (uint256 i = 0; i < n; i++)
        {
            OfferKey memory k = _activeOfferKeys[i];
            SaleOffer memory offer = saleOffers[k.nft][k.tokenId];

            out[i] = OfferView({nft: k.nft, tokenId: k.tokenId, seller: offer.seller,
                                price: offer.price, createdAt: offer.createdAt});
        }

        return out;
    }

    function getOffersBySeller(address seller) external view returns (OfferView[] memory)
    {
        OfferKey[] storage keys = _sellerOfferKeys[seller];
        uint256 n = keys.length;
        OfferView[] memory out = new OfferView[](n);

        for (uint256 i = 0; i < n; i++)
        {
            OfferKey memory k = keys[i];
            SaleOffer memory offer = saleOffers[k.nft][k.tokenId];

            out[i] = OfferView({nft: k.nft, tokenId: k.tokenId, seller: offer.seller,
                                price: offer.price, createdAt: offer.createdAt});
        }

        return out;
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

    function _offerKeyHash(address nft, uint256 tokenId) internal pure returns (bytes32)
    {
        return keccak256(abi.encodePacked(nft, tokenId));
    }

    function _indexOffer(address nft, uint256 tokenId, address seller) internal
    {
        bytes32 h = _offerKeyHash(nft, tokenId);

        if (_activeIndexPlus1[h] == 0)
        {
            _activeOfferKeys.push(OfferKey({nft: nft, tokenId: tokenId}));
            _activeIndexPlus1[h] = _activeOfferKeys.length; // index+1
        }

        if (_sellerIndexPlus1[seller][h] == 0)
        {
            _sellerOfferKeys[seller].push(OfferKey({nft: nft, tokenId: tokenId}));
            _sellerIndexPlus1[seller][h] = _sellerOfferKeys[seller].length; // index+1
        }
    }

    function _swapPopOfferKey(OfferKey[] storage arr, uint256 idx) internal returns (OfferKey memory movedKey, bool moved)
    {
        uint256 last = arr.length - 1;

        if (idx != last)
        {
            movedKey = arr[last];
            arr[idx] = movedKey;
            moved = true;
        }

        arr.pop();
    }

    function _deindexOffer(address nft, uint256 tokenId, address seller) internal
    {
        bytes32 h = _offerKeyHash(nft, tokenId);

        uint256 idxPlus1 = _activeIndexPlus1[h];
        if (idxPlus1 != 0)
        {
            uint256 idx = idxPlus1 - 1;

            (OfferKey memory movedKey, bool moved) = _swapPopOfferKey(_activeOfferKeys, idx);

            if (moved)
            {
                bytes32 movedHash = _offerKeyHash(movedKey.nft, movedKey.tokenId);
                _activeIndexPlus1[movedHash] = idx + 1;
            }

            delete _activeIndexPlus1[h];
        }

        uint256 sIdxPlus1 = _sellerIndexPlus1[seller][h];
        if (sIdxPlus1 != 0)
        {
            uint256 sIdx = sIdxPlus1 - 1;

            (OfferKey memory movedKey2, bool moved2) = _swapPopOfferKey(_sellerOfferKeys[seller], sIdx);

            if (moved2)
            {
                bytes32 movedHash2 = _offerKeyHash(movedKey2.nft, movedKey2.tokenId);
                _sellerIndexPlus1[seller][movedHash2] = sIdx + 1;
            }

            delete _sellerIndexPlus1[seller][h];
        }
    }
}
