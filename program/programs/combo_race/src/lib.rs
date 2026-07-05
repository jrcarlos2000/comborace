//! ComboRace lobby escrow.
//!
//! A lobby is one pool PDA that holds a fixed USDC buy-in from each player in a
//! program-owned vault. Nobody in the lobby can move the funds; the pool authority
//! only records a winner pubkey that was computed off-chain from the TxLINE result,
//! and the winner pulls the whole pot themselves. Winner selection, parimutuel math,
//! and result verification live off-chain by design; this program is escrow only.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

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
}
