import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';
import { API_BASE } from '../app/api.config';

@Injectable({
  providedIn: 'root'
})
export class LocalService {

  api = API_BASE;

  constructor(
    private http: HttpClient
  ) {}

  getLocales(publicView = false) {

    return this.http.get(
      `${this.api}/locales${publicView ? '?public=1' : ''}`
    );

  }

  getUsuarios() {
    return this.http.get(`${this.api}/usuarios`);
  }

  crearUsuario(data: any) {
    return this.http.post(`${this.api}/usuarios`, data);
  }

  actualizarUsuario(id: number, data: any) {
    return this.http.put(`${this.api}/usuarios/${id}`, data);
  }

  desactivarUsuario(id: number) {
    return this.http.delete(`${this.api}/usuarios/${id}`);
  }

  eliminarUsuario(id: number) {
    return this.http.delete(`${this.api}/usuarios/${id}/eliminar`);
  }

  getComponentes(localId?: number) {
    const suffix = localId ? `?local_id=${localId}` : '';
    return this.http.get(`${this.api}/componentes${suffix}`);
  }

  crearComponente(data: any) {
    return this.http.post(`${this.api}/componentes`, data);
  }

  actualizarComponente(id: number, data: any) {
    return this.http.put(`${this.api}/componentes/${id}`, data);
  }

  eliminarComponente(id: number) {
    return this.http.delete(`${this.api}/componentes/${id}`);
  }

  subirArchivoComponente(id: number, campo: 'imagen' | 'icono', file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.http.post(`${this.api}/componentes/${id}/${campo}/archivo`, formData);
  }

  eliminarArchivoComponente(id: number, campo: 'imagen' | 'icono') {
    return this.http.delete(`${this.api}/componentes/${id}/${campo}/archivo`);
  }

  getAdminSettings() {
    return this.http.get(`${this.api}/admin-settings`);
  }

  actualizarAdminSettings(data: any) {
    return this.http.put(`${this.api}/admin-settings`, data);
  }

  subirLogoAdmin(file: File) {
    const formData = new FormData();
    formData.append('logo', file);

    return this.http.post(`${this.api}/admin-settings/logo`, formData);
  }

  crearLocal(data: any) {
    return this.http.post(
      `${this.api}/locales`,
      data
    );
  }

  actualizarLocal(id: number, data: any) {
    return this.http.put(
      `${this.api}/locales/${id}`,
      data
    );
  }

  eliminarLocal(id: number) {
    return this.http.delete(
      `${this.api}/locales/${id}`
    );
  }

  actualizarInformacionLocal(id: number, data: any) {
    return this.http.put(
      `${this.api}/locales/${id}/informacion`,
      data
    );
  }

  subirLogo(id: number, file: File) {
    const formData = new FormData();
    formData.append('logo', file);

    return this.http.post(
      `${this.api}/locales/${id}/logo`,
      formData
    );
  }

  crearProducto(data: any) {
    return this.http.post(
      `${this.api}/productos`,
      data
    );
  }

  crearServicio(data: any) {
    return this.http.post(
      `${this.api}/servicios`,
      data
    );
  }

  buscarGlobal(texto: string) {
    return this.http.get(
      `${this.api}/buscar/${encodeURIComponent(texto)}`
    );
  }

}
