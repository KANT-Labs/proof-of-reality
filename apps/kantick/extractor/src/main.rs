mod config;
mod models;
mod services;

use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;
use tokio::signal;
use tokio::time::interval;
use tracing::{info, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use config::Config;
use services::{SolanaService, CloudflareBroadcaster, fetch_and_broadcast};

const FREQUENCY_MS: u64 = 350;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "extractor=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    info!("Starting Solana Extractor (Rust)...");

    let cfg = Config::load()?;
    info!("Configuration loaded successfully");

    let rpc_url = cfg.rpc_url_with_key();
    info!("Using RPC endpoint: {}", cfg.rpc_address);

    let solana = Arc::new(SolanaService::new(rpc_url));
    let broadcaster = Arc::new(CloudflareBroadcaster::new(
        cfg.cloudflare_worker_url.clone(),
        cfg.cloudflare_auth_key.clone(),
    )?);
    info!("Using Cloudflare Worker: {}", cfg.cloudflare_worker_url);

    let signer_private_key = Arc::new(services::extractor::parse_private_key(&cfg.signer_private_key)?);
    info!("Signer private key loaded successfully");

    let frequency = Duration::from_millis(FREQUENCY_MS);
    info!("Fetching data every {:?}", frequency);

    let mut ticker = interval(frequency);

    // Initial fetch
    {
        let solana = Arc::clone(&solana);
        let broadcaster = Arc::clone(&broadcaster);
        let key = Arc::clone(&signer_private_key);
        tokio::spawn(async move {
            if let Err(e) = fetch_and_broadcast(&solana, &broadcaster, &key).await {
                error!("Error in initial fetch: {:#}", e);
            }
        });
    }

    loop {
        tokio::select! {
            _ = ticker.tick() => {
                let solana_clone = Arc::clone(&solana);
                let broadcaster_clone = Arc::clone(&broadcaster);
                let key_clone = Arc::clone(&signer_private_key);

                tokio::spawn(async move {
                    if let Err(e) = fetch_and_broadcast(&solana_clone, &broadcaster_clone, &key_clone).await {
                        error!("Error in fetch_and_broadcast: {:#}", e);
                    }
                });
            }
            _ = signal::ctrl_c() => {
                info!("\nReceived interrupt signal. Shutting down...");
                break;
            }
        }
    }

    Ok(())
}
