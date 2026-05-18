# Proof of Reality

**By [KANT Labs](https://kantlabs.com)**

Proof of Reality is an open-source framework for cryptographic verification of real-world media. It combines on-chain data extraction, physical forensics, and mobile-first tooling to establish trust in digital content.

## Papers

**Proof-of-Reality: Binding Multimedia Content to Physical Capture through Ledger-Anchored Feedback Paths**
Preprint · May 2026 · Zenodo: [https://zenodo.org/records/20205320](https://zenodo.org/records/20205320) · DOI: `10.5281/zenodo.20205320`

**PoR-Chain: Cryptographically Anchored Cumulative Hash Chains for Provable Multimedia Authenticity**
Preprint · May 2026 · Zenodo: [https://zenodo.org/records/20265390](https://zenodo.org/records/20265390) · DOI: `10.5281/zenodo.20265390`

## Architecture

This is an Nx monorepo containing three domains:

### Moment Ecosystem
Real-time extraction and broadcasting of on-chain data from Solana.

- **KANTick App** (`apps/kantist/kantist_app`) — React Native mobile app for the Moment ecosystem
- **Extractor** (`apps/kantick/extractor`) — Rust service that polls Solana RPC for blockchain data
- **Broadcaster** (`apps/kantick/broadcaster`) — Cloudflare Worker (Durable Objects) that broadcasts block data to clients

### KANTist Ecosystem
Cryptographic verification and physical forensics for media.

- **KANTist App** (`apps/kantist/kantist_app`) — React Native mobile app for capturing and verifying images
- **Scribe** (`apps/scribe`) — Cloudflare Worker for ingestion and logging

### Web
- **KANTainer** (`apps/kantainer`) — Next.js public landing page for KANT Labs

## Getting Started

### Prerequisites
- Node.js (v18+)
- Rust (v1.70+)
- Python (v3.9+)
- Ruby (for iOS CocoaPods)
- Android Studio / Xcode (for mobile development)
- Wrangler CLI (for Cloudflare Workers)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. **Mobile Apps**: Follow standard React Native setup in `apps/kantist/kantist_app` (e.g., `npm run ios` or `npm run android`). Run `pod install` inside `ios/` if needed.

3. **Cloudflare Workers**: Copy `.dev.vars.example` to `.dev.vars` in `apps/kantick/broadcaster` and `apps/scribe`, then run `npx wrangler dev`.

4. **Rust Extractor**: Navigate to `apps/kantick/extractor`, copy `.env.example` to `.env`, and run `cargo run --release`.

## Running Tasks

```sh
npx nx serve <project-name>
npx nx build <project-name>
npx nx lint <project-name>
npx nx graph  # visualize project dependencies
```

## License

See [LICENSE](LICENSE) for details.
