// ==========================================================
// Robinhood Chain Token Launch — Frontend App
// ==========================================================
// Chain: Robinhood Chain Testnet (46630)
// Dependencies: ethers.js v6 (loaded via CDN in index.html)
// ==========================================================

// ─── Configuration ──────────────────────────────────────
const CONFIG = {
    chainId: 46630,
    chainIdHex: '0xb62e', // 46630 in hex
    chainName: 'Robinhood Chain Testnet',
    rpcUrl: 'https://rpc.testnet.chain.robinhood.com',         // Public RPC — used for MetaMask network config
    alchemyRpcUrl: 'https://robinhood-testnet.g.alchemy.com/v2/LLcfShXkzvLwjEDQQgw0b', // Alchemy — used only for our internal reads
    blockExplorer: 'https://explorer.testnet.chain.robinhood.com',

    // These should match your deployed contract addresses
    // Set automatically from deploy — override in localStorage if needed
    tokenAddress: localStorage.getItem('TOKEN_ADDRESS') || '0x906a6e30b3e35a6a7838d2d01995da0e62b7c6a6',
    usdcAddress: localStorage.getItem('USDC_ADDRESS') || '0xbf4479C07Dc6fdc6dAa764A0ccA06969e894275F',
    usdcDecimals: 18,  // USDC on Robinhood testnet has 18 decimals!
    uniswapRouter: localStorage.getItem('UNISWAP_V2_ROUTER') || '',
};

// ─── ABI Snippets ───────────────────────────────────────
const TOKEN_ABI = [
    // Read
    'function name() view returns (string)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function totalSupply() view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function TOTAL_SUPPLY() view returns (uint256)',
    'function DEPLOYER_SHARE() view returns (uint256)',
    'function MINTABLE_SHARE() view returns (uint256)',
    'function BATCH_SIZE() view returns (uint256)',
    'function BATCH_PRICE() view returns (uint256)',
    'function TREASURY() view returns (address)',
    'function DEPLOYER() view returns (address)',
    'function usdc() view returns (address)',
    'function totalMinted() view returns (uint256)',
    'function mintPaused() view returns (bool)',
    'function mintingClosed() view returns (bool)',
    'function remainingMintable() view returns (uint256)',
    'function remainingBatches() view returns (uint256)',
    'function contractUSDCBalance() view returns (uint256)',
    // Write
    'function mint(uint256 numBatches)',
    'function setMintPaused(bool paused)',
    'function burnUnminted()',
    'function withdraw(address token, uint256 amount)',
    // Events
    'event Minted(address indexed buyer, uint256 batches, uint256 tokens, uint256 costusdc)',
    'event UnmintedBurned(uint256 amount)',
    'event Withdrawn(address indexed token, address indexed to, uint256 amount)',
    'event MintPauseToggled(bool paused)',
];

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
];

const UNISWAP_V2_ROUTER_ABI = [
    'function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
    'function factory() view returns (address)',
];

// ─── State ──────────────────────────────────────────────
let provider = null;      // MetaMask BrowserProvider (for signing)
let readProvider = null;  // Alchemy JsonRpcProvider (for reliable reads)
let signer = null;
let tokenContract = null;
let tokenReadContract = null;  // Read-only token contract via Alchemy
let usdcContract = null;
let usdcReadContract = null;  // Read-only USDC contract via Alchemy
let userAddress = null;

// ─── DOM Elements ───────────────────────────────────────
const $ = (id) => document.getElementById(id);

const connectBtn      = $('connectBtn');
const walletInfo      = $('walletInfo');
const walletAddress   = $('walletAddress');
const ethBalance      = $('ethBalance');
const usdcBalanceEl   = $('usdcBalance');
const tokenBalanceEl  = $('tokenBalance');

const tabs            = $('tabs');
const adminTab        = $('adminTab');
const mintPage        = $('mintPage');
const adminPage       = $('adminPage');
const deployerSection = $('deployerSection');
const treasurySection = $('treasurySection');

// Mint page
const totalMintedStat = $('totalMintedStat');
const remainingStat   = $('remainingStat');
const batchMinus      = $('batchMinus');
const batchPlus       = $('batchPlus');
const batchInput      = $('batchInput');
const tokensToReceive = $('tokensToReceive');
const totalCost       = $('totalCost');
const mintBtn         = $('mintBtn');
const progressFill    = $('progressFill');
const progressPercent = $('progressPercent');
const progressText    = $('progressText');
const mintStatus      = $('mintStatus');

// Admin page
const mintStatusText  = $('mintStatusText');
const adminRemaining  = $('adminRemaining');
const contractUSDC    = $('contractUSDC');
const lpTokenAmount   = $('lpTokenAmount');
const lpUSDCAmount    = $('lpUSDCAmount');
const lpSlippage      = $('lpSlippage');
const treasuryTokenBal = $('treasuryTokenBal');
const treasuryUSDCBal  = $('treasuryUSDCBal');
const lpStatus        = $('lpStatus');
const explorerLink    = $('explorerLink');

// ─── Initialization ─────────────────────────────────────
async function init() {
    explorerLink.href = CONFIG.blockExplorer;

    // Load saved addresses
    if (CONFIG.tokenAddress) {
        console.log('Using saved token address:', CONFIG.tokenAddress);
    }

    // Check if ethereum is available
    if (typeof window.ethereum === 'undefined') {
        connectBtn.textContent = 'No Wallet Detected';
        connectBtn.disabled = true;
        return;
    }

    // Listen for account/network changes
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    window.ethereum.on('disconnect', handleDisconnect);

    // Event listeners
    connectBtn.addEventListener('click', connectWallet);
    batchMinus.addEventListener('click', () => adjustBatch(-1));
    batchPlus.addEventListener('click', () => adjustBatch(1));
    mintBtn.addEventListener('click', handleMint);
    $('pauseMintBtn').addEventListener('click', () => setPause(true));
    $('unpauseMintBtn').addEventListener('click', () => setPause(false));
    $('burnUnmintedBtn').addEventListener('click', handleBurnUnminted);
    $('withdrawBtn').addEventListener('click', handleWithdraw);
    $('createLPBtn').addEventListener('click', handleCreateLP);

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Auto-connect if previously connected
    if (localStorage.getItem('walletConnected') === 'true') {
        await connectWallet();
    }
}

// ─── Wallet Connection ──────────────────────────────────
async function connectWallet() {
    try {
        // STEP 1: Ensure Robinhood Chain Testnet is added to MetaMask
        await ensureNetwork();

        // STEP 2: Request accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length === 0) return;

        userAddress = accounts[0];

        // STEP 3: Verify we're on the right chain
        let currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
        if (parseInt(currentChainId, 16) !== CONFIG.chainId) {
            await switchToChain();
            // Small delay to let MetaMask finish switching
            await new Promise(r => setTimeout(r, 500));
        }

        // STEP 4: Create provider/signer AFTER network is confirmed
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner();
        // Reliable read provider via Alchemy (bypasses MetaMask's rate-limited public RPC)
        readProvider = new ethers.JsonRpcProvider(CONFIG.alchemyRpcUrl);

        // Update UI immediately
        connectBtn.classList.add('hidden');
        walletInfo.classList.remove('hidden');
        walletAddress.textContent = shortenAddress(userAddress);

        // Initialize contracts with the fresh signer
        initContracts();

        // Refresh all data
        await refreshAll();

        // Show admin tab if deployer or treasury
        await checkAdminAccess();

        localStorage.setItem('walletConnected', 'true');

    } catch (err) {
        console.error('Connection error:', err);
        showMintStatus('error', 'Failed to connect wallet. ' + err.message);
    }
}

// ─── Network Management ─────────────────────────────────
/// Ensures the network is added to MetaMask. Safe to call multiple times.
async function ensureNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: CONFIG.chainIdHex,
                chainName: CONFIG.chainName,
                rpcUrls: [CONFIG.rpcUrl],
                blockExplorerUrls: [CONFIG.blockExplorer],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            }],
        });
    } catch (e) {
        // Error 4001 = user rejected. Other errors = already added (OK).
        if (e.code === 4001) throw e;
        console.log('Network already added or could not add:', e.message);
    }
}

/// Switches to Robinhood Chain Testnet. Call after ensureNetwork().
async function switchToChain() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.chainIdHex }],
        });
    } catch (e) {
        console.warn('Switch failed (may already be on correct chain):', e.message);
    }
}

function initContracts() {
    if (!CONFIG.tokenAddress) {
        console.warn('Token address not set. Use admin panel or localStorage to set.');
        return;
    }
    // Write contracts (via MetaMask signer)
    tokenContract = new ethers.Contract(CONFIG.tokenAddress, TOKEN_ABI, signer);
    // Read contracts (via Alchemy for reliability)
    if (readProvider) {
        tokenReadContract = new ethers.Contract(CONFIG.tokenAddress, TOKEN_ABI, readProvider);
    }

    const usdcAddr = CONFIG.usdcAddress || '';
    if (usdcAddr) {
        usdcContract = new ethers.Contract(usdcAddr, ERC20_ABI, signer);
        if (readProvider) {
            usdcReadContract = new ethers.Contract(usdcAddr, ERC20_ABI, readProvider);
        }
    }
}

// ─── Admin Access Check ─────────────────────────────────
async function checkAdminAccess() {
    const tok = tokenReadContract || tokenContract;
    if (!tok || !userAddress) return;

    try {
        const deployer = await tok.DEPLOYER();
        const treasury = await tok.TREASURY();

        const isDeployer = userAddress.toLowerCase() === deployer.toLowerCase();
        const isTreasury = userAddress.toLowerCase() === treasury.toLowerCase();

        if (isDeployer) {
            deployerSection.classList.remove('hidden');
        }
        if (isTreasury) {
            treasurySection.classList.remove('hidden');
        }
        if (isDeployer || isTreasury) {
            adminTab.style.display = 'block';
        }
    } catch (err) {
        console.error('Admin check error:', err);
    }
}

// ─── Data Refresh ───────────────────────────────────────
async function refreshAll() {
    await Promise.all([
        refreshBalances(),
        refreshMintStats(),
        refreshAdminData(),
    ]);
}

async function refreshBalances() {
    if (!userAddress) return;

    try {
        // ETH balance — use Alchemy read provider for reliability
        const rp = readProvider || provider;
        if (rp) {
            const bal = await rp.getBalance(userAddress);
            ethBalance.textContent = formatEther(bal) + ' ETH';
        }

        // USDC balance — use read contract
        const usdc = usdcReadContract || usdcContract;
        if (usdc) {
            const usdcBal = await usdc.balanceOf(userAddress);
            usdcBalanceEl.textContent = formatUnits(usdcBal, CONFIG.usdcDecimals) + ' USDC';
        }

        // Token balance — use read contract
        const tok = tokenReadContract || tokenContract;
        if (tok) {
            const tokenBal = await tok.balanceOf(userAddress);
            tokenBalanceEl.textContent = formatUnits(tokenBal, 6) + ' VTB';
        }
    } catch (err) {
        console.error('Balance refresh error:', err);
    }
}

async function refreshMintStats() {
    const tok = tokenReadContract || tokenContract;
    if (!tok) {
        if (userAddress) {
            mintBtn.textContent = 'Mint VTB';
            mintBtn.disabled = false;
            updateMintSummary();
        }
        return;
    }

    try {
        const totalMinted = await tok.totalMinted();
        const remaining   = await tok.remainingMintable();
        const mintableAll = await tok.MINTABLE_SHARE();
        const paused      = await tok.mintPaused();
        const closed      = await tok.mintingClosed();

        const totalMintedNum = Number(ethers.formatUnits(totalMinted, 6));
        const remainingNum   = Number(ethers.formatUnits(remaining, 6));
        const mintableNum    = Number(ethers.formatUnits(mintableAll, 6));
        const percent        = mintableNum > 0 ? (totalMintedNum / mintableNum * 100) : 0;

        totalMintedStat.textContent = formatNum(totalMintedNum) + ' VTB';
        remainingStat.textContent   = formatNum(remainingNum) + ' VTB';
        progressFill.style.width    = percent.toFixed(1) + '%';
        progressPercent.textContent = percent.toFixed(1) + '%';
        progressText.textContent    = formatNum(totalMintedNum) + ' / ' + formatNum(mintableNum) + ' tokens minted';

        // Update mint button state
        if (!userAddress) {
            mintBtn.textContent = 'Connect Wallet to Mint';
            mintBtn.disabled = true;
        } else if (closed) {
            mintBtn.textContent = 'Minting Closed';
            mintBtn.disabled = true;
        } else if (paused) {
            mintBtn.textContent = 'Minting Paused';
            mintBtn.disabled = true;
        } else if (remainingNum === 0) {
            mintBtn.textContent = 'Sold Out';
            mintBtn.disabled = true;
        } else {
            mintBtn.textContent = 'Mint VTB';
            mintBtn.disabled = false;
            updateMintSummary();
        }
    } catch (err) {
        console.error('Mint stats refresh error:', err);
        // Even on error, enable button if wallet is connected
        if (userAddress) {
            mintBtn.textContent = 'Mint VTB';
            mintBtn.disabled = false;
            updateMintSummary();
        }
    }
}

async function refreshAdminData() {
    const tok = tokenReadContract || tokenContract;
    if (!tok) return;

    try {
        // Deployer section — use read contract
        const paused = await tok.mintPaused();
        const closed = await tok.mintingClosed();
        const remaining = await tok.remainingMintable();

        mintStatusText.textContent = closed ? 'Permanently Closed' : (paused ? 'Paused' : 'Active');
        mintStatusText.style.color = closed ? 'var(--danger)' : (paused ? 'var(--warning)' : 'var(--success)');

        adminRemaining.textContent = formatUnits(remaining, 6) + ' VTB';

        // Update pause button states
        $('pauseMintBtn').disabled = paused || closed;
        $('unpauseMintBtn').disabled = !paused || closed;
        $('burnUnmintedBtn').disabled = closed;

        // Treasury section
        const contractBal = await tok.contractUSDCBalance();
        contractUSDC.textContent = formatUnits(contractBal, CONFIG.usdcDecimals) + ' USDC';

        // Treasury wallet balances
        const treasury = await tok.TREASURY();
        const usdc = usdcReadContract || usdcContract;
        if (usdc) {
            const tTokenBal = await tok.balanceOf(treasury);
            const tUSDCBal  = await usdc.balanceOf(treasury);
            treasuryTokenBal.textContent = 'Treasury balance: ' + formatUnits(tTokenBal, 6) + ' VTB';
            treasuryUSDCBal.textContent  = 'Treasury balance: ' + formatUnits(tUSDCBal, CONFIG.usdcDecimals) + ' USDC';
        }
    } catch (err) {
        console.error('Admin data refresh error:', err);
    }
}

// ─── Mint Logic ─────────────────────────────────────────
function adjustBatch(delta) {
    let val = parseInt(batchInput.value) + delta;
    val = Math.max(1, Math.min(100, val));
    batchInput.value = val;
    updateMintSummary();
}

function updateMintSummary() {
    const batches = parseInt(batchInput.value) || 1;
    tokensToReceive.textContent = formatNum(batches * 10_000) + ' VTB';
    totalCost.textContent = (batches * 2).toFixed(2) + ' usdc';
}

async function handleMint() {
    if (!tokenContract || !usdcContract || !userAddress) return;

    const batches = parseInt(batchInput.value) || 1;
    const costWei = ethers.parseUnits((batches * 2).toString(), CONFIG.usdcDecimals);

    try {
        // Step 1: Check allowance (use read contract for reliability)
        mintBtn.disabled = true;
        mintBtn.textContent = 'Checking allowance...';

        const usdcRead = usdcReadContract || usdcContract;
        const allowance = await usdcRead.allowance(userAddress, CONFIG.tokenAddress);
        if (allowance < costWei) {
            mintBtn.textContent = 'Approving USDC...';
            showMintStatus('pending', 'Please approve USDC spending in your wallet...');

            const approveTx = await usdcContract.approve(CONFIG.tokenAddress, costWei);
            showMintStatus('pending', 'Approval pending... TX: ' + shortenTx(approveTx.hash));
            await approveTx.wait();
        }

        // Step 2: Mint
        mintBtn.textContent = 'Confirm in wallet...';
        showMintStatus('pending', 'Please confirm the mint transaction...');

        const tx = await tokenContract.mint(batches);
        showMintStatus('pending', 'Minting... TX: ' + shortenTx(tx.hash));
        await tx.wait();

        showMintStatus('success', `Successfully minted ${formatNum(batches * 10_000)} VTB!`);
        mintBtn.textContent = 'Mint More';
        mintBtn.disabled = false;

        await refreshAll();

    } catch (err) {
        console.error('Mint error:', err);
        const msg = err.reason || err.message || 'Transaction failed';
        showMintStatus('error', 'Mint failed: ' + msg);
        mintBtn.disabled = false;
        updateMintSummary();
    }
}

function showMintStatus(type, message) {
    mintStatus.classList.remove('hidden', 'success', 'error', 'pending');
    mintStatus.classList.add(type);
    mintStatus.textContent = message;
}

// ─── Admin Logic ────────────────────────────────────────
async function setPause(paused) {
    if (!tokenContract) return;
    try {
        const tx = await tokenContract.setMintPaused(paused);
        showLpStatus('pending', 'Transaction pending... ' + shortenTx(tx.hash));
        await tx.wait();
        showLpStatus('success', paused ? 'Minting paused.' : 'Minting unpaused.');
        await refreshAll();
    } catch (err) {
        console.error(err);
        showLpStatus('error', 'Failed: ' + (err.reason || err.message));
    }
}

async function handleBurnUnminted() {
    if (!tokenContract) return;

    const confirmed = confirm(
        '⚠️ WARNING: This will PERMANENTLY close minting and burn ALL remaining unminted tokens.\n\n' +
        'This action CANNOT be undone. Are you absolutely sure?'
    );
    if (!confirmed) return;

    const doubleCheck = confirm('Final confirmation: Type OK in the next dialog. This is IRREVERSIBLE.');
    if (!doubleCheck) return;

    try {
        const tx = await tokenContract.burnUnminted();
        showLpStatus('pending', 'Burning unminted... ' + shortenTx(tx.hash));
        await tx.wait();
        showLpStatus('success', 'Minting permanently closed. Unminted tokens burned.');
        await refreshAll();
    } catch (err) {
        console.error(err);
        showLpStatus('error', 'Failed: ' + (err.reason || err.message));
    }
}

async function handleWithdraw() {
    if (!tokenContract) return;
    try {
        const balance = await tokenContract.contractUSDCBalance();
        if (balance === 0n) {
            showLpStatus('error', 'No usdc in contract to withdraw.');
            return;
        }

        const tx = await tokenContract.withdraw(CONFIG.usdcAddress || await tokenContract.USDC(), balance);
        showLpStatus('pending', 'Withdrawing... ' + shortenTx(tx.hash));
        await tx.wait();
        showLpStatus('success', 'usdc withdrawn to treasury.');
        await refreshAll();
    } catch (err) {
        console.error(err);
        showLpStatus('error', 'Failed: ' + (err.reason || err.message));
    }
}

async function handleCreateLP() {
    if (!tokenContract || !CONFIG.uniswapRouter) {
        showLpStatus('error', 'Uniswap Router address not configured.');
        return;
    }

    const tokenAmt = lpTokenAmount.value.trim();
    const usdcAmt  = lpUSDCAmount.value.trim();
    const slippage = parseFloat(lpSlippage.value) || 5;

    if (!tokenAmt || !usdcAmt) {
        showLpStatus('error', 'Enter both token and usdc amounts.');
        return;
    }

    try {
        const router = new ethers.Contract(CONFIG.uniswapRouter, UNISWAP_V2_ROUTER_ABI, signer);

        const tokenAmtWei = ethers.parseUnits(tokenAmt, 6);
        const usdcAmtWei  = ethers.parseUnits(usdcAmt, 6);

        // Slippage: minimum amounts
        const tokenMin = tokenAmtWei * BigInt(Math.floor((100 - slippage) * 10)) / 1000n;
        const usdcMin  = usdcAmtWei  * BigInt(Math.floor((100 - slippage) * 10)) / 1000n;

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 min

        // Step 1: Approve token
        showLpStatus('pending', 'Approving token...');
        const tokenContractWrite = new ethers.Contract(CONFIG.tokenAddress, ERC20_ABI, signer);
        const tokenAllowance = await tokenContractWrite.allowance(userAddress, CONFIG.uniswapRouter);
        if (tokenAllowance < tokenAmtWei) {
            const approveTx = await tokenContractWrite.approve(CONFIG.uniswapRouter, tokenAmtWei);
            await approveTx.wait();
        }

        // Step 2: Approve usdc
        const usdcAllowance = await usdcContract.allowance(userAddress, CONFIG.uniswapRouter);
        if (usdcAllowance < usdcAmtWei) {
            showLpStatus('pending', 'Approving usdc...');
            const approveTx = await usdcContract.approve(CONFIG.uniswapRouter, usdcAmtWei);
            await approveTx.wait();
        }

        // Step 3: Add liquidity
        showLpStatus('pending', 'Creating liquidity pool...');
        const tx = await router.addLiquidity(
            CONFIG.tokenAddress,
            CONFIG.usdcAddress,
            tokenAmtWei,
            usdcAmtWei,
            tokenMin,
            usdcMin,
            userAddress, // LP tokens go to treasury
            deadline
        );

        showLpStatus('pending', 'LP creation pending... ' + shortenTx(tx.hash));
        const receipt = await tx.wait();

        showLpStatus('success', `Liquidity pool created! TX: ${shortenTx(tx.hash)}`);
        await refreshAll();

    } catch (err) {
        console.error('LP creation error:', err);
        const msg = err.reason || err.message || 'Transaction failed';
        showLpStatus('error', 'LP creation failed: ' + msg);
    }
}

function showLpStatus(type, message) {
    lpStatus.classList.remove('hidden', 'success', 'error', 'pending');
    lpStatus.classList.add(type);
    lpStatus.textContent = message;
}

// ─── Tab Switching ──────────────────────────────────────
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

    if (tabName === 'mint') {
        document.querySelector('.tab[data-tab="mint"]').classList.add('active');
        mintPage.classList.add('active');
    } else if (tabName === 'admin') {
        document.querySelector('.tab[data-tab="admin"]').classList.add('active');
        adminPage.classList.add('active');
        refreshAdminData();
    }
}

// ─── Event Handlers ─────────────────────────────────────
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        handleDisconnect();
    } else {
        userAddress = accounts[0];
        provider = new ethers.BrowserProvider(window.ethereum);
        provider.getSigner().then(s => signer = s);
        walletAddress.textContent = shortenAddress(userAddress);
        initContracts();
        refreshAll();
        checkAdminAccess();
    }
}

function handleChainChanged() {
    // Reload on chain change
    window.location.reload();
}

function handleDisconnect() {
    userAddress = null;
    signer = null;
    tokenContract = null;
    usdcContract = null;
    connectBtn.classList.remove('hidden');
    walletInfo.classList.add('hidden');
    deployerSection.classList.add('hidden');
    treasurySection.classList.add('hidden');
    adminTab.style.display = 'none';
    switchTab('mint');
    mintBtn.textContent = 'Connect Wallet to Mint';
    mintBtn.disabled = true;
    localStorage.removeItem('walletConnected');
}

// ─── Utility Functions ──────────────────────────────────
function shortenAddress(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function shortenTx(hash) {
    if (!hash) return '';
    return hash.slice(0, 10) + '...';
}

function formatEther(wei) {
    return Number(ethers.formatEther(wei)).toFixed(4);
}

function formatUnits(wei, decimals) {
    return Number(ethers.formatUnits(wei, decimals)).toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

function formatNum(num) {
    return num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

// ─── Admin: Save Contract Addresses ─────────────────────
// Exposed globally for console use
window.setTokenAddress = function(addr) {
    CONFIG.tokenAddress = addr;
    localStorage.setItem('TOKEN_ADDRESS', addr);
    console.log('Token address set to:', addr);
    initContracts();
};

window.setusdcAddress = function(addr) {
    CONFIG.usdcAddress = addr;
    localStorage.setItem('usdc_ADDRESS', addr);
    console.log('usdc address set to:', addr);
    initContracts();
};

window.setUniswapRouter = function(addr) {
    CONFIG.uniswapRouter = addr;
    localStorage.setItem('UNISWAP_V2_ROUTER', addr);
    console.log('Uniswap Router set to:', addr);
};

// ─── Boot ───────────────────────────────────────────────
init();
