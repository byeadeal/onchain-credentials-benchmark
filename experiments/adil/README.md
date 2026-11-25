# Verification benchmark

Run from the repository root on Windows, on `adil-work`:

```powershell
npx hardhat --config experiments/adil/hardhat.config.ts test
npx hardhat --config experiments/adil/hardhat.config.ts run experiments/adil/run-verification.ts
```

The runner saves new evidence under `docs/adil/evidence/`.
