    import { Injectable } from '@angular/core';
    import { HttpClient } from '@angular/common/http';
    import { Observable, throwError } from 'rxjs'; 

    // --- INTERFACES ---

    // Data expected for Login/Register payloads
    interface AuthPayload {
      password: string;
      email: string;
    }

    // Data expected back upon successful Login/Register
    export interface AuthResponse {
      access_token: string;
      // Add other properties if your backend returns them
    }

    // Data expected back for GET /payments/tx/{hash}
    interface PaymentTransaction {
      txHash: string;
      amount: number;
      status: 'pending' | 'completed' | 'failed' | 'cancelled';
      timestamp: string;
      sender: string;
      receiver: string;
    }

    interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

interface UpdateEmailPayload {
  email: string;
  password: string;
}

interface DeleteAccountPayload {
  password: string;
}

// --- NEW: Account Management Responses ---
interface AccountActionResponse {
  message: string;
}
    // Data structure for the wallet addresses array returned by the backend
    export interface WalletAddress {
      address: string;
    }

    // Interface for the POST /wallet/connect request body
    interface ConnectWalletPayload {
      message: string;
      signature: string;
    }

    // Interface for the POST /wallet/connect response body
    interface ConnectWalletResponse {
      message: string;
      walletAddress: string; 
    }

    // Interface for the POST /payments request body (based on the image)
    interface CreatePaymentPayload {
      amount: string;          // Sent as string (Wei or formatted ETH, depending on backend)
      currency: string;        // e.g., "ETH"
      description: string;
      to_address: string;      // Recipient address
      transaction_hash: string; // Hash received after the blockchain transaction completes
    }

    // Interface for the POST /payments response (assuming it returns the new transaction)
    interface CreatePaymentResponse {
      transaction_hash: string;
      status: string; // e.g., 'pending'
      // ... other fields from the 201 response in the image ...
    }

    // NEW: Interface for the transaction records retrieved from the backend (GET /payments)
    export interface TransactionRecord {
      id: string; // Internal record ID
      transaction_hash: string; // Blockchain Tx Hash
      from_address: string; // Sender (user's wallet)
      to_address: string; // Receiver
      amount: string; // The amount, likely in Wei or ETH string
      currency: string; // e.g., "ETH"
      description: string; // The description provided during sendPayment
      status: 'pending' | 'completed' | 'failed'; // Backend status of the record
      created_at: string; // Timestamp of record creation
    }


    @Injectable({
      providedIn: 'root'
    })
    export class PaymentService {

      constructor(private http: HttpClient) { }

      /**
       * Links to the backend endpoint: GET /wallet/balances
       * Returns an array of wallet addresses (strings)
       */
      getWalletBalances(token: string | null): Observable<string[]> {
        if (!token) {
          return throwError(() => new Error('Missing authentication token'));
        }
        const headers = { 'Authorization': `Bearer ${token}` };
        const endpoint = 'api/wallet/balances';
        return this.http.get<string[]>(endpoint, { headers });
      }

      /**
       * Links to the backend endpoint: POST /login (Assumed)
       */
      userLogin(payload: AuthPayload): Observable<AuthResponse> {
        const endpoint = "api/auth/login";
        return this.http.post<AuthResponse>(endpoint, payload);
      }

      /**
       * Links to the backend endpoint: POST /register (Assumed)
       */
      userRegister(payload: AuthPayload): Observable<AuthResponse> {
        const endpoint = "api/auth/signup";
        return this.http.post<AuthResponse>(endpoint, payload);
      }

      /**
       * Links to the backend endpoint: GET /payments/tx/{hash}
       */
      getTransactionDetails(transactionHash: string): Observable<PaymentTransaction> {
        const endpoint = `api/payments/tx/${transactionHash}`;
        return this.http.get<PaymentTransaction>(endpoint);
      }

      getExchangeRates(): Observable<any> {
      const url = "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd,inr,eur,gbp";
      return this.http.get(url);
    }
      /**
       * Links to the backend endpoint: GET /wallet/addresses/{phone_number}
       */
      getWalletAddressByPhone(phoneNumber: string, token: string | null): Observable<WalletAddress[]> {
        if (!token) {
          return throwError(() => new Error('Missing authentication token'));
        }
        const headers = { 'Authorization': `Bearer ${token}` };
        const endpoint = `api/wallet/addresses/${encodeURIComponent(phoneNumber)}`;
        return this.http.get<WalletAddress[]>(endpoint, { headers: headers });
      }

      /**
       * Links to the backend endpoint: POST /wallet/connect
       */
      connectWalletBackend(payload: ConnectWalletPayload, token: string | null): Observable<ConnectWalletResponse> {
        if (!token) {
          return throwError(() => new Error('Missing authentication token'));
        }
        const headers = { 'Authorization': `Bearer ${token}` };
        const endpoint = "api/wallet/connect";
        return this.http.post<ConnectWalletResponse>(endpoint, payload, { headers: headers });
      }

  

  changePassword(payload: { old_password: string, new_password: string }, token: string | null) {
  if (!token) return throwError(() => new Error('Missing token'));
  const headers = { 'Authorization': `Bearer ${token}` };
  return this.http.patch('api/account/change-password', payload, { headers });
}

updateEmail(payload: { email: string, password: string }, token: string | null) {
  if (!token) return throwError(() => new Error('Missing token'));
  const headers = { 'Authorization': `Bearer ${token}` };
  return this.http.patch('api/account/update-email', payload, { headers });
}

deleteAccount(payload: { password: string }, token: string | null) {
  if (!token) return throwError(() => new Error('Missing token'));
  const headers = { 'Authorization': `Bearer ${token}` };
  return this.http.request('delete', 'api/account/delete', { body: payload, headers });
}
      /**
       * Links to the backend endpoint: POST /payments (Authenticated)
       */
      createPaymentRecord(payload: CreatePaymentPayload, token: string | null): Observable<CreatePaymentResponse> {
        if (!token) {
          return throwError(() => new Error('Missing authentication token'));
        }
        const headers = { 'Authorization': `Bearer ${token}` };
        const endpoint = "api/payments";
        console.log("Sending payment record to backend:", payload);
        return this.http.post<CreatePaymentResponse>(endpoint, payload, { headers: headers });
      }
      
    getTransactionHistory(): Observable<any> {
  return this.http.get(`api/payments`);
}
      /**
       * NEW: Links to the backend endpoint: GET /payments (Authenticated)
       * Fetches all payment records for the authenticated user.
       */
      getRecentTransactions(token: string | null): Observable<TransactionRecord[]> {
        if (!token) {
          return throwError(() => new Error('Missing authentication token'));
        }
        const headers = { 'Authorization': `Bearer ${token}` };
        const endpoint = "api/payments"; 
        // Assuming backend returns transactions sorted by date descending
        return this.http.get<TransactionRecord[]>(endpoint, { headers: headers });
      }
    }
