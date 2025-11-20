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

// Data structure for the wallet addresses array returned by the backend
export interface WalletAddress {
  address: string;
}

// NEW: Interface for the POST /wallet/connect request body
interface ConnectWalletPayload {
  message: string;
  signature: string;
}

// NEW: Interface for the POST /wallet/connect response body
interface ConnectWalletResponse {
  message: string;
  walletAddress: string; // Assuming the server returns the connected address
}


@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  constructor(private http: HttpClient) { }

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
   * NEW: Links to the backend endpoint: POST /wallet/connect
   * Connects the wallet by verifying the signature against the token.
   */
  connectWalletBackend(payload: ConnectWalletPayload, token: string | null): Observable<ConnectWalletResponse> {
    if (!token) {
      return throwError(() => new Error('Missing authentication token'));
    }
    const headers = { 'Authorization': `Bearer ${token}` };
    const endpoint = "api/wallet/connect";
    
    // NOTE: The backend expects the payload (message, signature) in the body.
    return this.http.post<ConnectWalletResponse>(endpoint, payload, { headers: headers });
  }
}