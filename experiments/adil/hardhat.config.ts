import path from "node:path";
import type { HardhatUserConfig } from "hardhat/config";
import shared from "../../hardhat.config";

// Read shared compiler settings; isolate generated files and test discovery.
const config: HardhatUserConfig = {
  ...shared,
  networks: { hardhat: { hardfork: "osaka", chainId: 31337 } },
  paths: {
    root: path.resolve(__dirname, "../.."),
    sources: path.resolve(__dirname, "../../contracts"),
    tests: path.resolve(__dirname, "test"),
    cache: path.resolve(__dirname, ".generated/cache"),
    artifacts: path.resolve(__dirname, ".generated/artifacts"),
  },
  typechain: { outDir: path.resolve(__dirname, ".generated/typechain") },
};
export default config;
