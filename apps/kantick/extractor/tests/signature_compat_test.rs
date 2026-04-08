use ed25519_dalek::{Keypair, Signer, SecretKey, PublicKey};

#[test]
fn test_signature_compatibility() {
    // Use a valid 32-byte secret key and derive the keypair
    let secret_bytes: [u8; 32] = [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
        17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
    ];

    let secret_key = SecretKey::from_bytes(&secret_bytes)
        .expect("Failed to create secret key");
    let public_key: PublicKey = (&secret_key).into();
    let keypair = Keypair { secret: secret_key, public: public_key };

    let test_blockhash = "9sHcv6xwn9YkB8nxTUGKDwPwNnmqVp5oAXxU8Fdkm4J5";
    let data_bytes = test_blockhash.as_bytes();
    
    let signature = keypair.sign(data_bytes);
    let signature_base58 = bs58::encode(signature.to_bytes()).into_string();

    println!("Test Blockhash: {}", test_blockhash);
    println!("Signature (Base58): {}", signature_base58);
    println!("Signature (Hex): {}", hex::encode(signature.to_bytes()));
    
    assert_eq!(signature.to_bytes().len(), 64, "Signature should be 64 bytes");
}

#[test]
fn test_parse_private_key_from_json() {
    // First generate a valid keypair and get its 64-byte representation
    let secret_bytes: [u8; 32] = [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
        17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32
    ];
    
    let secret_key = SecretKey::from_bytes(&secret_bytes)
        .expect("Failed to create secret key");
    let public_key: PublicKey = (&secret_key).into();
    let keypair = Keypair { secret: secret_key, public: public_key };
    
    // Get the 64-byte representation
    let keypair_bytes = keypair.to_bytes();
    
    // Now test parsing it from JSON
    let key_json = format!("{:?}", keypair_bytes.to_vec());
    let key_bytes: Vec<u8> = serde_json::from_str(&key_json)
        .expect("Failed to parse JSON");
    
    assert_eq!(key_bytes.len(), 64, "Key should be 64 bytes");
    
    let parsed_keypair = Keypair::from_bytes(&key_bytes)
        .expect("Failed to create keypair from parsed bytes");
    
    let test_data = b"test message";
    let signature = parsed_keypair.sign(test_data);
    
    println!("Parsed keypair successfully");
    println!("Keypair bytes JSON: {}", key_json);
    println!("Test signature: {}", bs58::encode(signature.to_bytes()).into_string());
}
