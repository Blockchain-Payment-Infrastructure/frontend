import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { FormsModule } from '@angular/forms';

import { AuthResponse, WalletAddress } from "./payment.service"; // MODIFIED: WalletAddress and AuthResponse
import { ethers } from 'ethers'; // NEW: Import Ethers for MetaMask interaction

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
    RouterOutlet,
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
    MatTableModule
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
  private userAccessToken: string | null = null; // Stores the JWT token

  // DASHBOARD STATE & DATA
  walletAddress: string | null = null;
  showAddressBox: boolean = false;

  // NEW: State for Phone Number Search
  searchPhoneNumber: string = '';
  searchedWalletAddress: WalletAddress[] | null = null;
  isSearchingWallet: boolean = false;

  // API STATE
  transactionHashInput: string = '';
  transactionDetails: TransactionDetails = null;
  isLoadingTransaction: boolean = false;
  isAuthenticating: boolean = false;

  constructor(private paymentService: PaymentService) { }

  // Helper to get token
  private getAccessToken(): string | null {
    return this.userAccessToken;
  }

  // NEW: Helper to get the MetaMask provider
  private getProvider(): ethers.BrowserProvider | null {
    if (typeof (window as any).ethereum === 'undefined') {
      return null;
    }
    return new ethers.BrowserProvider((window as any).ethereum);
  }

  // -------------------------------------------------------------------
  // --- Ethers.js / Wallet Connection Methods ---
  // -------------------------------------------------------------------

  // MODIFIED: connectMetamask to handle the full sign-and-verify flow
  async connectMetamask() {
    this.showAddressBox = false;
    const provider = this.getProvider();

    if (!provider) {
      alert('MetaMask is not installed. Redirecting to download page.');
      this.goToMetamaskSite();
      return;
    }

    // 1. Connect and get the wallet address
    try {
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // 2. Define the message to sign (as per security best practice)
      const message = "Connect wallet to backend service for user: " + this.username;

      // 3. Request the user to sign the message
      alert(`Please sign the message in MetaMask to verify wallet ownership.`);
      const signature = await signer.signMessage(message);

      // --- NEW CONSOLE LOGS START ---
      console.log('--- SIGNATURE VERIFICATION DATA SENT TO BACKEND ---');
      console.log('Original Message (Text Signed):', message);
      console.log('Generated Signature (Hex):', signature);
      console.log('Wallet Address Used:', address);
      console.log('----------------------------------------------------');
      // --- NEW CONSOLE LOGS END ---

      // 4. Send the verification request to the backend
      const token = this.getAccessToken();
      if (!token) {
        alert('Authentication error: Please log in again.');
        return;
      }

      this.paymentService.connectWalletBackend({ message, signature }, token).subscribe({
        next: (response) => {
          this.walletAddress = address; // Use the address we just connected
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

  goToMetamaskSite() { window.open('https://metamask.io/download/', '_blank'); }

  disconnectMetamask() {
    this.walletAddress = null;
    this.showAddressBox = false;
    console.error('Wallet disconnected!');
  }

  // -------------------------------------------------------------------
  // --- API METHODS (Rest unchanged) ---
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
  // --- UI METHODS (Rest unchanged) ---
  // -------------------------------------------------------------------

  useAddress(address: string) {
    console.log(`Address selected for payment: ${address}`);
    alert(`Address selected: ${address}. You would typically populate a 'Send' form here.`);
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
