// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract SongNFT is ERC721URIStorage {
    uint256 private _nextTokenId = 1;

    // Prevent duplicate registrations: songHash -> tokenId
    mapping(bytes32 => uint256) public hashToTokenId;

    // Original creator and timestamp
    mapping(uint256 => address) public creatorOf;
    mapping(uint256 => uint256) public registeredAt;

    event SongRegistered(
        address indexed creator,
        uint256 indexed tokenId,
        bytes32 indexed songHash,
        uint256 timestamp,
        string tokenURI
    );

    constructor() ERC721("Kinyan Song", "KNY-S") {}

    function mintSong(bytes32 songHash, string calldata tokenUri)
        external
        returns (uint256 tokenId)
    {
        require(songHash != bytes32(0), "Invalid hash");
        require(hashToTokenId[songHash] == 0, "Song already registered");

        tokenId = _nextTokenId;
        _nextTokenId += 1;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenUri);

        hashToTokenId[songHash] = tokenId;
        creatorOf[tokenId] = msg.sender;
        registeredAt[tokenId] = block.timestamp;

        emit SongRegistered(msg.sender, tokenId, songHash, block.timestamp, tokenUri);
    }

    function getTokenIdByHash(bytes32 songHash) external view returns (uint256) {
        return hashToTokenId[songHash];
    }

    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }
}
