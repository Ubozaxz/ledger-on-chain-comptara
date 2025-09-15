// Hedera Testnet + MetaMask helpers (EVM RPC)
// Minimal, no external deps

const HEDERA_TESTNET = {
  chainId: "0x128", // 296
  chainName: "Hedera Testnet",
  rpcUrls: ["https://testnet.hashio.io/api"],
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  blockExplorerUrls: ["https://hashscan.io/testnet"],
} as const;

export function getEthereum(): any {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  throw new Error("MetaMask (window.ethereum) introuvable");
}

export async function ensureHederaTestnet() {
  const ethereum = getEthereum();
  try {
    const current = await ethereum.request({ method: "eth_chainId" });
    if (current?.toLowerCase() === HEDERA_TESTNET.chainId) return;
  } catch {
    // continue
  }
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HEDERA_TESTNET.chainId }],
    });
  } catch (switchErr: any) {
    // 4902 = unknown chain
    if (switchErr?.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: HEDERA_TESTNET.chainId,
          chainName: HEDERA_TESTNET.chainName,
          nativeCurrency: HEDERA_TESTNET.nativeCurrency,
          rpcUrls: HEDERA_TESTNET.rpcUrls,
          blockExplorerUrls: HEDERA_TESTNET.blockExplorerUrls,
        }],
      });
      // try switch again
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: HEDERA_TESTNET.chainId }],
      });
    } else {
      throw switchErr;
    }
  }
}

export async function connectWallet(): Promise<string> {
  const ethereum = getEthereum();
  const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts || accounts.length === 0) throw new Error("Aucun compte MetaMask disponible");
  return accounts[0];
}

export async function getSelectedAddress(): Promise<string | null> {
  try {
    const ethereum = getEthereum();
    const accounts: string[] = await ethereum.request({ method: "eth_accounts" });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

function hbarToWeiHex(amount: string): string {
  // parse decimal string to 18-decimal wei BigInt and return 0x hex
  const trimmed = amount.trim();
  if (!trimmed) return "0x0";
  if (!/^\d*(?:\.\d*)?$/.test(trimmed)) throw new Error("Montant invalide");
  const [ints = "0", fracRaw = ""] = trimmed.split(".");
  const DEC = 18n;
  const frac = (fracRaw + "0".repeat(18)).slice(0, 18);
  const intBig = BigInt(ints || "0");
  const fracBig = BigInt(frac || "0");
  const wei = intBig * 10n ** DEC + fracBig;
  return "0x" + wei.toString(16);
}

function utf8ToHex(data: string): string {
  const bytes = new TextEncoder().encode(data);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function getExplorerTxUrl(txHash: string): string {
  return `${HEDERA_TESTNET.blockExplorerUrls[0]}/transaction/${txHash}`;
}

export async function sendHBAR(params: { to: string; amountHBAR: string; dataHex?: string }): Promise<string> {
  const ethereum = getEthereum();
  const from = await getSelectedAddress();
  if (!from) throw new Error("Aucun portefeuille connecté");
  const value = hbarToWeiHex(params.amountHBAR);
  const tx = {
    from,
    to: params.to,
    value,
    ...(params.dataHex ? { data: params.dataHex } : {}),
  } as any;
  const txHash: string = await ethereum.request({ method: "eth_sendTransaction", params: [tx] });
  return txHash;
}

export async function anchorEntryData(payload: Record<string, any>): Promise<string> {
  const from = await getSelectedAddress();
  if (!from) throw new Error("Aucun portefeuille connecté");
  const dataHex = utf8ToHex(JSON.stringify(payload));
  // Self-call with data to anchor payload
  const ethereum = getEthereum();
  const tx = { from, to: from, value: "0x0", data: dataHex } as any;
  const txHash: string = await ethereum.request({ method: "eth_sendTransaction", params: [tx] });
  return txHash;
}

export { HEDERA_TESTNET };