// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title IKinyanTradableNFT
/// @notice NFT contracts that want to be traded on KinyanMarketplace must implement this interface.
/// @dev Marketplace will still use IERC721 for transfers; this interface is for "business data" (creator + history).
interface IKinyanTradableNFT is IERC721
{
    // Must match SongNFT.OwnershipRecord
    struct OwnershipRecord
    {
        address owner;
        uint256 timestamp;
    }

    /// @notice Returns the original creator (first registrar) of tokenId.
    function originalCreatorByTokenId(uint256 tokenId) external view returns (address);

    /// @notice Returns the registration timestamp of tokenId.
    function registeredAtByTokenId(uint256 tokenId) external view returns (uint256);

    /// @notice Returns full on-chain ownership history for tokenId.
    function getOwnershipHistory(uint256 tokenId) external view returns (OwnershipRecord[] memory);

    /// @notice Returns the marketplace address allowed to transfer tokens (if the NFT restricts transfers).
    function marketplace() external view returns (address);
}
