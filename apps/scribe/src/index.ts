import { Buffer } from 'node:buffer';
import { SCRIBE_VERSION } from './constants';
import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  ComputeBudgetProgram,
} from '@solana/web3.js';


export interface Env {
  SOLANA_RPC_URL_WITH_KEY: string;
  WALLET_PRIVATE_KEY: string; // JSON array of numbers
  SLOT_ENCRYPTION_KEY: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { hash } = await request.json() as { hash?: string };

      if (!hash) {
        return new Response(JSON.stringify({ error: 'hash is required' }), {
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        });
      }

      // Initialize Solana connection
      const connection = new Connection(
        env.SOLANA_RPC_URL_WITH_KEY || 'https://api.devnet.solana.com',
        'confirmed'
      );

      // Parse wallet
      let keypair: Keypair;
      try {
        if (env.WALLET_PRIVATE_KEY) {
           const secretKey = new Uint8Array(JSON.parse(env.WALLET_PRIVATE_KEY));
           keypair = Keypair.fromSecretKey(secretKey);
        } else {
           keypair = Keypair.generate();
        }
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid wallet configuration' }), { status: 500 });
      }

      // Mainnet requires Priority Fees to process quickly during congestion
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ 
        units: 300000 
      });
      const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({ 
        microLamports: 10000 // 0.00001 SOL priority fee
      });

      // Memo Program ID: MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr
      const memoProgramId = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
      
      const instruction = new TransactionInstruction({
        keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: true }],
        programId: memoProgramId,
        data: Buffer.from ? Buffer.from(hash, 'utf-8') : new Uint8Array(new TextEncoder().encode(hash)),
      });

      let signature: string | undefined;
      let contextSlot: number | null = null;
      const MAX_RETRIES = 3;
      
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
          const transaction = new Transaction().add(modifyComputeUnits, addPriorityFee, instruction);
          transaction.recentBlockhash = blockhash;
          transaction.feePayer = keypair.publicKey;
          transaction.sign(keypair);

          // We use skipPreflight: true to instantly dispatch without waiting for local simulation.
          // This returns the signature essentially instantly (<500ms).
          signature = await connection.sendRawTransaction(transaction.serialize(), { 
              skipPreflight: true,
              preflightCommitment: 'confirmed'
          });
          
          // Since we aren't polling to find the exact final slot, we'll return the 
          // absolute latest slot that the network was on when we fired the transaction.
          // This acts as a reliable timestamp.
          contextSlot = await connection.getSlot('confirmed');
          
          break; // Success, exit retry loop
        } catch (err: any) {
          if (attempt === MAX_RETRIES) {
            throw new Error(`Failed to write to Solana after ${MAX_RETRIES} attempts: ${err.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }

      if (!signature) {
        throw new Error('Failed to generate signature');
      }

      if (!contextSlot) {
          throw new Error('Failed to retrieve context slot');
      }

      // Use the context slot as the receipt
      const finalSlotStr = contextSlot.toString();

      return new Response(
        JSON.stringify({ version: SCRIBE_VERSION, sig: signature, slot: finalSlotStr }),
        {
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: error.message || 'Internal server error' }),
        {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
        }
      );
    }
  },
};
