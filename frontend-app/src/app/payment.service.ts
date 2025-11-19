import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// --- INTERFACES ---

// Data expected for Login/Register payloads
interface AuthPayload {
  password: string;
  email: string; // Optional for login endpoint
}

// Data expected back upon successful Login/Register
interface AuthResponse {
  access_token: string;
  // Add other properties if your backend returns them
}

// Data expected back for GET /payments/tx/{hash}
interface PaymentTransaction {
  txHash: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  sender: string;
  receiver: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentService {

  // Finalized Live Backend URL
  private readonly API_BASE_URL = 'http://localhost:8080';

  constructor(private http: HttpClient) { }

  /**
   * Links to the backend endpoint: POST /login (Assumed)
   */
  userLogin(payload: AuthPayload): Observable<AuthResponse> {
    const endpoint = `${this.API_BASE_URL}/auth/login`;
    console.log(`Calling backend login endpoint: ${endpoint}`);
    return this.http.post<AuthResponse>(endpoint, payload);
  }

  /**
   * Links to the backend endpoint: POST /register (Assumed)
   */
  userRegister(payload: AuthPayload): Observable<AuthResponse> {
    const endpoint = `${this.API_BASE_URL}/auth/signup`;
    console.log(`Calling backend register endpoint: ${endpoint}`);
    return this.http.post<AuthResponse>(endpoint, payload);
  }

  /**
   * Links to the backend endpoint: GET /payments/tx/{hash}
   */
  getTransactionDetails(transactionHash: string): Observable<PaymentTransaction> {
    const endpoint = `${this.API_BASE_URL}/payments/tx/${transactionHash}`;
    console.log(`Calling backend endpoint: ${endpoint}`);
    return this.http.get<PaymentTransaction>(endpoint);
  }
}