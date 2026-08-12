import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_BASE } from '../app/api.config';

@Injectable({
  providedIn: 'root'
})
export class MapaService {

  private api = API_BASE;

  constructor(
    private http: HttpClient
  ) {}

  getMapas() {
    return this.http.get(
      `${this.api}/mapas`
    );
  }

  crearMapa(data: any) {
    return this.http.post(
      `${this.api}/mapas`,
      data
    );
  }

  guardarObjeto(data: any) {
    return this.http.post(
      `${this.api}/mapa_objetos`,
      data
    );
  }

  actualizarObjeto(id: number, data: any) {
    return this.http.put(
      `${this.api}/mapa_objetos/${id}`,
      data
    );
  }

  getObjetos(mapaId: number, publicView = false) {
    return this.http.get(
      `${this.api}/mapa_objetos?mapa_id=${mapaId}${publicView ? '&public=1' : ''}`
    );
  }

  eliminarObjeto(id: number) {
    return this.http.delete(
      `${this.api}/mapa_objetos/${id}`
    );
  }

}
