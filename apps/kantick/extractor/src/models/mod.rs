use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockInfo {
    pub slot: u64,
    pub blockhash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignedBlockPayload {
    pub slot: u64,
    #[serde(rename = "sig")]
    pub signature: String,
}
