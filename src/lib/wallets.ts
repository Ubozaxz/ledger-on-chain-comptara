import { getEthereum, ensureHederaTestnet, HEDERA_TESTNET } from './hedera';

export type WalletType = 'metamask' | 'hashpack';

export interface WalletInfo {
  type: WalletType;
  address: string;
  connected: boolean;
}

// MetaMask wallet functions
export const connectMetaMask = async (): Promise<string> => {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('MetaMask not found');
  }

  await ensureHederaTestnet();
  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  return accounts[0];
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
      // Initialize HashConnect
      await hashconnect.init({
        appMetadata: {
          name: "Comptara",
          description: "Blockchain Accounting Platform",
          icon: "https://absolute.url/to/icon.png"
        }
      });

      // Find available HashPack extensions
      const foundExtensionData = await hashconnect.findLocalWallets();
      
      if (foundExtensionData.length === 0) {
        throw new Error('HashPack wallet not found');
      }

      // Connect to HashPack
      const connectionData = await hashconnect.connectToLocalWallet(foundExtensionData[0].id);
      
      if (connectionData.accountIds && connectionData.accountIds.length > 0) {
        return connectionData.accountIds[0];
      }
      
      throw new Error('No accounts found in HashPack');
    } catch (error) {
      console.error('HashPack connection error:', error);
      throw error;
    }
  } else {
    // Fallback: open HashPack website
    window.open('https://www.hashpack.app/', '_blank');
    throw new Error('HashPack extension not installed. Please install HashPack and try again.');
  }
};

export const getHashPackAddress = async (): Promise<string | null> => {
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
        return !!(window as any).ethereum; // do NOT call getEthereum here to avoid throw in some envs
      case 'hashpack':
        return !!(window as any).hashconnect;
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