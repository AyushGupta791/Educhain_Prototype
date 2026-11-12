require("@nomicfoundation/hardhat-toolbox");

// Local development network only (Hardhat Network). No public network, no keys, no real funds.
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
};
