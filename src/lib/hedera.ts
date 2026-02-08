// Hedera Testnet + MetaMask helpers (EVM RPC)
// Minimal, no external deps

const HEDERA_TESTNET = {
  chainId: "0x128", // 296
  chainName: "Hedera Testnet",
  rpcUrls: ["https://testnet.hashio.io/api"],
  nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
  blockExplorerUrls: ["https://hashscan.io/testnet"],
} as const;

export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

export function getEthereum(): any | null {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return (window as any).ethereum;
  }
  return null;
}

export async function ensureHederaTestnet() {
  const ethereum = getEthereum();
  // Do not throw if MetaMask is not present; simply no-op so UI can render safely
  if (!ethereum) {
    return;
  }
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
    // 4001 = user rejected
    if (switchErr?.code === 4001) {
      throw new Error("Changement de réseau refusé par l'utilisateur");
    }
    // 4902 = unknown chain
    if (switchErr?.code === 4902) {
      try {
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
      } catch (addErr: any) {
        if (addErr?.code === 4001) {
          throw new Error("Ajout du réseau Hedera refusé par l'utilisateur");
        }
        throw new Error(addErr?.message || "Impossible d'ajouter le réseau Hedera");
      }
    } else {
      throw new Error(switchErr?.message || "Impossible de changer de réseau");
    }
  }
}

export async function connectWallet(): Promise<string> {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error("MetaMask non détecté. Installez l'extension MetaMask.");
  }
  
  try {
    const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts || accounts.length === 0) {
      throw new Error("Aucun compte MetaMask disponible");
    }
    return accounts[0];
  } catch (error: any) {
    // Handle user rejection (code 4001)
    if (error?.code === 4001) {
      throw new Error("Connexion refusée par l'utilisateur");
    }
    // Handle MetaMask not unlocked
    if (error?.code === -32002) {
      throw new Error("MetaMask est verrouillé. Déverrouillez votre portefeuille.");
    }
    throw new Error(error?.message || "Échec de connexion à MetaMask");
  }
}

export async function getSelectedAddress(): Promise<string | null> {
  try {
    const ethereum = getEthereum();
    if (!ethereum) return null;
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
  if (!ethereum) throw new Error("MetaMask not found");
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
  const ethereum = getEthereum();
  if (!ethereum) throw new Error("Aucun portefeuille connecté");

  const from = await getSelectedAddress();
  if (!from) throw new Error("Aucun portefeuille connecté");

  const dataHex = utf8ToHex(JSON.stringify(payload));

  // Build base transaction (self-call)
  const baseTx = { from, to: from, value: "0x0" } as any;

  try {
    const chainId = (await ethereum.request({ method: "eth_chainId" }))?.toLowerCase();

    // Hedera EVM restricts EOA->EOA txns with calldata. If on Hedera, omit data.
    if (chainId === HEDERA_TESTNET.chainId) {
      const txHash: string = await ethereum.request({ method: "eth_sendTransaction", params: [baseTx] });
      return txHash;
    }

    // Other EVM chains: include data
    const txWithData = { ...baseTx, data: dataHex } as any;
    const txHash: string = await ethereum.request({ method: "eth_sendTransaction", params: [txWithData] });
    return txHash;
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("cannot include data") || msg.includes("include data")) {
      // Retry without data as a safe fallback
      const txHash: string = await ethereum.request({ method: "eth_sendTransaction", params: [baseTx] });
      return txHash;
    }
    throw err;
  }
}

export { HEDERA_TESTNET };