// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.17;

/**
 * @title Storage
 * @dev Store & retrieve value in a variable
 * @custom:dev-run-script ./scripts/deploy_with_ethers.ts
 */
contract Storage {
    uint256 number;
    uint256 count;

    /**
     * @dev Store value in variable
     * @param num value to store
     */
    function store(uint256 num) public {
        number = num;
        count = count + 1;
    }

    /**
     * @dev Return value
     * @return value of 'number'
     */
    function retrieve() public view returns (uint256) {
        return number;
    }

    /**
     * @dev Return value
     * @return value of 'number'
     */
    function updateCount() public view returns (uint256) {
        return count;
    }
}
