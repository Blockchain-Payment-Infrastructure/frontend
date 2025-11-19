import { Component, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms'; 

// --- MATERIAL IMPORTS ---
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs'; // FIX: MatTabGroup added
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
import { of } from 'rxjs';

// FIX: Define AuthResponse interface for type safety with access_token
interface AuthResponse {
    access_token: string;
    username?: string; 
    email?: string; 
}

// Define expected data structure
type TransactionDetails = { txHash: string, status: string, amount: number } | null;

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    // ANGULAR CORE MODULES
    RouterOutlet,
    FormsModule, 
    CommonModule,
    HttpClientModule, 
    
    // MATERIAL MODULES (Complete List)
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

  // FIX: ViewChild reference for programmatic tab switching (requires #tabGroup in HTML)
  @ViewChild('tabGroup') tabGroup!: MatTabGroup;

  // --- UI STATE / FORM FIELDS ---
  username: string = '';
  username2: string = ''; 
  phone_number: string = '';
  password: string = '';  
  email: string = '';
  currentPage = 'login';
  
  // DASHBOARD STATE & DATA
  users = [
    { name: 'Arun Swing', contact: '+91 98765 43210' },
    { name: 'John Bus', contact: '+91 91234 56789' },
    { name: 'Bundaswami', contact: '+91 99887 77665' }
  ];
  selectedAction: 'send' | 'receive' | 'exchange' | null = null;
  currencies = ['INR', 'USD', 'BTC', 'ETH'];
  exchangeFrom: string | null = null;
  exchangeTo: string | null = null;
  walletAddress: string | null = null; 

  // NEW: State for controlling wallet address visibility
  showAddressBox: boolean = false; 

  // API STATE
  transactionHashInput: string = '';
  transactionDetails: TransactionDetails = null;
  isLoadingTransaction: boolean = false;
  isAuthenticating: boolean = false;

  // INJECT the PaymentService
  constructor(private paymentService: PaymentService) {}


  // -------------------------------------------------------------------
  // --- API METHODS ---
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
    ).subscribe((response: AuthResponse | null) => { // Cast response type
      this.isAuthenticating = false;
      
      // FIX: Check for response existence AND use access_token
      if (response && response.access_token) {
        this.username = this.email; // Set username for dashboard greeting
        this.password = '';          // Clear password field
        this.currentPage = 'dashboard';
        console.log("Login Successful. Token:", response.access_token);
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
    ).subscribe((response: AuthResponse | null) => { // Cast response type
      this.isAuthenticating = false;
      
      // Check for a successful (non-null) registration response
      if (response) { 
        console.log('Registration successful! Redirecting to Login tab.');

        // FIX: Clear registration fields
        this.username2 = '';
        this.phone_number = '';
        this.password = ''; 
        this.email = ''; 
        
        // Switch to 'login' page
        this.currentPage = 'login';
        
        // FIX: PROGRAMMATICALLY SWITCH THE TAB to the first tab (Login)
        setTimeout(() => {
            if (this.tabGroup) {
                this.tabGroup.selectedIndex = 0; 
            }
        }, 0); 
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
  // --- UI METHODS ---
  // -------------------------------------------------------------------

  showUsers(action: 'send' | 'receive') { this.selectedAction = action; }
  onUserSelected(user: any) { console.log('Selected user:', user); }
  toggleAction(action: 'send' | 'receive' | 'exchange') {
    this.selectedAction = (this.selectedAction === action) ? null : action;
  }
  
  // NEW: Method to initiate MetaMask connection
  async connectMetamask() {
    this.showAddressBox = false; // Hide display when attempting to connect

    if (typeof (window as any).ethereum !== 'undefined') {
        try {
            // This is the call that triggers the MetaMask extension UI
            const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
            
            if (accounts && accounts.length > 0) {
                this.walletAddress = accounts[0];
                console.log('Wallet connected successfully:', this.walletAddress);
                alert(`Connected to MetaMask! Address: ${this.walletAddress}`);
            }
        } catch (error: any) {
            console.error('User rejected connection or an error occurred:', error);
            this.walletAddress = null;
            if (error.code === 4001) {
                alert('Connection rejected by user.');
            } else {
                alert('Failed to connect to MetaMask.');
            }
        }
    } else {
        alert('MetaMask is not installed. Redirecting to download page.');
        this.goToMetamaskSite(); 
    }
  }

  // Keep this method available for users without the extension
  goToMetamaskSite() { window.open('https://metamask.io/download/', '_blank'); } 
  
  disconnectMetamask() { 
    this.walletAddress = null; 
    this.showAddressBox = false; // FIX: Hide display when disconnecting
    console.error('Wallet disconnected!'); 
  }
  
  // FIX: Update to control showAddressBox state
  showWalletAddress() { 
    if (this.walletAddress) {
      this.showAddressBox = true; 
    } else {
      console.error('No wallet connected');
      this.showAddressBox = false; // Ensure it's hidden if no wallet is connected
    }
  }

  toggleWalletAddressDisplay() {
    if (this.walletAddress) {
        // Flip the state: true becomes false, false becomes true
        this.showAddressBox = !this.showAddressBox;
    } else {
        // If no wallet is connected, just hide the box and give an error
        this.showAddressBox = false;
        console.error('Cannot show/hide address: No wallet connected.');
    }
}

  convertCurrency() { console.log(`Convert from ${this.exchangeFrom} to ${this.exchangeTo}`); }
  
  manageAccount() { 
    this.currentPage = 'account'; 
    this.showAddressBox = false; // Reset address visibility on page change
  }
}