import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthResponse, WalletAddress, TransactionRecord } 
  from "./payment.service";

// Locally define the ExchangeRates type 
type ExchangeRates = {
  ethereum: {
    usd: number;
    inr: number;
    gbp: number;
    eur: number;
    [key: string]: number;
  };
};
import { ethers } from 'ethers'; 

// --- MATERIAL IMPORTS ---
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select'; 
import { MatListModule } from '@angular/material/list'; 
import { MatDialogModule } from '@angular/material/dialog'; 

// --- API SERVICE IMPORTS ---
import { HttpClientModule } from '@angular/common/http';
import { PaymentService } from './payment.service';
import { catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';
import { NgIf, NgFor, DecimalPipe, DatePipe, NgClass } from '@angular/common'; 

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    HttpClientModule,
    MatCardModule,
    MatTabsModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatToolbarModule,
    MatProgressBarModule,
    MatRadioModule,
    MatSelectModule, 
    MatTableModule,
    MatDialogModule,
    MatListModule, 
    DecimalPipe, 
    DatePipe,
    NgClass,
    NgIf,
    NgFor
  ],
  providers: [PaymentService],
  templateUrl: './app.component.html',
  styles: [`
    .status-pill {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      white-space: nowrap;
    }
    .status-completed { background-color: #e8f5e9; color: #388e3c; border: 1px solid #388e3c; }
    .status-pending { background-color: #fff3e0; color: #ff9800; border: 1px solid #ff9800; }
    .status-failed { background-color: #ffebee; color: #e53935; border: 1px solid #e53935; }
    .tx-hash { font-family: monospace; font-size: 11px; color: #666; word-break: break-all; }
    .address-small { font-size: 12px; color: #999; word-break: break-all; }
    /* Added responsiveness for the dashboard layout */
    @media (max-width: 900px) {
      .dashboard-grid {
        grid-template-columns: 1fr !important;
      }
      .center-content {
        width: 90% !important;
        padding-right: 0 !important;
        justify-content: center !important;
      }
    }
  `],
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit { 
  title = 'demo';

  @ViewChild('tabGroup') tabGroup!: MatTabGroup;

  // --- AUTH/UI STATE ---
  username: string = '';
  username2: string = '';
  phone_number: string = '';
  password: string = '';
  email: string = '';
  currentPage = 'login';
  private userAccessToken: string | null = null; 

  // DASHBOARD STATE & DATA
  walletAddress: string | null = null;
  showAddressBox: boolean = false;
  
  // --- FIX: Explicitly defined recentTransactions and isFetchingTransactions ---
recentTransactions: TransactionRecord[] = [];
  isFetchingTransactions: boolean = false;

  // Helper: persist wallet address
  private persistWalletAddress(address: string | null) {
    if (address) {
      localStorage.setItem('walletAddress', address);
    } else {
      localStorage.removeItem('walletAddress');
    }
  }

  private getPersistedWalletAddress(): string | null {
    return localStorage.getItem('walletAddress');
  }
  
  // BALANCE AND CURRENCY STATE
  ethBalance: number | null = null;
  exchangeRates: ExchangeRates | null = null;
  selectedFiatCurrency: 'USD' | 'INR' | 'GBP' | 'EUR' = 'USD';
  fiatCurrencies: { code: 'USD' | 'INR' | 'GBP' | 'EUR', symbol: string }[] = [
    { code: 'USD', symbol: '$' },
    { code: 'INR', symbol: '₹' },
    { code: 'GBP', symbol: '£' },
    { code: 'EUR', symbol: '€' },
  ];
  
  // Payment Modal Form State
  showPaymentModal: boolean = false; 
  recipientAddress: string | null = null; 
  paymentAmount: number | null = null;     
  paymentDescription: string = ''; 
  isProcessingPayment: boolean = false; 

  // State for Phone Number Search
  searchPhoneNumber: string = '';
  searchedWalletAddress: WalletAddress[] | null = null;
  isSearchingWallet: boolean = false;
  
  // API STATE
  isAuthenticating: boolean = false;

  constructor(private paymentService: PaymentService) { }

  ngOnInit() {
    this.fetchExchangeRates();
    this.loadRecentTransactions();
    const persisted = this.getPersistedWalletAddress();
    if (persisted) {
      this.walletAddress = persisted;
    }
    if (this.userAccessToken) {
      this.checkWalletConnection();
    }
  }

  checkWalletConnection() {
    const token = this.getAccessToken();
    if (!token) return;
    
    this.paymentService.getWalletBalances(token).subscribe({
      next: async (addresses: string[]) => {
        if (addresses && addresses.length > 0) {
          const backendAddress = addresses[0];
          
          this.walletAddress = backendAddress;
          this.persistWalletAddress(backendAddress);
          this.fetchWalletBalance();
          this.fetchRecentTransactions(); 
          
          const provider = this.getProvider();
          if (provider) {
            try {
              const signer = await provider.getSigner();
              const metaMaskAddress = await signer.getAddress();
              if (metaMaskAddress.toLowerCase() !== backendAddress.toLowerCase()) {
                alert('MetaMask is not connected to the same wallet as your account. Please switch MetaMask to: ' + backendAddress);
              }
            } catch (e) {
              console.warn('Could not check MetaMask address. It might be locked or disconnected.');
            }
          }
        } else {
          this.walletAddress = null;
          this.ethBalance = null;
          this.persistWalletAddress(null);
          this.recentTransactions = []; 
        }
      },
      error: (err) => {
        this.walletAddress = null;
        this.ethBalance = null;
        this.persistWalletAddress(null);
        this.recentTransactions = [];
        console.error('Failed to check wallet connection:', err);
      }
    });
  }
  
  private getAccessToken(): string | null {
    return this.userAccessToken;
  }

  private getProvider(): ethers.BrowserProvider | null {
    if (typeof (window as any).ethereum === 'undefined') {
      return null;
    }
    return new ethers.BrowserProvider((window as any).ethereum);
  }

  // Getter to calculate the converted value and symbol
  get convertedBalance(): { value: string, symbol: string } {
    if (this.ethBalance === null || !this.exchangeRates) {
      return { value: 'N/A', symbol: '' };
    }
    
    const rate = this.exchangeRates.ethereum[this.selectedFiatCurrency.toLowerCase() as keyof ExchangeRates['ethereum']];
    if (!rate) {
      return { value: 'N/A', symbol: '' };
    }

    const symbol = this.fiatCurrencies.find(c => c.code === this.selectedFiatCurrency)?.symbol || '';
    const convertedValue = (this.ethBalance * rate);
    
    const formattedValue = new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(convertedValue);
    
    return { value: formattedValue, symbol: symbol };
  }

  // -------------------------------------------------------------------
  // --- BALANCE & RATES METHODS ---
  // -------------------------------------------------------------------
  
  // Method to fetch ETH Balance from the blockchain
  async fetchWalletBalance() {
    if (!this.walletAddress) {
      this.ethBalance = null;
      console.log('Wallet address is null, skipping balance fetch.');
      return;
    }

    const provider = this.getProvider();
    if (!provider) {
      console.error('MetaMask provider not available for balance check.');
      return;
    }
    
    try {
      const balanceWei = await provider.getBalance(this.walletAddress); 
      const balanceEthString = ethers.formatEther(balanceWei);
      this.ethBalance = parseFloat(balanceEthString);
      
      console.log(`ETH Balance fetched: ${this.ethBalance} ETH`);
      
    } catch (error) {
      console.error('Failed to fetch ETH balance:', error);
      this.ethBalance = null;
    }
  }
  
  // Method to fetch live exchange rates
  fetchExchangeRates() {
    this.paymentService.getExchangeRates().subscribe({
      next: (rates: ExchangeRates) => {
        this.exchangeRates = rates;
        console.log('Exchange rates fetched:', rates);
      },
      error: (err) => {
        console.error('Failed to fetch exchange rates:', err);
        this.exchangeRates = {
          ethereum: {
            usd: 3000,
            inr: 250000,
            gbp: 2400,
            eur: 2800,
          }
        } as ExchangeRates;
        alert('Warning: Could not fetch live exchange rates. Using approximate fallback rates.');
      }
    });
  }
  
  // Method to fetch recent transactions from the backend
  fetchRecentTransactions() {
    const token = this.getAccessToken();
    if (!token) {
      this.recentTransactions = [];
      return;
    }

    // Set loading state to true
    this.isFetchingTransactions = true;

    this.paymentService.getRecentTransactions(token).pipe(
      catchError(err => {
        console.error('Failed to fetch recent transactions:', err);
        this.isFetchingTransactions = false;
        return of({ payments: [] });
      })
    ).subscribe((response: any) => {
      this.isFetchingTransactions = false;
      const txArray = response?.payments || [];
      this.recentTransactions = (response.payments || []).map((tx: any) => {
      return {
        ...tx,
        amount: parseFloat(tx.amount) / 1e18 // divide by 10^18 here
      };
    }).slice(0, 5);
      this.recentTransactions = txArray.slice(0, 5);
      console.log(`Fetched ${this.recentTransactions.length} recent transactions.`);
    });
  }


  // -------------------------------------------------------------------
  // --- TRANSACTION METHODS ---
  // -------------------------------------------------------------------

  useAddress(address: string) {
    if (!this.walletAddress) {
      alert('Please connect your MetaMask wallet first to send payments.');
      return;
    }
    this.recipientAddress = address;
    this.paymentAmount = null; 
    this.paymentDescription = ''; 
    this.showPaymentModal = true;
    console.log(`Payment modal opened for recipient: ${address}`); 
  }

  closePaymentModal() { 
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
  }

  async sendPayment() { 
    if (!this.walletAddress) {
      alert('Wallet not connected. Please connect MetaMask.');
      return;
    }
    if (!this.recipientAddress || !this.paymentAmount || this.paymentAmount <= 0) {
      alert('Please enter a valid amount and recipient.');
      return;
    }
    if (!ethers.isAddress(this.recipientAddress)) {
      alert('Invalid recipient address format.');
      return;
    }

    const provider = this.getProvider();
    if (!provider) {
      alert('MetaMask provider not available.');
      return;
    }

    this.isProcessingPayment = true;
    const token = this.getAccessToken();

    try {
      // 1. Prepare Ethers transaction
      const signer = await provider.getSigner();
      const amountWei = ethers.parseEther(this.paymentAmount.toString()); 

      console.log(`Attempting to send ${this.paymentAmount} ETH to ${this.recipientAddress}...`);
      alert('Please confirm the transaction in MetaMask.');

      // 2. Send transaction (MetaMask popup appears here)
      const tx = await signer.sendTransaction({
        to: this.recipientAddress,
        value: amountWei,
      });

      console.log(`Transaction sent to network. Hash: ${tx.hash}`);
      alert(`Transaction sent! Waiting for block confirmation...`);

      // 3. Wait for transaction confirmation
      const receipt = await tx.wait();
      
      if (!receipt || receipt.status !== 1) {
          throw new Error('Transaction failed or was reverted on the blockchain.');
      }

      const transactionHash = receipt.hash;
      console.log('Transaction confirmed successfully:', transactionHash);

      // 4. Create record in backend (POST /payments)
      this.paymentService.createPaymentRecord({
        amount: ethers.parseEther(this.paymentAmount.toString()).toString(), 
        currency: 'ETH',
        description: this.paymentDescription || 'P2P Transfer',
        to_address: this.recipientAddress,
        transaction_hash: transactionHash,
      }, token).subscribe({
        next: (response) => {
          alert(`Success! Payment recorded by backend.`);
          this.closePaymentModal();
          this.fetchWalletBalance(); 
          this.fetchRecentTransactions(); 
        },
        error: (err) => {
          console.error('Backend recording failed:', err);
          alert('Transaction was successful on the blockchain, but failed to record on the backend.');
          this.closePaymentModal();
          this.fetchWalletBalance(); 
          this.fetchRecentTransactions(); 
        }
      });
      
    } catch (error: any) {
      this.isProcessingPayment = false;
      console.error('Payment process failed:', error);
      
      if (error.code === 4001) {
        alert('Transaction rejected by user in MetaMask.');
      } else if (error.message && error.message.includes('insufficient funds')) {
        alert('Payment Failed: Insufficient funds in wallet.');
      } else {
        alert(`Payment Failed: ${error.message || 'Check console for details.'}`);
      }
    }
  }


  // -------------------------------------------------------------------
  // --- AUTH & SEARCH METHODS (Continued) ---
  // -------------------------------------------------------------------
  
  login() {
    if (!this.email || !this.password) {
      console.error('Please enter both email and password.');
      return;
    }

    this.isAuthenticating = true;
    const payload = { email: this.email, password: this.password };

    this.paymentService.userLogin(payload).pipe(
      catchError(err => {
        console.error('Login error:', err);
        this.isAuthenticating = false;
        console.error('Login Failed. Check console for details.');
        return of(null);
      })
    ).subscribe((response: AuthResponse | null) => {
      this.isAuthenticating = false;

      if (response && response.access_token) {
        this.userAccessToken = response.access_token; 
        this.username = this.email;
        this.password = '';
        this.currentPage = 'dashboard';
        console.log("Login Successful. Token saved.");
        this.checkWalletConnection();
      }
    });
  }

  register() {
    if (!this.username2 || !this.email || !this.password) {
      console.error('Please fill out all registration fields.');
      return;
    }

    this.isAuthenticating = true;
    const payload = {
      username: this.username2,
      email: this.email,
      phone_number: this.phone_number,
      password: this.password
    };
    
    this.paymentService.userRegister(payload).pipe(
      catchError(err => {
        console.error('Registration error:', err);
        this.isAuthenticating = false;
        console.error('Registration Failed. Check console for details.');
        return of(null);
      })
    ).subscribe((response: AuthResponse | null) => {
      this.isAuthenticating = false;

      if (response) {
        console.log('Registration successful! Redirecting to Login tab.');

        this.username2 = '';
        this.phone_number = '';
        this.password = '';
        this.email = '';

        this.currentPage = 'login';

        setTimeout(() => {
          if (this.tabGroup) {
            this.tabGroup.selectedIndex = 0;
          }
        }, 0);
      }
    });
  }

  loadRecentTransactions() {
  this.paymentService.getTransactionHistory().subscribe({
    next: (res) => {
      this.recentTransactions = (res.payments || []).map((tx: any) => ({
  ...tx,
  amount_eth: tx.amount ? ethers.formatEther(tx.amount) : null,
  transaction_hash: tx.transaction_hash || tx.hash || null
}));
    },
    error: (err) => {
      console.error("Failed to load transactions", err);
    }
  });
}

  
  async connectMetamask() {
    if (this.walletAddress) {
      alert('A wallet is already connected. Please disconnect first if you want to connect a different wallet.');
      return;
    }
    this.showAddressBox = false;
    const provider = this.getProvider();

    if (!provider) {
      alert('MetaMask is not installed. Redirecting to download page.');
      this.goToMetamaskSite();
      return;
    }
    try {
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const message = "Connect wallet to backend service for user: " + this.username;
      alert(`Please sign the message in MetaMask to verify wallet ownership.`);
      const signature = await signer.signMessage(message);

      console.log('--- SIGNATURE VERIFICATION DATA SENT TO BACKEND ---');

      const token = this.getAccessToken();
      if (!token) {
        alert('Authentication error: Please log in again.');
        return;
      }

      this.paymentService.connectWalletBackend({ message, signature }, token).subscribe({
        next: (response) => {
          this.walletAddress = address;
          this.persistWalletAddress(address);
          console.log('Backend Wallet Association SUCCESSFUL. Connected Address:', response.walletAddress);
          alert(`Wallet Connected and Verified! Address: ${response.walletAddress}`);
          this.fetchWalletBalance();
          this.fetchRecentTransactions();
        },
        error: (error) => {
          this.walletAddress = null;
          this.ethBalance = null; 
          this.recentTransactions = [];
          console.error('Wallet Verification Failed:', error);
          if (error.status === 401) {
            alert('Verification Failed: Session expired. Please log in again.');
          } else if (error.status === 409) {
            alert('Wallet already linked to an account.');
          } else {
            alert(`Wallet Verification Failed: ${error.message || 'Check console for details.'}`);
          }
        }
      });
    } catch (error: any) {
      console.error('Wallet connection or signing rejected/failed:', error);
      this.walletAddress = null;
      this.ethBalance = null; 
      this.recentTransactions = [];
      if (error.code === 4001) {
        alert('Connection/Signing rejected by user.');
      } else {
        alert(`Failed to connect/sign: ${error.message || 'Check console.'}`);
      }
    }
  }

  searchWalletAddress() {
    if (!this.searchPhoneNumber) {
      console.error('Please enter a phone number to search.');
      return;
    }
    
    const token = this.getAccessToken();
    if (!token) {
      alert('You must be logged in to search for a wallet address.');
      return;
    }

    this.isSearchingWallet = true;
    this.searchedWalletAddress = null;

    this.paymentService.getWalletAddressByPhone(this.searchPhoneNumber, token).pipe(
      catchError((error) => {
        this.isSearchingWallet = false;
        
        if (error.status === 401) {
          alert('Unauthorized: Session expired or invalid token. Please log in again.');
        } else if (error.status === 404 || (error.error && error.error.length === 0)) { 
          console.log(`No wallet found for phone number: ${this.searchPhoneNumber}`);
        } else {
          console.error('Error during wallet lookup:', error);
          alert(`Search failed: ${error.message}`);
        }
        this.searchedWalletAddress = [];
        return throwError(() => new Error('Wallet lookup failed'));
      })
    ).subscribe((response: WalletAddress[]) => {
      this.isSearchingWallet = false;
      this.searchedWalletAddress = response;
      if (response && response.length > 0) {
        console.log(`Found ${response.length} addresses.`);
      } else {
        console.log('Search completed, but no addresses found.');
      }
    });
  }
  
  // -------------------------------------------------------------------
  // --- UI METHODS (Continued) ---
  // -------------------------------------------------------------------
  
  goToMetamaskSite() { window.open('https://metamask.io/download/', '_blank'); }

  disconnectMetamask() {
    this.walletAddress = null;
    this.showAddressBox = false;
    this.ethBalance = null;
    this.recentTransactions = []; 
    this.persistWalletAddress(null);
    console.error('Wallet disconnected!');
  }

  showWalletAddress() {
    if (this.walletAddress) {
      this.showAddressBox = true;
    } else {
      console.error('No wallet connected');
      this.showAddressBox = false;
    }
  }

  toggleWalletAddressDisplay() {
    if (this.walletAddress) {
      this.showAddressBox = !this.showAddressBox;
    } else {
      this.showAddressBox = false;
      console.error('Cannot show/hide address: No wallet connected.');
    }
  }

  manageAccount() {
    this.currentPage = 'account';
    this.showAddressBox = false;
  }
}