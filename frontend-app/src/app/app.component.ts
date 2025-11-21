import { Component, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthResponse, WalletAddress } 
  from "./payment.service";

// Locally define the ExchangeRates type since it is not exported from payment.service.ts
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
import { MatDialogModule } from '@angular/material/dialog'; 

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
import { MatSelectModule } from '@angular/material/select'; // Added MatSelectModule

// --- API SERVICE IMPORTS ---
import { HttpClientModule } from '@angular/common/http';
import { PaymentService } from './payment.service';
import { catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';
import { DecimalPipe } from '@angular/common'; // NEW: For number pipe in HTML

// Define expected data structure
type TransactionDetails = { txHash: string, status: string, amount: number } | null;

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
    MatSelectModule, // Imported MatSelectModule
    MatTableModule,
    MatDialogModule,
    DecimalPipe // Imported DecimalPipe
  ],
  providers: [PaymentService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit { // MODIFIED: Added OnInit
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
  
  // NEW: BALANCE AND CURRENCY STATE
  ethBalance: number | null = null;
  exchangeRates: ExchangeRates | null = null;
  selectedFiatCurrency: 'USD' | 'INR' | 'GBP' | 'EUR' = 'USD';
  fiatCurrencies: { code: 'USD' | 'INR' | 'GBP' | 'EUR', symbol: string }[] = [
    { code: 'USD', symbol: '$' },
    { code: 'INR', symbol: '₹' },
    { code: 'GBP', symbol: '£' },
    { code: 'EUR', symbol: '€' },
  ];
  
  // FIXED: Missing property declarations for Payment Modal Form
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
  transactionHashInput: string = '';
  transactionDetails: TransactionDetails = null;
  isLoadingTransaction: boolean = false;
  isAuthenticating: boolean = false;

  constructor(private paymentService: PaymentService) { }

  // NEW: Angular Lifecycle Hook to load rates on start
  ngOnInit() {
    this.fetchExchangeRates();
    // On init, restore wallet address from localStorage if present
    const persisted = this.getPersistedWalletAddress();
    if (persisted) {
      this.walletAddress = persisted;
    }
    // If user is already logged in (token exists), check wallet connection
    if (this.userAccessToken) {
      this.checkWalletConnection();
    }
  }

  // Call this after login as well
  checkWalletConnection() {
    const token = this.getAccessToken();
    if (!token) return;
    this.paymentService.getWalletBalances(token).subscribe({
      next: async (addresses: string[]) => {
        if (addresses && addresses.length > 0) {
          const backendAddress = addresses[0];
          // Check MetaMask for the same address
          const provider = this.getProvider();
          let metaMaskAddress: string | null = null;
          if (provider) {
            try {
              const signer = await provider.getSigner();
              metaMaskAddress = await signer.getAddress();
            } catch {}
          }
          this.walletAddress = backendAddress;
          this.persistWalletAddress(backendAddress);
          if (metaMaskAddress && metaMaskAddress.toLowerCase() !== backendAddress.toLowerCase()) {
            alert('MetaMask is not connected to the same wallet as your account. Please switch MetaMask to: ' + backendAddress);
          }
          this.fetchWalletBalance();
        } else {
          this.walletAddress = null;
          this.ethBalance = null;
          this.persistWalletAddress(null);
        }
      },
      error: (err) => {
        this.walletAddress = null;
        this.ethBalance = null;
        this.persistWalletAddress(null);
        console.error('Failed to check wallet connection:', err);
      }
    });
  // removed extra closing brace here
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

  // NEW: Getter to calculate the converted value and symbol
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
    
    // Format to 2 decimal places for fiat, using Intl.NumberFormat for locale-appropriate separators
    const formattedValue = new Intl.NumberFormat('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(convertedValue);
    
    return { value: formattedValue, symbol: symbol };
  }

  // -------------------------------------------------------------------
  // --- BALANCE & RATES METHODS ---
  // -------------------------------------------------------------------
  
  // NEW: Method to fetch ETH Balance from the blockchain
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
      // Get the balance in Wei (BigInt)
      const balanceWei = await provider.getBalance(this.walletAddress); 
      
      // Convert from Wei to Ether (number)
      const balanceEthString = ethers.formatEther(balanceWei);
      this.ethBalance = parseFloat(balanceEthString);
      
      console.log(`ETH Balance fetched: ${this.ethBalance} ETH`);
      
    } catch (error) {
      console.error('Failed to fetch ETH balance:', error);
      this.ethBalance = null;
    }
  }
  
  // NEW: Method to fetch live exchange rates
  fetchExchangeRates() {
    this.paymentService.getExchangeRates().subscribe({
      next: (rates: ExchangeRates) => {
        this.exchangeRates = rates;
        console.log('Exchange rates fetched:', rates);
      },
      error: (err) => {
        console.error('Failed to fetch exchange rates:', err);
        // Fallback hardcoded rates if API fails
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


  // -------------------------------------------------------------------
  // --- UI/MODAL METHODS ---
  // -------------------------------------------------------------------
  
  // MODIFIED: useAddress now opens the modal
  useAddress(address: string) {
    if (!this.walletAddress) {
      alert('Please connect your MetaMask wallet first to send payments.');
      return;
    }
    this.recipientAddress = address;
    this.paymentAmount = null; // Clear previous amount
    this.paymentDescription = ''; // Clear previous description
    this.showPaymentModal = true;
    console.log(`Payment modal opened for recipient: ${address}`); 
  }

  // FIXED: Missing method declaration for closePaymentModal
  closePaymentModal() { 
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
  }

  // -------------------------------------------------------------------
  // --- TRANSACTION METHODS (New Core Logic) ---
  // -------------------------------------------------------------------

  // FIXED: Missing method declaration for sendPayment
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
        amount: amountWei.toString(), // Send amount in Wei as string or format required by your backend
        currency: 'ETH',
        description: this.paymentDescription || 'No description',
        to_address: this.recipientAddress,
        transaction_hash: transactionHash,
      }, token).subscribe({
        next: (response) => {
          alert(`Success! Payment recorded by backend.`);
          this.closePaymentModal();
          // NOTE: You would typically refresh transaction history here.
          this.fetchWalletBalance(); // Refresh balance after successful payment
        },
        error: (err) => {
          console.error('Backend recording failed:', err);
          alert('Transaction was successful on the blockchain, but failed to record on the backend.');
          this.closePaymentModal();
          this.fetchWalletBalance(); // Refresh balance anyway
        }
      });
      
    } catch (error: any) {
      this.isProcessingPayment = false;
      console.error('Payment process failed:', error);
      
      // Handle MetaMask rejection error (code 4001)
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
        this.userAccessToken = response.access_token; // **SAVE TOKEN HERE**
        this.username = this.email;
        this.password = '';
        this.currentPage = 'dashboard';
        console.log("Login Successful. Token saved.");
        // After login, check wallet connection and fetch balance if connected
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
  
  // Wallet Connect (Updated for Signature Verification and Balance Fetch)
  async connectMetamask() {
    // Prevent connecting if wallet is already connected
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
      console.log('Original Message (Text Signed):', message);
      console.log('Generated Signature (Hex):', signature);
      console.log('Wallet Address Used:', address);
      console.log('----------------------------------------------------');

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
          // Fetch the actual balance upon successful connection
          this.fetchWalletBalance();
        },
        error: (error) => {
          this.walletAddress = null;
          this.ethBalance = null; // Clear balance on failed connection
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
      this.ethBalance = null; // Clear balance on user rejection
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
  
  lookupTransaction() {
    if (!this.transactionHashInput) {
      console.error('Please enter a transaction hash.');
      return;
    }

    this.isLoadingTransaction = true;
    this.transactionDetails = null;

    this.paymentService.getTransactionDetails(this.transactionHashInput).subscribe({
      next: (data) => {
        this.transactionDetails = {
          txHash: data.txHash,
          status: data.status,
          amount: data.amount
        };
        this.isLoadingTransaction = false;
        console.log(`Transaction Status: ${data.status}`);
      },
      error: (err) => {
        console.error('Error looking up transaction:', err);
        this.transactionDetails = null;
        this.isLoadingTransaction = false;
        console.error('Failed to retrieve transaction details.');
      }
    });
  }


  // -------------------------------------------------------------------
  // --- UI METHODS (Continued) ---
  // -------------------------------------------------------------------
  
  goToMetamaskSite() { window.open('https://metamask.io/download/', '_blank'); }

  // MODIFIED: Clear balance on disconnect
  disconnectMetamask() {
    this.walletAddress = null;
    this.showAddressBox = false;
    this.ethBalance = null;
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