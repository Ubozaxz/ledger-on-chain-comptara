import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  fr: {
    translation: {
      // Header
      appTitle: 'comptara',
      appSubtitle: 'Comptabilité blockchain',
      hederaTestnet: 'Hedera Testnet',
      connectWallet: 'Connecter Portefeuille',
      disconnect: 'Déconnecter',
      
      // Wallet types
      metamask: 'MetaMask',
      hashpack: 'HashPack',
      
      // Dashboard
      totalEntries: 'Total Écritures',
      totalPayments: 'Total Paiements',
      totalBalance: 'Solde Total',
      networkStatus: 'Statut Réseau',
      exportData: 'Exporter Données',
      exportJSON: 'Exporter JSON',
      exportPDF: 'Exporter PDF',
      exportCSV: 'Exporter CSV',
      
      // Tabs
      journal: 'Journal',
      payments: 'Paiements',
      reports: 'Rapports',
      
      // Journal Entry
      journalEntry: 'Écriture Comptable',
      date: 'Date',
      description: 'Description',
      amount: 'Montant',
      currency: 'Devise',
      debitAccount: 'Compte Débit',
      creditAccount: 'Compte Crédit',
      submit: 'Enregistrer',
      submitting: 'Enregistrement...',
      
      // Payment Form
      paymentForm: 'Formulaire de Paiement',
      transactionType: 'Type de Transaction',
      payment: 'Paiement',
      receipt: 'Encaissement',
      recipient: 'Destinataire',
      object: 'Objet',
      
      // Entries History
      entriesHistory: 'Historique des Écritures',
      noEntries: 'Aucune écriture enregistrée',
      explorer: 'Explorer',
      
      // Wallet Connection
      walletNotConnected: 'Portefeuille non connecté',
      pleaseConnect: 'Veuillez connecter votre portefeuille pour accéder au tableau de bord.',
      connectionSuccess: 'connecté avec succès',
      
      // Messages
      entrySuccess: 'Écriture enregistrée avec succès',
      paymentSuccess: 'Paiement effectué avec succès',
      transactionHash: 'Hash de transaction',
      viewOnExplorer: 'Voir sur l\'explorateur',
      
      // Errors
      connectionError: 'Erreur de connexion',
      transactionError: 'Erreur de transaction',
      walletNotFound: 'Portefeuille non trouvé',
      
      // Language
      language: 'Langue',
      french: 'Français',
      english: 'English'
    }
  },
  en: {
    translation: {
      // Header
      appTitle: 'comptara',
      appSubtitle: 'Blockchain Accounting',
      hederaTestnet: 'Hedera Testnet',
      connectWallet: 'Connect Wallet',
      disconnect: 'Disconnect',
      
      // Wallet types
      metamask: 'MetaMask',
      hashpack: 'HashPack',
      
      // Dashboard
      totalEntries: 'Total Entries',
      totalPayments: 'Total Payments',
      totalBalance: 'Total Balance',
      networkStatus: 'Network Status',
      exportData: 'Export Data',
      exportJSON: 'Export JSON',
      exportPDF: 'Export PDF',
      exportCSV: 'Export CSV',
      
      // Tabs
      journal: 'Journal',
      payments: 'Payments',
      reports: 'Reports',
      
      // Journal Entry
      journalEntry: 'Journal Entry',
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
      currency: 'Currency',
      debitAccount: 'Debit Account',
      creditAccount: 'Credit Account',
      submit: 'Submit',
      submitting: 'Submitting...',
      
      // Payment Form
      paymentForm: 'Payment Form',
      transactionType: 'Transaction Type',
      payment: 'Payment',
      receipt: 'Receipt',
      recipient: 'Recipient',
      object: 'Object',
      
      // Entries History
      entriesHistory: 'Entries History',
      noEntries: 'No entries recorded',
      explorer: 'Explorer',
      
      // Wallet Connection
      walletNotConnected: 'Wallet Not Connected',
      pleaseConnect: 'Please connect your wallet to access the dashboard.',
      connectionSuccess: 'connected successfully',
      
      // Messages
      entrySuccess: 'Entry recorded successfully',
      paymentSuccess: 'Payment completed successfully',
      transactionHash: 'Transaction hash',
      viewOnExplorer: 'View on explorer',
      
      // Errors
      connectionError: 'Connection error',
      transactionError: 'Transaction error',
      walletNotFound: 'Wallet not found',
      
      // Language
      language: 'Language',
      french: 'Français',
      english: 'English'
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;