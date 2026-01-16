import { getEthereum, ensureHederaTestnet, HEDERA_TESTNET } from './hedera';

export type WalletType = 'metamask' | 'hashpack' | 'trust';

export interface WalletInfo {
  type: WalletType;
  address: string;
  connected: boolean;
}

// Check if running on mobile
export const isMobile = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Check if we're in a wallet's in-app browser
export const isInWalletBrowser = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('metamask') || ua.includes('trust') || ua.includes('tokenpocket');
};

// Check if Trust Wallet is available
export const isTrustWalletAvailable = (): boolean => {
  if (typeof window === 'undefined') return false;
  const { trustwallet, ethereum } = window as any;
  return !!(
    trustwallet ||
    ethereum?.isTrust ||
    ethereum?.isTrustWallet ||
    ethereum?.isTrustWalletApp
  );
};

// Get Trust Wallet provider
export const getTrustWalletProvider = (): any => {
  if (typeof window === 'undefined') return null;
  const { trustwallet, ethereum } = window as any;
  if (trustwallet) return trustwallet;
  if (ethereum?.isTrust || ethereum?.isTrustWallet || ethereum?.isTrustWalletApp) return ethereum;
  return null;
};

// Connect Trust Wallet - handles both extension and mobile
export const connectTrustWallet = async (): Promise<string> => {
  const provider = getTrustWalletProvider();

  // If provider is available (in-app browser or extension), use it directly
  if (provider) {
    try {
      // Switch to Hedera Testnet
      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: HEDERA_TESTNET.chainId }],
        });
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: HEDERA_TESTNET.chainId,
              chainName: HEDERA_TESTNET.chainName,
              nativeCurrency: HEDERA_TESTNET.nativeCurrency,
              rpcUrls: HEDERA_TESTNET.rpcUrls,
              blockExplorerUrls: HEDERA_TESTNET.blockExplorerUrls,
            }],
          });
        }
      }

      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        return accounts[0];
      }
      throw new Error('Aucun compte sélectionné');
    } catch (error: any) {
      if (error.code === 4001) {
        throw new Error('Connexion refusée par l\'utilisateur');
      }
      throw error;
    }
  }

  // On mobile without provider: user needs to open in Trust Wallet browser
  if (isMobile()) {
    throw new Error('Ouvrez ce site dans le navigateur de Trust Wallet pour vous connecter.');
  }

  throw new Error('Trust Wallet non détecté. Installez l\'extension Trust Wallet.');
};

// Get Trust Wallet address if connected
export const getTrustWalletAddress = async (): Promise<string | null> => {
  const provider = getTrustWalletProvider();
  if (!provider) return null;
  
  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    return accounts?.[0] || null;
  } catch {
    return null;
  }
};

// MetaMask wallet functions
export const connectMetaMask = async (): Promise<string> => {
  const ethereum = getEthereum();

  // If provider is available, use it directly
  if (ethereum) {
    await ensureHederaTestnet();
    const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    return accounts[0];
  }

  // On mobile without provider: user needs to open in MetaMask browser
  if (isMobile()) {
    throw new Error('Ouvrez ce site dans le navigateur de MetaMask pour vous connecter.');
  }

  throw new Error('MetaMask non détecté. Installez l\'extension MetaMask.');
};

export const getMetaMaskAddress = async (): Promise<string | null> => {
  const ethereum = getEthereum();
  if (!ethereum) return null;

  try {
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    return accounts.length > 0 ? accounts[0] : null;
  } catch {
    return null;
  }
};

// HashPack wallet functions
export const connectHashPack = async (): Promise<string> => {
  // Check if HashConnect is available
  if (typeof window !== 'undefined' && (window as any).hashconnect) {
    const hashconnect = (window as any).hashconnect;
    
    try {
      // Initialize HashConnect if not already done
      if (!hashconnect.connectionState) {
        await hashconnect.init({
          appMetadata: {
            name: "Comptara",
            description: "Blockchain Accounting Platform",
            icon: "https://comptara.com/icon.png"
          },
          network: "testnet"
        });
      }

      // Check if already connected
      if (hashconnect.connectionState && hashconnect.connectionState.accountIds && hashconnect.connectionState.accountIds.length > 0) {
        return hashconnect.connectionState.accountIds[0];
      }

      // Find available HashPack extensions
      const foundExtensionData = await hashconnect.findLocalWallets();
      
      if (foundExtensionData.length === 0) {
        // Fallback: try direct connection or prompt manual connection
        const manualAccountId = prompt('HashPack non détecté. Entrez manuellement votre Account ID Hedera (format: 0.0.xxxxx):');
        if (manualAccountId && /^0\.0\.\d+$/.test(manualAccountId)) {
          // Store manual connection in localStorage
          localStorage.setItem('hashpack_manual_account', manualAccountId);
          return manualAccountId;
        }
        throw new Error('HashPack wallet not found and no valid manual Account ID provided');
      }

      // Connect to HashPack
      const connectionData = await hashconnect.connectToLocalWallet(foundExtensionData[0].id);
      
      if (connectionData.accountIds && connectionData.accountIds.length > 0) {
        // Clear any manual connection
        localStorage.removeItem('hashpack_manual_account');
        return connectionData.accountIds[0];
      }
      
      throw new Error('No accounts found in HashPack');
    } catch (error) {
      console.error('HashPack connection error:', error);
      throw error;
    }
  } else {
    // Manual connection fallback
    const manualAccountId = prompt('HashPack non installé. Entrez manuellement votre Account ID Hedera (format: 0.0.xxxxx):');
    if (manualAccountId && /^0\.0\.\d+$/.test(manualAccountId)) {
      localStorage.setItem('hashpack_manual_account', manualAccountId);
      return manualAccountId;
    }
    throw new Error('HashPack non disponible. Installez l\'extension HashPack pour Hedera.');
  }
};

export const getHashPackAddress = async (): Promise<string | null> => {
  // Check manual connection first
  const manualAccount = localStorage.getItem('hashpack_manual_account');
  if (manualAccount && /^0\.0\.\d+$/.test(manualAccount)) {
    return manualAccount;
  }

  if (typeof window !== 'undefined' && (window as any).hashconnect) {
    try {
      const hashconnect = (window as any).hashconnect;
      const connectionState = hashconnect.connectionState;
      
      if (connectionState && connectionState.accountIds && connectionState.accountIds.length > 0) {
        return connectionState.accountIds[0];
      }
    } catch {
      // Silent fail
    }
  }
  return null;
};

// Transaction signing functions
export const signTransactionMetaMask = async (params: {
  to: string;
  value: string;
  data?: string;
}): Promise<string> => {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('MetaMask not found');
  }

  await ensureHederaTestnet();
  
  const txParams = {
    to: params.to,
    value: params.value,
    data: params.data || '0x',
    gasLimit: '0x5208',
  };

  return await ethereum.request({
    method: 'eth_sendTransaction',
    params: [txParams],
  });
};

export const signTransactionHashPack = async (params: {
  to: string;
  amount: string;
  memo?: string;
}): Promise<string> => {
  if (typeof window !== 'undefined' && (window as any).hashconnect) {
    const hashconnect = (window as any).hashconnect;
    
    try {
      const transaction = {
        type: 'cryptoTransfer',
        transfers: [
          {
            accountId: params.to,
            amount: params.amount
          }
        ],
        memo: params.memo
      };

      const result = await hashconnect.sendTransaction(transaction);
      return result.transactionId;
    } catch (error) {
      console.error('HashPack transaction error:', error);
      throw error;
    }
  }
  
  throw new Error('HashPack not available');
};

// Utility functions
export const isWalletInstalled = (type: WalletType): boolean => {
  try {
    if (typeof window === 'undefined') return false;
    switch (type) {
      case 'metamask':
        return !!(window as any).ethereum;
      case 'hashpack':
        return !!(window as any).hashconnect;
      case 'trust':
        return isTrustWalletAvailable();
      default:
        return false;
    }
  } catch {
    return false;
  }
};

export const formatAddress = (address: string): string => {
  if (address.includes('.')) {
    // Hedera account ID format (0.0.123456)
    return address;
  }
  // Ethereum address format
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};
