use anyhow::{Context, Result};
use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub rpc_address: String,
    pub rpc_private_key: String,
    pub cloudflare_worker_url: String,
    pub cloudflare_auth_key: String,
    pub signer_private_key: String,
}

impl Config {
    pub fn load() -> Result<Self> {
        dotenv::dotenv().ok();

        let rpc_address = env::var("RPC_ADDRESS")
            .context("RPC_ADDRESS is required")?;
        let rpc_private_key = env::var("RPC_PRIVATE_KEY")
            .context("RPC_PRIVATE_KEY is required")?;
        let cloudflare_worker_url = env::var("CLOUDFLARE_WORKER_URL")
            .context("CLOUDFLARE_WORKER_URL is required")?;
        let cloudflare_auth_key = env::var("CLOUDFLARE_AUTH_KEY")
            .context("CLOUDFLARE_AUTH_KEY is required")?;
        let signer_private_key = env::var("SIGNER_PRIVATE_KEY")
            .context("SIGNER_PRIVATE_KEY is required")?;

        Ok(Config {
            rpc_address,
            rpc_private_key,
            cloudflare_worker_url,
            cloudflare_auth_key,
            signer_private_key,
        })
    }

    pub fn rpc_url_with_key(&self) -> String {
        format!("{}?api-key={}", self.rpc_address, self.rpc_private_key)
    }
}
