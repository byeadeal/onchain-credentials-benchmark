import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { COMPILER_VERSION, EVM_VERSION, OPTIMIZER_RUNS } from "./scripts/lib/settings";

const config: HardhatUserConfig = {
  solidity: {
    version: COMPILER_VERSION,
    settings: {
      optimizer: {
        enabled: true,
        runs: OPTIMIZER_RUNS,
      },
      evmVersion: EVM_VERSION,
    },
  },
};

export default config;
