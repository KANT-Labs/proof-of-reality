use anyhow::{Context, Result};
use ed25519_dalek::{Keypair, Signer};
use std::time::Instant;
use tracing::info;
use crate::models::SignedBlockPayload;
use super::{SolanaService, CloudflareBroadcaster};

pub async fn fetch_and_broadcast(
    solana: &SolanaService,
    broadcaster: &CloudflareBroadcaster,
    signer_keypair: &Keypair,
) -> Result<()> {
    let start = Instant::now();
    info!("Executing FetchAndBroadcastExtractorData service...");

    let block_info = solana
        .get_latest_block_info()
        .await
        .context("Error getting latest block info")?;
    
    info!("Fetched block info for slot {}", block_info.slot);

    let data_bytes = block_info.blockhash.as_bytes();
    let signature = signer_keypair.sign(data_bytes);
    let signature_base58 = bs58::encode(signature.to_bytes()).into_string();

    let payload = SignedBlockPayload {
        slot: block_info.slot,
        signature: signature_base58,
    };

    info!("Broadcasting signed block update...");
    broadcaster
        .broadcast(payload)
        .await
        .context("Error broadcasting block update")?;

    let duration = start.elapsed();
    info!(
        "FetchAndBroadcastExtractorData completed successfully in {:?}",
        duration
    );

    Ok(())
}

pub fn parse_private_key(key_str: &str) -> Result<Keypair> {
    let key_bytes: Vec<u8> = serde_json::from_str(key_str)
        .context("Failed to parse private key JSON array")?;
    
    if key_bytes.len() != 64 {
        anyhow::bail!("Private key must be 64 bytes, got {}", key_bytes.len());
    }

    let keypair = Keypair::from_bytes(&key_bytes)
        .map_err(|e| anyhow::anyhow!("Failed to create keypair from bytes: {}", e))?;

    Ok(keypair)
}
