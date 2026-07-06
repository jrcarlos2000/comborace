---
title: ComboRace documentation
titleTemplate: false
aside: false
outline: false
lastUpdated: false
prev: false
next: false
---

<div class="cr-home">

<p class="cr-overline">ComboRace documentation</p>

<h1 class="cr-title">ComboRace</h1>

<p class="cr-lead">ComboRace is a live parlay game built on TxLINE, the TxODDS verifiable sports-data oracle on Solana. Each player's car is a soccer parlay, and its position on the track is the live probability that the parlay still cashes, read directly from TxLINE's de-vigged <code>Pct</code> field.</p>

<p class="cr-subhead">These pages cover what the game is, how the odds feed drives the race, and how the pool settles on-chain. Start with the introduction, or jump to the section you need.</p>

<p class="cr-section-label">Guide</p>

<nav class="cr-index">

<a class="cr-row" href="/docs/guide/introduction">
<span class="cr-num">01</span>
<span>
<span class="cr-title-row">Introduction</span>
<span class="cr-desc">What ComboRace is, and the idea behind reading a whole parlay as one moving number.</span>
</span>
</a>

<a class="cr-row" href="/docs/guide/how-it-works">
<span class="cr-num">02</span>
<span>
<span class="cr-title-row">How it works</span>
<span class="cr-desc">The two ways in: watch a recorded race with no wallet, or join a private lobby with a real pool.</span>
</span>
</a>

<a class="cr-row" href="/docs/guide/game-mechanic">
<span class="cr-num">03</span>
<span>
<span class="cr-title-row">The game mechanic</span>
<span class="cr-desc">How position, crashes, and cashes are computed, and when each leg resolves.</span>
</span>
</a>

<a class="cr-row" href="/docs/guide/txline-integration">
<span class="cr-num">04</span>
<span>
<span class="cr-title-row">TxLINE integration</span>
<span class="cr-desc">Which fields place the cars, resolve the legs, and settle the result on-chain.</span>
</span>
</a>

<a class="cr-row" href="/docs/guide/architecture">
<span class="cr-num">05</span>
<span>
<span class="cr-title-row">Architecture</span>
<span class="cr-desc">The single-process service, the SDK and its mock twin, and where settlement runs.</span>
</span>
</a>

<a class="cr-row" href="/docs/guide/roadmap">
<span class="cr-num">06</span>
<span>
<span class="cr-title-row">Roadmap</span>
<span class="cr-desc">What runs today, and the path to real-time play and public devnet settlement.</span>
</span>
</a>

</nav>

<p class="cr-home-foot">The app runs a wallet-free replay at <a href="https://comborace.jrcarlos2000.dev">comborace.jrcarlos2000.dev</a>. Built for the TxODDS World Cup hackathon.</p>

</div>
