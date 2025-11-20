import { Component, ViewChild } from '@angular/core';
// Removed RouterOutlet import as it's not used in the template's current structure
// import { RouterOutlet } from '@angular/router'; 

import { FormsModule } from '@angular/forms';

import { AuthResponse, WalletAddress } from "./payment.service";
import { ethers } from 'ethers'; // RE-ADDED: Necessary for MetaMask transactions
import { MatDialogModule } from '@angular/material/dialog'; // NEW: For modal/popup styling

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

// --- API SERVICE IMPORTS ---
import { HttpClientModule } from '@angular/common/http';
import { PaymentService } from './payment.service';
import { catchError } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

// Define expected data structure
type TransactionDetails = { txHash: string, status: string, amount: number } | null;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    // Removed RouterOutlet
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
    MatDialogModule // Added MatDialogModule for modal background/structure
  ],
  providers: [PaymentService],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {
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
  
  // FIXED: Missing property declarations for Payment Modal Form
  showPaymentModal: boolean = false; // Fixes TS2339 for showPaymentModal
  recipientAddress: string | null = null; // Fixes TS2339 for recipientAddress
  paymentAmount: number | null = null;    // Fixes TS2339 for paymentAmount
  paymentDescription: string = ''; // Fixes TS2339 for paymentDescription
  isProcessingPayment: boolean = false; // Fixes TS2339 for isProcessingPayment

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
  
  private getAccessToken(): string | null {
    return this.userAccessToken;
  }

  private getProvider(): ethers.BrowserProvider | null {
    if (typeof (window as any).ethereum === 'undefined') {
      return null;
    }
    return new ethers.BrowserProvider((window as any).ethereum);
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
  closePaymentModal() { // Fixes TS2339 for closePaymentModal
    this.showPaymentModal = false;
    this.isProcessingPayment = false;
  }

  // -------------------------------------------------------------------
  // --- TRANSACTION METHODS (New Core Logic) ---
  // -------------------------------------------------------------------

  // FIXED: Missing method declaration for sendPayment
  async sendPayment() { // Fixes TS2339 for sendPayment
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
        },
        error: (err) => {
          console.error('Backend recording failed:', err);
          alert('Transaction was successful on the blockchain, but failed to record on the backend.');
          this.closePaymentModal();
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
  
  // Wallet Connect (Updated for Signature Verification)
  async connectMetamask() {
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
          console.log('Backend Wallet Association SUCCESSFUL. Connected Address:', response.walletAddress);
          alert(`Wallet Connected and Verified! Address: ${response.walletAddress}`);
        },
        error: (error) => {
          this.walletAddress = null;
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

  disconnectMetamask() {
    this.walletAddress = null;
    this.showAddressBox = false;
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