// WalletConnect simplified integration for Trust Wallet support

// Trust Wallet Deep Link for mobile
export const getTrustWalletDeepLink = (): string => {
  const dappUrl = encodeURIComponent(window.location.href);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) {
      return `trust://browser_enable?dapp_url=${dappUrl}`;
    } else {
      return `https://link.trustwallet.com/open_url?url=${dappUrl}`;
    }
  }
  return 'https://trustwallet.com/browser-extension';
};

export const openTrustWallet = () => {
  const deepLink = getTrustWalletDeepLink();
  window.open(deepLink, '_blank');
};

export const isTrustWallet = (): boolean => {
  return typeof window !== 'undefined' && !!(window as any).trustwallet;
};

export const connectTrustWallet = async (): Promise<string | null> => {
  const provider = (window as any).trustwallet || (window as any).ethereum;
  if (!provider) {
    openTrustWallet();
    return null;
  }
  
  try {
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    return accounts[0] || null;
  } catch (error) {
    console.error('Trust Wallet connection error:', error);
    throw error;
  }
};
