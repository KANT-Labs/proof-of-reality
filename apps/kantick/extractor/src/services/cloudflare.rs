use anyhow::{Context, Result};
use reqwest::Client;
use std::time::Duration;
use crate::models::SignedBlockPayload;

pub struct CloudflareBroadcaster {
    client: Client,
    worker_url: String,
    auth_key: String,
}

impl CloudflareBroadcaster {
    pub fn new(worker_url: String, auth_key: String) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(2))
            .build()
            .context("Failed to build HTTP client")?;

        Ok(Self {
            client,
            worker_url,
            auth_key,
        })
    }

    pub async fn broadcast(&self, payload: SignedBlockPayload) -> Result<()> {
        let response = self
            .client
            .post(&self.worker_url)
            .header("Content-Type", "application/json")
            .header("X-Auth-Key", &self.auth_key)
            .json(&payload)
            .send()
            .await
            .context("Failed to send request to Cloudflare")?;

        response.error_for_status().context("Cloudflare worker returned error status")?;

        Ok(())
    }
}
