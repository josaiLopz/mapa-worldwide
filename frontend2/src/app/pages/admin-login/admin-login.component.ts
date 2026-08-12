import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { LocalService } from '../../../services/local.service';
import { API_ORIGIN } from '../../api.config';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.scss']
})
export class AdminLoginComponent implements OnInit {
  modo: 'login' | 'register' = 'login';
  cargando = false;
  mensaje = '';
  adminSettings: any = { background_color: '#eef2f6', logo: '' };
  adminLogoPreview = '';
  private apiBase = API_ORIGIN;

  loginForm = {
    email: '',
    password: ''
  };

  registerForm = {
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    local_id: 0
  };

  constructor(
    private authService: AuthService,
    private localService: LocalService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.mensaje = this.authService.consumirMensajeSesion();
    this.localService.getAdminSettings().subscribe({
      next: (settings: any) => {
        this.adminSettings = settings;
        this.adminLogoPreview = this.logoUrl(settings.logo);
      },
      error: () => {}
    });
  }

  logoUrl(logo: string | null | undefined): string {
    if (!logo) return '';
    return logo.startsWith('http') ? logo : `${this.apiBase}${logo}`;
  }

  iniciarSesion(): void {
    if (!this.loginForm.email || !this.loginForm.password) {
      this.mensaje = 'Captura correo y contrasena.';
      return;
    }

    this.cargando = true;
    this.mensaje = '';

    this.authService.login(this.loginForm).subscribe({
      next: () => this.router.navigateByUrl('/admin/map-editor'),
      error: () => {
        this.cargando = false;
        this.mensaje = 'Credenciales incorrectas.';
      }
    });
  }

  crearUsuario(): void {
    if (!this.registerForm.name || !this.registerForm.email || !this.registerForm.password) {
      this.mensaje = 'Completa nombre, correo y contrasena.';
      return;
    }

    if (this.registerForm.password !== this.registerForm.password_confirmation) {
      this.mensaje = 'Las contrasenas no coinciden.';
      return;
    }

    this.cargando = true;
    this.mensaje = '';

    this.authService.register(this.registerForm).subscribe({
      next: () => this.router.navigateByUrl('/admin/map-editor'),
      error: (err) => {
        this.cargando = false;
        this.mensaje = err?.error?.message || 'No se pudo crear el usuario.';
      }
    });
  }
}
