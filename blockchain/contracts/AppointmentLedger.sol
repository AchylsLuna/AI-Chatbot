// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AppointmentLedger {
    address public systemWallet;

    struct MedicalRecord {
        uint8 status; // 0: Pending, 1: Confirmed, 2: Completed, 3: Cancelled
        string soapNoteHash;
        string prescriptionsHash;
    }

    mapping(string => MedicalRecord) public records;

    event AppointmentCreated(string indexed mongoId, string patientId, string doctorId);
    event StatusUpdated(string indexed mongoId, uint8 newStatus);
    event SoapNoteUpdated(string indexed mongoId, string newHash);
    event PrescriptionsUpdated(string indexed mongoId, string newHash);

    modifier onlySystem() {
        require(msg.sender == systemWallet, "Only system relayer can execute");
        _;
    }

    constructor() {
        systemWallet = msg.sender; 
    }

    function recordAppointment(string memory _mongoId, string memory _patientId, string memory _doctorId) public onlySystem {
        records[_mongoId].status = 0; 
        emit AppointmentCreated(_mongoId, _patientId, _doctorId);
    }

    function updateStatus(string memory _mongoId, uint8 _newStatus) public onlySystem {
        records[_mongoId].status = _newStatus;
        emit StatusUpdated(_mongoId, _newStatus);
    }

    function updateSoapNote(string memory _mongoId, string memory _hash) public onlySystem {
        records[_mongoId].soapNoteHash = _hash;
        emit SoapNoteUpdated(_mongoId, _hash);
    }

    function updatePrescriptions(string memory _mongoId, string memory _hash) public onlySystem {
        records[_mongoId].prescriptionsHash = _hash;
        emit PrescriptionsUpdated(_mongoId, _hash);
    }
}