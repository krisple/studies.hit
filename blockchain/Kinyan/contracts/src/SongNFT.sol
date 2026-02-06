// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title SongNFT (Kinyan)
/// @notice Registers songs by hash and mints an ERC-721 NFT as a proof of registration/ownership.
contract SongNFT is ERC721URIStorage {
    // =========================
    // Errors
    // =========================
    error InvalidSongHash();
    error SongAlreadyRegistered(bytes32 songHash);

    // =========================
    // Constants
    // =========================
    /// @dev Mapping default value is 0. We treat tokenId=0 as "not registered".
    uint256 private constant NOT_REGISTERED = 0;

    // =========================
    // State
    // =========================
    /// @dev We start token IDs from 1 so that 0 can represent "not registered".
    uint256 private _nextTokenId = 1;

    /// @notice Returns the tokenId that was minted for a given song hash (0 means "not registered").
    mapping(bytes32 => uint256) public tokenIdBySongHash;

    /// @notice Returns the original creator (first registrar) of a given tokenId.
    mapping(uint256 => address) public originalCreatorByTokenId;

    /// @notice Returns the registration timestamp (block.timestamp) of a given tokenId.
    mapping(uint256 => uint256) public registeredAtByTokenId;

    // =========================
    // Events
    // =========================
    /// @notice Emitted when a new song hash is registered and an NFT is minted.
    event SongRegistered(
        address indexed creator,
        uint256 indexed tokenId,
        bytes32 indexed songHash,
        uint256 registeredAt,
        string tokenURI
    );

    // =========================
    // Constructor
    // =========================
    /// @notice Creates the SongNFT collection contract.
    constructor() ERC721("KinyanSong", "KNYSONG") {}

    // =========================
    // Core logic
    // =========================
    /// @notice Registers a new song (by hash) and mints an NFT to the caller.
    /// @dev Reverts if the hash is zero or already registered.
    /// @param songHash Hash of the song bytes computed off-chain (e.g., SHA-256/keccak256 output as bytes32).
    /// @param tokenURI Metadata URI for this song NFT (e.g., ipfs://... or https://...).
    /// @return tokenId The newly minted tokenId.
    function registerSong(bytes32 songHash, string calldata tokenURI)
        external
        returns (uint256 tokenId)
    {
        _validateSongHash(songHash);

        tokenId = _nextTokenId++;

        _mintSongNFT(msg.sender, tokenId, tokenURI);

        _persistRegistration(songHash, tokenId);

        emit SongRegistered(msg.sender, tokenId, songHash, block.timestamp, tokenURI);
    }

    function _validateSongHash(bytes32 songHash) internal view {
        if (songHash == bytes32(0)) revert InvalidSongHash();

        if (tokenIdBySongHash[songHash] != NOT_REGISTERED) {
            revert SongAlreadyRegistered(songHash);
        }
    }

    function _mintSongNFT(address to, uint256 tokenId, string calldata tokenURI) internal {
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);
    }

    function _persistRegistration(bytes32 songHash, uint256 tokenId) internal {
        tokenIdBySongHash[songHash] = tokenId;
        originalCreatorByTokenId[tokenId] = msg.sender;
        registeredAtByTokenId[tokenId] = block.timestamp;
    }

    // =========================
    // Views (helpers)
    // =========================
    /// @notice Getter for tokenId by song hash (0 means "not registered").
    function getTokenIdBySongHash(bytes32 songHash) external view returns (uint256) {
        return tokenIdBySongHash[songHash];
    }

    /// @notice Returns the next tokenId that will be minted.
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
