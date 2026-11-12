// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CertificateRegistry
 * @notice Educational prototype. Not a real product. Do not use with real funds or real data.
 *
 * Stores only a cryptographic hash of a (synthetic) certificate, the issuer address,
 * a timestamp, a status and an opaque referenceId ID. The `referenceId` string must NEVER
 * contain names, IIN, phone numbers or any other personal data.
 *
 * Roles
 *  - DEFAULT_ADMIN_ROLE: grants/revokes ISSUER_ROLE, can pause/unpause registration.
 *                        Cannot register or revoke certificates.
 *  - ISSUER_ROLE:        can register hashes and revoke ONLY the hashes it registered.
 *  - Anyone:             can verify a hash (a read-only call; chain data is public anyway).
 *
 * Built on OpenZeppelin Contracts v5 (MIT licence): AccessControl, Pausable.
 * No ether or tokens are held, and no external calls are made, so reentrancy is not
 * possible by design (see README, threat table).
 */
contract CertificateRegistry is AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    enum Status { None, Active, Revoked }

    struct Record {
        address issuer;
        uint64 registeredAt;
        Status status;
        string referenceId;
    }

    mapping(bytes32 => Record) private _records;

    event CertificateRegistered(bytes32 indexed certificateHash, address indexed issuer, string referenceId);
    event CertificateRevoked(bytes32 indexed certificateHash, address indexed issuer);

    error EmptyHash();
    error AlreadyRegistered(bytes32 certificateHash);
    error NotRegistered(bytes32 certificateHash);
    error NotRecordIssuer(bytes32 certificateHash, address caller);
    error AlreadyRevoked(bytes32 certificateHash);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Register a certificate hash. Rejects empty and duplicate hashes.
    function registerCertificate(bytes32 certificateHash, string calldata referenceId)
        external
        onlyRole(ISSUER_ROLE)
        whenNotPaused
    {
        if (certificateHash == bytes32(0)) revert EmptyHash();
        if (_records[certificateHash].status != Status.None) revert AlreadyRegistered(certificateHash);

        _records[certificateHash] = Record({
            issuer: msg.sender,
            registeredAt: uint64(block.timestamp),
            status: Status.Active,
            referenceId: referenceId
        });

        emit CertificateRegistered(certificateHash, msg.sender, referenceId);
    }

    /// @notice Revoke a certificate. Only the issuer that registered it may do so.
    /// @dev Revocation stays available while paused, so errors can be corrected during an incident.
    function revokeCertificate(bytes32 certificateHash) external onlyRole(ISSUER_ROLE) {
        Record storage r = _records[certificateHash];
        if (r.status == Status.None) revert NotRegistered(certificateHash);
        if (r.issuer != msg.sender) revert NotRecordIssuer(certificateHash, msg.sender);
        if (r.status == Status.Revoked) revert AlreadyRevoked(certificateHash);

        r.status = Status.Revoked;
        emit CertificateRevoked(certificateHash, msg.sender);
    }

    /// @notice Check a hash. Returns Status.None for unknown hashes.
    function verifyCertificate(bytes32 certificateHash)
        external
        view
        returns (Status status, address issuer, uint64 registeredAt)
    {
        Record storage r = _records[certificateHash];
        return (r.status, r.issuer, r.registeredAt);
    }

    /// @notice Emergency stop for new registrations (admin only).
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
