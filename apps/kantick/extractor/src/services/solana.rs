use anyhow::{Context, Result};
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use crate::models::BlockInfo;

pub struct SolanaService {
    client: RpcClient,
}

impl SolanaService {
    pub fn new(rpc_url: String) -> Self {
        Self {
            client: RpcClient::new_with_commitment(
                rpc_url,
                CommitmentConfig::confirmed(),
            )
        }
    }

    pub async fn get_latest_block_info(&self) -> Result<BlockInfo> {
        let latest_blockhash = self.client
            .get_latest_blockhash()
            .await
            .context("Failed to get latest blockhash")?;
        
        let slot = self.client
            .get_slot()
            .await
            .context("Failed to get slot")?;

        Ok(BlockInfo {
            slot,
            blockhash: latest_blockhash.to_string(),
        })
    }
}
