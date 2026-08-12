import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { API_BASE, API_SESSION_SUFFIX } from '../app/api.config';

interface AuthResponse {
  success: boolean;
  token: string;
  user: any;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly inactivityMs = 20 * 60 * 1000;
  private readonly activityKey = `croquis_admin_last_activity${API_SESSION_SUFFIX}`;
  private readonly sessionMessageKey = `croquis_admin_session_message${API_SESSION_SUFFIX}`;
  private api = API_BASE;
  private tokenKey = `croquis_admin_token${API_SESSION_SUFFIX}`;
  private userKey = `croquis_admin_user${API_SESSION_SUFFIX}`;
  private userSubject = new BehaviorSubject<any>(this.getStoredUser());
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityHandled = 0;

  user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {
    ['pointerdown', 'mousemove', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, () => this.registrarActividad(), { passive: true });
    });

    if (this.isAuthenticated()) this.programarCierrePorInactividad();
  }

  login(credentials: { email: string; password: string }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/login`, credentials).pipe(
      tap((response) => this.guardarSesion(response.token, response.user))
    );
  }

  register(data: { name: string; email: string; password: string; password_confirmation: string; local_id: number }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/register`, data).pipe(
      tap((response) => this.guardarSesion(response.token, response.user))
    );
  }

  logout(): Observable<any> {
    return this.http.post(`${this.api}/logout`, {}).pipe(
      tap(() => this.limpiarSesion())
    );
  }

  cerrarSesionLocal(): void {
    this.limpiarSesion();
  }

  cerrarSesionExpirada(mensaje = 'Tu sesión terminó. Inicia sesión nuevamente.'): void {
    if (!this.isAuthenticated()) return;
    sessionStorage.setItem(this.sessionMessageKey, mensaje);
    this.limpiarSesion();
    void this.router.navigateByUrl('/admin/login');
  }

  consumirMensajeSesion(): string {
    const mensaje = sessionStorage.getItem(this.sessionMessageKey) || '';
    sessionStorage.removeItem(this.sessionMessageKey);
    return mensaje;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return Boolean(this.getToken());
  }

  private guardarSesion(token: string, user: any): void {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
    this.userSubject.next(user);
    this.marcarActividad();
  }

  private limpiarSesion(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.activityKey);
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = null;
    this.userSubject.next(null);
  }

  private registrarActividad(): void {
    if (!this.isAuthenticated()) return;
    const now = Date.now();
    if (now - this.lastActivityHandled < 1000) return;
    this.lastActivityHandled = now;
    this.marcarActividad();
  }

  private marcarActividad(): void {
    localStorage.setItem(this.activityKey, String(Date.now()));
    this.programarCierrePorInactividad();
  }

  private programarCierrePorInactividad(): void {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    const lastActivity = Number(localStorage.getItem(this.activityKey) || Date.now());
    const remaining = Math.max(0, this.inactivityMs - (Date.now() - lastActivity));
    this.inactivityTimer = setTimeout(() => {
      this.cerrarSesionExpirada('La sesión se cerró después de 20 minutos de inactividad.');
    }, remaining);
  }

  private getStoredUser(): any {
    const raw = localStorage.getItem(this.userKey);
    return raw ? JSON.parse(raw) : null;
  }
}
