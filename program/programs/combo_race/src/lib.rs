//! ComboRace lobby escrow.
//!
//! A lobby is one pool PDA that holds a fixed USDC buy-in from each player in a
//! program-owned vault. Nobody in the lobby can move the funds; the pool authority
//! only records a winner pubkey that was computed off-chain from the TxLINE result,
//! and the winner pulls the whole pot themselves. Winner selection, parimutuel math,
//! and result verification live off-chain by design; this program is escrow only.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{get_return_data, invoke};
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("2R3oZhzqf1gS37FAikN5zBZYGVbLnhQw5unR7JWnHiz4");

/// TxLINE "txoracle" program (devnet). CPI target for on-chain score verification.
pub const TXORACLE_PROGRAM_ID: Pubkey = pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
/// Anchor discriminator for TxLINE `validate_stat` (from the on-chain IDL).
pub const VALIDATE_STAT_DISC: [u8; 8] = [107, 197, 232, 90, 191, 136, 105, 185];

// comparison codes, mirror TxLINE's Comparison enum (0 GreaterThan, 1 LessThan, 2 EqualTo).
pub const CMP_GT: u8 = 0;
pub const CMP_LT: u8 = 1;
pub const CMP_EQ: u8 = 2;

#[program]
pub mod combo_race {
    use super::*;

    pub fn init_pool(ctx: Context<InitPool>, pool_id: u64, buy_in: u64) -> Result<()> {
        require!(buy_in > 0, ComboRaceError::InvalidBuyIn);

        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.usdc_mint = ctx.accounts.usdc_mint.key();
        pool.vault = ctx.accounts.vault.key();
        pool.pool_id = pool_id;
        pool.buy_in = buy_in;
        pool.total_deposited = 0;
        pool.player_count = 0;
        pool.status = PoolStatus::Open;
        pool.winner = Pubkey::default();
        pool.bump = ctx.bumps.pool;
        pool.vault_bump = ctx.bumps.vault;
        pool.verified = false;
        pool.verified_outcome = false;
        pool.question_set = false;
        pool.fixture_id = 0;
        pool.stat_key = 0;
        pool.period = 0;
        pool.threshold = 0;
        pool.comparison = 0;
        pool.winner_if_true = Pubkey::default();
        pool.winner_if_false = Pubkey::default();
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>) -> Result<()> {
        require!(
            ctx.accounts.pool.status == PoolStatus::Open,
            ComboRaceError::PoolNotOpen
        );

        let buy_in = ctx.accounts.pool.buy_in;
        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.player_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        );
        token::transfer(cpi, buy_in)?;

        let entry = &mut ctx.accounts.entry;
        entry.pool = ctx.accounts.pool.key();
        entry.player = ctx.accounts.player.key();
        entry.amount = buy_in;
        entry.bump = ctx.bumps.entry;

        let pool = &mut ctx.accounts.pool;
        pool.total_deposited = pool
            .total_deposited
            .checked_add(buy_in)
            .ok_or(ComboRaceError::MathOverflow)?;
        pool.player_count = pool
            .player_count
            .checked_add(1)
            .ok_or(ComboRaceError::MathOverflow)?;
        Ok(())
    }

    pub fn settle(ctx: Context<Settle>, winner: Pubkey) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        require!(pool.status == PoolStatus::Open, ComboRaceError::PoolNotOpen);
        pool.winner = winner;
        pool.status = PoolStatus::Settled;
        Ok(())
    }

    /// Pin the on-chain question this pool settles against, so a later `settle_verified`
    /// can only PROVE the answer, not change what is being asked. Set once by the authority
    /// while the pool is still open. `winner_if_true` is the wallet paid when the oracle
    /// proves the predicate holds; `winner_if_false` when it does not.
    pub fn set_question(
        ctx: Context<SetQuestion>,
        fixture_id: i64,
        stat_key: u32,
        period: i32,
        threshold: i32,
        comparison: u8,
        winner_if_true: Pubkey,
        winner_if_false: Pubkey,
    ) -> Result<()> {
        require!(comparison <= CMP_EQ, ComboRaceError::BadQuestion);
        let pool = &mut ctx.accounts.pool;
        require!(pool.status == PoolStatus::Open, ComboRaceError::PoolNotOpen);
        pool.question_set = true;
        pool.fixture_id = fixture_id;
        pool.stat_key = stat_key;
        pool.period = period;
        pool.threshold = threshold;
        pool.comparison = comparison;
        pool.winner_if_true = winner_if_true;
        pool.winner_if_false = winner_if_false;
        Ok(())
    }

    /// Trustless settlement: CPI into TxLINE `validate_stat` with a Merkle proof supplied by
    /// the caller, and set the winner from the bool the oracle returns after verifying the
    /// proof against ITS OWN on-chain daily-scores root. The proof is bound to the pool's
    /// pinned question (fixture / stat key / period / threshold / comparison) so the settler
    /// cannot swap the question, only prove its answer. No off-chain score is trusted here.
    pub fn settle_verified(ctx: Context<SettleVerified>, args: ValidateStatArgs) -> Result<()> {
        let pool = &ctx.accounts.pool;
        require!(pool.status == PoolStatus::Open, ComboRaceError::PoolNotOpen);
        require!(pool.question_set, ComboRaceError::QuestionNotSet);

        // ---- bind the proof to THIS pool's pinned question ----
        require!(
            args.fixture_summary.fixture_id == pool.fixture_id,
            ComboRaceError::FixtureMismatch
        );
        require!(
            args.predicate.threshold == pool.threshold,
            ComboRaceError::PredicateMismatch
        );
        require!(
            cmp_code(&args.predicate.comparison) == pool.comparison,
            ComboRaceError::PredicateMismatch
        );
        require!(
            args.stat_a.stat_to_prove.key == pool.stat_key,
            ComboRaceError::PredicateMismatch
        );
        require!(
            args.stat_a.stat_to_prove.period == pool.period,
            ComboRaceError::PredicateMismatch
        );
        // this pool asks a single-stat question; reject a smuggled second term.
        require!(args.stat_b.is_none(), ComboRaceError::PredicateMismatch);
        require!(args.op.is_none(), ComboRaceError::PredicateMismatch);
        // ts passed to the oracle must equal the batch min_timestamp it verifies against.
        require!(
            args.ts == args.fixture_summary.update_stats.min_timestamp,
            ComboRaceError::PredicateMismatch
        );

        // ---- CPI into TxLINE validate_stat ----
        require_keys_eq!(
            ctx.accounts.txoracle_program.key(),
            TXORACLE_PROGRAM_ID,
            ComboRaceError::BadOracle
        );
        let mut data = Vec::with_capacity(600);
        data.extend_from_slice(&VALIDATE_STAT_DISC);
        args.serialize(&mut data)?;
        let ix = Instruction {
            program_id: TXORACLE_PROGRAM_ID,
            accounts: vec![AccountMeta::new_readonly(
                ctx.accounts.daily_scores_merkle_roots.key(),
                false,
            )],
            data,
        };
        invoke(
            &ix,
            &[
                ctx.accounts.daily_scores_merkle_roots.to_account_info(),
                ctx.accounts.txoracle_program.to_account_info(),
            ],
        )?;

        // ---- read the bool the oracle set via return data ----
        let (ret_program, ret) = get_return_data().ok_or(ComboRaceError::NoOracleResult)?;
        require_keys_eq!(ret_program, TXORACLE_PROGRAM_ID, ComboRaceError::BadOracle);
        let predicate_true = matches!(ret.first(), Some(1));

        let pool = &mut ctx.accounts.pool;
        pool.winner = if predicate_true {
            pool.winner_if_true
        } else {
            pool.winner_if_false
        };
        pool.verified = true;
        pool.verified_outcome = predicate_true;
        pool.status = PoolStatus::Settled;
        Ok(())
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        require!(
            ctx.accounts.pool.status == PoolStatus::Settled,
            ComboRaceError::PoolNotSettled
        );
        require_keys_eq!(
            ctx.accounts.winner.key(),
            ctx.accounts.pool.winner,
            ComboRaceError::NotWinner
        );

        let amount = ctx.accounts.vault.amount;
        let authority = ctx.accounts.pool.authority;
        let pool_id = ctx.accounts.pool.pool_id.to_le_bytes();
        let bump = ctx.accounts.pool.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"pool",
            authority.as_ref(),
            pool_id.as_ref(),
            core::slice::from_ref(&bump),
        ]];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.winner_token.to_account_info(),
                authority: ctx.accounts.pool.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(cpi, amount)?;

        ctx.accounts.pool.status = PoolStatus::Paid;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct InitPool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [b"pool", authority.key().as_ref(), &pool_id.to_le_bytes()],
        bump
    )]
    pub pool: Account<'info, Pool>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        seeds = [b"vault", pool.key().as_ref()],
        bump,
        token::mint = usdc_mint,
        token::authority = pool
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.authority.as_ref(), &pool.pool_id.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,

    // One entry per (pool, player). init fails on a second deposit from the same wallet.
    #[account(
        init,
        payer = player,
        space = 8 + Entry::INIT_SPACE,
        seeds = [b"entry", pool.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub entry: Account<'info, Entry>,

    #[account(
        mut,
        constraint = player_token.mint == pool.usdc_mint @ ComboRaceError::InvalidMint,
        constraint = player_token.owner == player.key() @ ComboRaceError::InvalidOwner
    )]
    pub player_token: Account<'info, TokenAccount>,

    #[account(mut, address = pool.vault @ ComboRaceError::InvalidVault)]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ ComboRaceError::Unauthorized,
        seeds = [b"pool", pool.authority.as_ref(), &pool.pool_id.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
}

#[derive(Accounts)]
pub struct SetQuestion<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ ComboRaceError::Unauthorized,
        seeds = [b"pool", pool.authority.as_ref(), &pool.pool_id.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,
}

#[derive(Accounts)]
pub struct SettleVerified<'info> {
    /// Anyone may settle-verify: the oracle proof is the authority, not this signer.
    pub settler: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.authority.as_ref(), &pool.pool_id.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,

    /// CHECK: TxLINE daily-scores root PDA; validated inside the CPI to validate_stat.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,

    /// CHECK: must be the TxLINE oracle program; enforced by address before the CPI.
    #[account(address = TXORACLE_PROGRAM_ID @ ComboRaceError::BadOracle)]
    pub txoracle_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", pool.authority.as_ref(), &pool.pool_id.to_le_bytes()],
        bump = pool.bump
    )]
    pub pool: Account<'info, Pool>,

    #[account(mut, address = pool.vault @ ComboRaceError::InvalidVault)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = winner_token.mint == pool.usdc_mint @ ComboRaceError::InvalidMint,
        constraint = winner_token.owner == winner.key() @ ComboRaceError::InvalidOwner
    )]
    pub winner_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub authority: Pubkey,
    pub usdc_mint: Pubkey,
    pub vault: Pubkey,
    pub pool_id: u64,
    pub buy_in: u64,
    pub total_deposited: u64,
    pub player_count: u32,
    pub status: PoolStatus,
    pub winner: Pubkey,
    pub bump: u8,
    pub vault_bump: u8,
    // ---- TxLINE-verified settlement (settle_verified path) ----
    /// True once the winner was set from a TxLINE `validate_stat` on-chain proof.
    pub verified: bool,
    /// The bool the oracle returned (predicate held or not) at verified settlement.
    pub verified_outcome: bool,
    /// True once a question has been pinned for this pool via `set_question`.
    pub question_set: bool,
    pub fixture_id: i64,
    pub stat_key: u32,
    pub period: i32,
    pub threshold: i32,
    /// 0 GreaterThan, 1 LessThan, 2 EqualTo (mirrors TxLINE Comparison).
    pub comparison: u8,
    pub winner_if_true: Pubkey,
    pub winner_if_false: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct Entry {
    pub pool: Pubkey,
    pub player: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PoolStatus {
    Open,
    Settled,
    Paid,
}

// ===================== TxLINE validate_stat args (borsh mirror) =====================
// Exact field order / types of TxLINE's on-chain `validate_stat` instruction
// (see idl/txline_devnet.json). Serialized after VALIDATE_STAT_DISC and passed
// straight through the CPI so the oracle can verify the Merkle proof itself.

fn cmp_code(c: &Comparison) -> u8 {
    match c {
        Comparison::GreaterThan => CMP_GT,
        Comparison::LessThan => CMP_LT,
        Comparison::EqualTo => CMP_EQ,
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ValidateStatArgs {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub predicate: TraderPredicate,
    pub stat_a: StatTerm,
    pub stat_b: Option<StatTerm>,
    pub op: Option<BinaryExpression>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[error_code]
pub enum ComboRaceError {
    #[msg("Buy-in must be greater than zero")]
    InvalidBuyIn,
    #[msg("Pool is not open for deposits")]
    PoolNotOpen,
    #[msg("Pool has not been settled")]
    PoolNotSettled,
    #[msg("Signer is not the pool authority")]
    Unauthorized,
    #[msg("Signer is not the settled winner")]
    NotWinner,
    #[msg("Vault does not match the pool")]
    InvalidVault,
    #[msg("Token account mint does not match the pool USDC mint")]
    InvalidMint,
    #[msg("Token account owner does not match the signer")]
    InvalidOwner,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Invalid question parameters")]
    BadQuestion,
    #[msg("Pool has no pinned question to verify against")]
    QuestionNotSet,
    #[msg("Proof fixture does not match the pool question")]
    FixtureMismatch,
    #[msg("Proof predicate does not match the pool question")]
    PredicateMismatch,
    #[msg("Invalid TxLINE oracle program")]
    BadOracle,
    #[msg("Oracle returned no result")]
    NoOracleResult,
}
