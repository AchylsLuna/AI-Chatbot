// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AppointmentLedger {
    event AppointmentRecorded(string reservationId, bytes32 payloadHash);

    mapping(string => bytes32) public records;

    function recordAppointmentHash(string calldata reservationId, bytes32 payloadHash)
        external
        returns (bytes32)
    {
        records[reservationId] = payloadHash;
        emit AppointmentRecorded(reservationId, payloadHash);
        return payloadHash;
    }
}
