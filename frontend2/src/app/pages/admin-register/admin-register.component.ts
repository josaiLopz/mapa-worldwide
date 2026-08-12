import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../services/auth.service';
import { LocalService } from '../../../services/local.service';
import { API_ORIGIN } from '../../api.config';

@Component({
  selector: 'app-admin-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-register.component.html',
  styleUrls: ['./admin-register.component.scss']
})
export class AdminRegisterComponent implements OnInit {
  locales: any[] = [];
  cargando = false;
  mensaje = '';
  adminSettings: any = { background_color: '#0c0f0f', logo: '' };
  adminLogoPreview = '';
  private apiBase = API_ORIGIN;

  form = {
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
    this.localService.getAdminSettings().subscribe({
      next: (settings: any) => {
        this.adminSettings = settings;
        this.adminLogoPreview = this.logoUrl(settings.logo);
      },
      error: () => {}
    });

    this.localService.getLocales(true).subscribe({
      next: (locales: any) => this.locales = locales,
      error: (err) => {
        console.error(err);
        this.mensaje = 'No se pudieron cargar los locales.';
      }
    });
  }

  etiquetaLocal(local: any): string {
    const numero = local?.numero_local ? `Local ${local.numero_local}` : '';
    const nombre = local?.nombre || '';
    return numero && nombre ? `${numero} - ${nombre}` : (numero || nombre || 'Local');
  }

  logoUrl(logo: string | null | undefined): string {
    if (!logo) return '';
    return logo.startsWith('http') ? logo : `${this.apiBase}${logo}`;
  }

  registrarse(): void {
    this.mensaje = '';

    if (!this.form.name.trim() || !this.form.email.trim() || !this.form.password) {
      this.mensaje = 'Nombre, correo y contrasena son obligatorios.';
      return;
    }

    if (!this.form.local_id) {
      this.mensaje = 'Seleccione el local que va a administrar.';
      return;
    }

    if (this.form.password !== this.form.password_confirmation) {
      this.mensaje = 'La confirmacion de contrasena no coincide.';
      return;
    }

    this.cargando = true;
    this.authService.register({
      ...this.form,
      local_id: Number(this.form.local_id)
    }).subscribe({
      next: () => this.router.navigateByUrl('/admin/map-editor'),
      error: (err) => {
        console.error(err);
        this.cargando = false;
        this.mensaje = err?.error?.message
          || Object.values(err?.error?.errors || {}).flat().join(' ')
          || 'No se pudo completar el registro.';
      }
    });
  }
}
