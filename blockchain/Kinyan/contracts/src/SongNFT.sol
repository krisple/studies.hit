// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IKinyanTradableNFT.sol";


/// @title SongNFT (Kinyan)
/// @notice ERC721 that registers assets by hash and mints NFTs. Ownership transfers are restricted to Kinyan Marketplace.
contract SongNFT is ERC721URIStorage, Ownable, IKinyanTradableNFT
{
    // ===== Errors =====
    error InvalidSongHash();
    error SongAlreadyRegistered(bytes32 songHash);

    error InvalidMarketplaceAddress();
    error MarketplaceAlreadySet();
    error TransfersOnlyViaMarketplace();

    // ===== Constants =====
    uint256 private constant NOT_REGISTERED = 0;

    // ===== State =====
    address public marketplace;

    uint256 private _nextTokenId = 1;

    mapping(bytes32 => uint256) public tokenIdBySongHash;
    mapping(uint256 => address) public originalCreatorByTokenId;
    mapping(uint256 => uint256) public registeredAtByTokenId;
    mapping(uint256 => OwnershipRecord[]) private _ownershipHistory;

    // ===== Events =====
    event MarketplaceSet(address indexed marketplace);

    event SongRegistered(address indexed creator, uint256 indexed tokenId,
                         bytes32 indexed songHash, uint256 registeredAt, string tokenURI);

    event OwnershipRecorded(uint256 indexed tokenId, address indexed owner, uint256 timestamp);

    // ===== Constructor =====
    constructor() ERC721("KinyanSong", "KNYSONG") Ownable(msg.sender) {}

    // ===== Admin =====
    /// @notice Sets the Marketplace contract address (one-time).
    function setMarketplace(address _marketplace) external onlyOwner 
    {
        _validateMarketplaceAddress(_marketplace);
        _requireMarketplaceNotSet();
        marketplace = _marketplace;
        emit MarketplaceSet(_marketplace);
    }

    // ===== Core =====
    /// @notice Registers an asset by hash and mints an NFT to the caller.
    function registerSong(bytes32 songHash, string calldata tokenURI) external returns (uint256 tokenId) 
    {
        _validateNewSongHash(songHash);

        tokenId = _nextTokenId++;

        _mintWithMetadata(msg.sender, tokenId, tokenURI);

        _persistRegistration(songHash, tokenId, msg.sender);

        emit SongRegistered(msg.sender, tokenId, songHash, block.timestamp, tokenURI);
    }

    // ===== Views =====
    function getTokenIdBySongHash(bytes32 songHash) external view returns (uint256)
    {
        return tokenIdBySongHash[songHash];
    }

    function nextTokenId() external view returns (uint256) 
    {
        return _nextTokenId;
    }

    function ownershipHistoryLength(uint256 tokenId) external view returns (uint256) 
    {
        return _ownershipHistory[tokenId].length;
    }

    /// @notice Returns full on-chain ownership history for tokenId.
    /// @dev Intended for off-chain reads (UI). Large histories may be heavy to return.
    function getOwnershipHistory(uint256 tokenId) external view returns (OwnershipRecord[] memory) 
    {
        OwnershipRecord[] storage storedHistory = _ownershipHistory[tokenId];
        uint256 n = storedHistory.length;

        OwnershipRecord[] memory history = new OwnershipRecord[](n);
        for (uint256 i = 0; i < n; i++) {
            history[i] = storedHistory[i];
        }

        return history;
    }

    // ===== Internal: validations =====
    function _validateNewSongHash(bytes32 songHash) internal view 
    {
        if (songHash == bytes32(0)) revert InvalidSongHash();
        if (tokenIdBySongHash[songHash] != NOT_REGISTERED) revert SongAlreadyRegistered(songHash);
    }

    function _validateMarketplaceAddress(address _marketplace) internal pure 
    {
        if (_marketplace == address(0)) revert InvalidMarketplaceAddress();
    }

    function _requireMarketplaceNotSet() internal view 
    {
        if (marketplace != address(0)) revert MarketplaceAlreadySet();
    }

    // ===== Internal: registration pipeline =====
    function _mintWithMetadata(address to, uint256 tokenId, string calldata tokenURI) internal 
    {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
    }

    function _persistRegistration(bytes32 songHash, uint256 tokenId, address creator) internal 
    {
        tokenIdBySongHash[songHash] = tokenId;
        originalCreatorByTokenId[tokenId] = creator;
        registeredAtByTokenId[tokenId] = block.timestamp;
    }

    // ===== Internal: transfer restriction + history (OpenZeppelin v5 hook) =====
    /// @dev Called by OZ during mint/transfer/burn. We enforce transfer policy and record ownership history.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address from) 
    {
        from = _ownerOf(tokenId);

        _enforceMarketplaceOnlyTransfers(from, to);

        from = super._update(to, tokenId, auth);

        _recordOwnershipIfNeeded(tokenId, to);
    }

    function _enforceMarketplaceOnlyTransfers(address from, address to) internal view
    {
        if (from != address(0) && to != address(0)) 
        {
            if (msg.sender != marketplace) revert TransfersOnlyViaMarketplace();
        }
    }

    function _recordOwnershipIfNeeded(uint256 tokenId, address to) internal 
    {
        if (to == address(0)) return;

        _ownershipHistory[tokenId].push(OwnershipRecord({owner: to, timestamp: block.timestamp}));

        emit OwnershipRecorded(tokenId, to, block.timestamp);
    }

    	
    // ===== ERC165: declare support for IKinyanTradableNFT =====
    function supportsInterface(bytes4 interfaceId) public view override(ERC721URIStorage, IERC165) returns (bool)
    {
        return interfaceId == type(IKinyanTradableNFT).interfaceId || super.supportsInterface(interfaceId);
    }
}
