// Trust Wallet integration for mobile (Deep Linking) and web extension

export const isMobile = (): boolean => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
};

export const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

// Check if Trust Wallet is installed
export const isTrustWalletInstalled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const { trustwallet, ethereum } = window as any;
  return !!(trustwallet || (ethereum?.isTrust));
};

// Get Trust Wallet provider
export const getTrustWalletProvider = (): any => {
  if (typeof window === 'undefined') return null;
  const { trustwallet, ethereum } = window as any;
  if (trustwallet) return trustwallet;
  if (ethereum?.isTrust) return ethereum;
  return null;
};

// Get Trust Wallet Deep Link for mobile
export const getTrustWalletDeepLink = (): string => {
  const dappUrl = encodeURIComponent(window.location.href);
  
  if (isIOS()) {
    // iOS Trust Wallet deep link
    return `trust://browser_enable?dapp_url=${dappUrl}`;
  } else if (isAndroid()) {
    // Android Trust Wallet deep link via universal link
    return `https://link.trustwallet.com/open_url?url=${dappUrl}`;
  }
  
  // Desktop - redirect to extension download
  return 'https://trustwallet.com/browser-extension';
};

// Open Trust Wallet app or download page
export const openTrustWallet = (): void => {
  const deepLink = getTrustWalletDeepLink();
  
  if (isMobile()) {
    // On mobile, try to open the app
    window.location.href = deepLink;
    
    // Fallback to app store after delay if app not installed
    setTimeout(() => {
      if (isIOS()) {
        window.location.href = 'https://apps.apple.com/app/trust-crypto-bitcoin-wallet/id1288339409';
      } else if (isAndroid()) {
        window.location.href = 'https://play.google.com/store/apps/details?id=com.wallet.crypto.trustapp';
      }
    }, 2500);
  } else {
    // Desktop - open extension page
    window.open(deepLink, '_blank');
  }
};

// Connect to Trust Wallet
export const connectTrustWallet = async (): Promise<string | null> => {
  const provider = getTrustWalletProvider();
  
  if (!provider) {
    // Trust Wallet not installed - open deep link or download
    openTrustWallet();
    
    if (isMobile()) {
      throw new Error('Ouverture de Trust Wallet... Si l\'app ne s\'ouvre pas, veuillez l\'installer.');
    } else {
      throw new Error('Trust Wallet non détecté. Veuillez installer l\'extension.');
    }
  }
  
  try {
    // Request account access
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    
    if (!accounts || accounts.length === 0) {
      throw new Error('Aucun compte autorisé');
    }
    
    return accounts[0];
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error('Connexion refusée par l\'utilisateur');
    }
    throw error;
  }
};

// Get current Trust Wallet address (if already connected)
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

// Sign transaction with Trust Wallet
export const signTransactionTrustWallet = async (params: {
  to: string;
  value: string;
  data?: string;
}): Promise<string> => {
  const provider = getTrustWalletProvider();
  if (!provider) {
    throw new Error('Trust Wallet non connecté');
  }
  
  const accounts = await provider.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('Aucun compte Trust Wallet connecté');
  }
  
  const txParams = {
    from: accounts[0],
    to: params.to,
    value: params.value,
    data: params.data || '0x'
  };
  
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [txParams]
  });
  
  return txHash;
};
