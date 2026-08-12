import {
  Component,
  HostListener,
  OnInit,
  AfterViewInit
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { API_ORIGIN } from '../../api.config';
import { of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { Canvas, Rect, Line, FabricImage } from 'fabric';

import { LocalService } from '../../../services/local.service';
import { MapaService } from '../../../services/mapa.service';
import { AuthService } from '../../../services/auth.service';

interface ProductoForm {
  id?: number;
  nombre: string;
  descripcion: string;
  precio: number | null;
}

interface ServicioForm {
  id?: number;
  nombre: string;
  descripcion: string;
}

interface ComponenteForm {
  id?: number;
  local_id: number | null;
  tipo: string;
  nombre: string;
  descripcion: string;
  costo: number | null;
  imagen: string;
  icono: string;
  activo: boolean;
}

type SocialField = 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'x' | 'telegram';

@Component({
  selector: 'app-map-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-editor.component.html',
  styleUrls: ['./map-editor.component.scss']
})
export class MapEditorComponent implements OnInit, AfterViewInit {

  canvas!: Canvas;
  canvasBaseWidth = 1800;
  canvasBaseHeight = 1000;
  mapScale = 1;
  canvasLabels: any[] = [];

  mapaId = 1;
  mapaCargado = false;
  locales: any[] = [];
  objetosMapa: any[] = [];
  localSeleccionado = 0;
  objetoSeleccionado: any = null;
  mostrarGuiaAdmin = false;
  private guiaInicializada = false;

  guardando = false;
  mensaje = '';
  busqueda = '';
  resultados: any = null;
  localEditandoId: number | null = null;
  logoFile: File | null = null;
  logoPreview = '';
  private apiBase = API_ORIGIN;
  usuarioActual: any = null;
  adminSettings: any = { background_color: '#f3f4f6', logo: '' };
  adminLogoPreview = '';
  adminLogoFile: File | null = null;
  panelActivo: 'locales' | 'componentes' | 'usuarios' | 'configuracion' | null = null;
  usuarios: any[] = [];
  usuarioEditandoId: number | null = null;
  usuarioForm = this.nuevoUsuarioForm();
  componentes: any[] = [];
  componenteEditandoId: number | null = null;
  componenteForm: ComponenteForm = this.nuevoComponenteForm();
  componenteImagenFile: File | null = null;
  componenteIconoFile: File | null = null;
  componenteImagenPreview = '';
  componenteIconoPreview = '';
  socialFields: Array<{ key: SocialField; label: string; placeholder: string }> = [
    { key: 'facebook', label: 'Facebook', placeholder: 'URL de Facebook' },
    { key: 'instagram', label: 'Instagram', placeholder: 'URL de Instagram' },
    { key: 'tiktok', label: 'TikTok', placeholder: 'URL de TikTok' },
    { key: 'youtube', label: 'YouTube', placeholder: 'URL de YouTube' },
    { key: 'x', label: 'X', placeholder: 'URL de X' },
    { key: 'telegram', label: 'Telegram', placeholder: 'URL o usuario de Telegram' }
  ];
  visibleSocialFields: Record<SocialField, boolean> = {
    facebook: true,
    instagram: true,
    tiktok: false,
    youtube: false,
    x: false,
    telegram: false
  };
  tiposComponentes = [
    'Infraestructura',
    'Mobiliario',
    'Servicios',
    'Otros'
  ];

  localForm = this.nuevoLocalForm();
  productos: ProductoForm[] = [this.nuevoProductoForm()];
  servicios: ServicioForm[] = [this.nuevoServicioForm()];

  // Nuevas propiedades
  sidePanelVisible = true;                     // controla visibilidad de barra lateral
  private guideLines: any[] = [];              // almacena líneas guía temporales
  private saveTimeout: any = null;             // para debounce del guardado al mover con teclas

  constructor(
    private localService: LocalService,
    private mapaService: MapaService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe((user) => {
      this.usuarioActual = user;
      this.iniciarGuiaAdmin();
      if (this.esSuperadmin()) {
        this.cargarUsuarios();
      }
    });
    this.cargarLocales();
    this.cargarComponentes();
    this.cargarAdminSettings();
    this.cargarMapaActivo();
  }

  ngAfterViewInit(): void {
    this.canvas = new Canvas('mapCanvas', {
      width: this.canvasBaseWidth,
      height: this.canvasBaseHeight,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true
    });

    this.canvas.on('object:modified', (e) => {
      this.limitarComponenteAlLocal(e.target);
      this.ajustarComponentesDelLocal(e.target);
      this.guardarObjeto(e.target);
      this.actualizarEtiquetasCanvas();
      this.limpiarGuias();
    });
    this.canvas.on('object:moving', (e) => {
      this.limitarComponenteAlLocal(e.target);
      this.actualizarEtiquetasCanvas();
      this.dibujarGuias(e.target);
    });
    this.canvas.on('object:scaling', (e) => {
      this.limitarComponenteAlLocal(e.target);
      this.actualizarEtiquetasCanvas();
    });
    this.canvas.on('selection:created', (e) => this.seleccionarObjetoCanvas(e.selected?.[0] ?? null));
    this.canvas.on('selection:updated', (e) => this.seleccionarObjetoCanvas(e.selected?.[0] ?? null));
    this.canvas.on('selection:cleared', () => {
      this.seleccionarObjetoCanvas(null);
      this.limpiarGuias();
    });
    // Limpiar guías al soltar el ratón
    this.canvas.on('mouse:up', () => this.limpiarGuias());

    setTimeout(() => this.redimensionarCanvas());

    if (this.mapaCargado) {
      this.cargarCanvas();
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.redimensionarCanvas();
  }

  // ──── Toggle barra lateral ────
  toggleSidePanel(): void {
    this.sidePanelVisible = !this.sidePanelVisible;
    // Redimensionar canvas después de que el layout se actualice
    setTimeout(() => this.redimensionarCanvas(), 0);
  }

  togglePanelActivo(panel: 'locales' | 'componentes' | 'usuarios' | 'configuracion'): void {
    this.panelActivo = this.panelActivo === panel ? null : panel;
  }

  cerrarPanelActivo(): void {
    this.panelActivo = null;
  }

  abrirGuiaAdmin(): void {
    this.mostrarGuiaAdmin = true;
  }

  cerrarGuiaAdmin(): void {
    const userId = this.usuarioActual?.id || 'general';
    localStorage.setItem(`croquis_guia_admin_v1_${userId}`, '1');
    this.mostrarGuiaAdmin = false;
  }

  private iniciarGuiaAdmin(): void {
    if (!this.usuarioActual || this.guiaInicializada) return;
    this.guiaInicializada = true;
    const key = `croquis_guia_admin_v1_${this.usuarioActual.id || 'general'}`;
    this.mostrarGuiaAdmin = !localStorage.getItem(key);
  }

  // ──── Movimiento con teclas de flecha ────
  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    // Solo actuar si no estamos escribiendo en un campo de entrada
    if (['input', 'textarea', 'select'].includes(tag) || (event.target as HTMLElement)?.isContentEditable) {
      return;
    }

    const activeObject = this.canvas?.getActiveObject();
    if (!activeObject) return;
    if (!this.puedeEditarObjeto(activeObject)) return;

    const step = event.shiftKey ? 10 : 1;
    let moved = false;

    switch (event.key) {
      case 'ArrowLeft':
        activeObject.set('left', (activeObject.left ?? 0) - step);
        moved = true;
        break;
      case 'ArrowUp':
        activeObject.set('top', (activeObject.top ?? 0) - step);
        moved = true;
        break;
      case 'ArrowRight':
        activeObject.set('left', (activeObject.left ?? 0) + step);
        moved = true;
        break;
      case 'ArrowDown':
        activeObject.set('top', (activeObject.top ?? 0) + step);
        moved = true;
        break;
    }

    if (moved) {
      event.preventDefault();
      this.limitarComponenteAlLocal(activeObject);
      activeObject.setCoords();
      this.canvas.requestRenderAll();
      this.actualizarEtiquetasCanvas();
      this.limpiarGuias();
      // Debounce para no saturar el backend con cada pulsación
      this.debouncedGuardar(activeObject);
    }
  }

  // ──── Métodos de líneas guía ────
  private dibujarGuias(target: any): void {
    this.limpiarGuias();
    if (!target) return;

    const activeCenter = target.getCenterPoint();
    const threshold = 5; // píxeles de tolerancia para alinear
    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();

    this.canvas.getObjects().forEach((obj: any) => {
      if (obj === target) return;
      const objCenter = obj.getCenterPoint();

      // Guía vertical (centros alineados horizontalmente)
      if (Math.abs(activeCenter.x - objCenter.x) < threshold) {
        const line = new Line([activeCenter.x, 0, activeCenter.x, canvasHeight], {
          stroke: '#ff4081',
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          excludeFromExport: true
        });
        this.canvas.add(line);
        this.guideLines.push(line);
      }

      // Guía horizontal (centros alineados verticalmente)
      if (Math.abs(activeCenter.y - objCenter.y) < threshold) {
        const line = new Line([0, activeCenter.y, canvasWidth, activeCenter.y], {
          stroke: '#ff4081',
          strokeWidth: 1,
          strokeDashArray: [5, 5],
          selectable: false,
          evented: false,
          excludeFromExport: true
        });
        this.canvas.add(line);
        this.guideLines.push(line);
      }
    });
  }

  private limpiarGuias(): void {
    this.guideLines.forEach(line => this.canvas.remove(line));
    this.guideLines = [];
  }

  // Debounce para guardado (evita múltiples peticiones al mover con teclas)
  private debouncedGuardar(obj: any): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      this.guardarObjeto(obj);
    }, 400);
  }

  // ──── Resto de métodos (sin cambios) ────

  cargarMapaActivo(): void {
    this.mapaService.getMapas().pipe(
      switchMap((mapas: any) => {
        if (mapas.length) {
          return of(mapas[0]);
        }

        return this.mapaService.crearMapa({
          nombre: 'Mapa principal',
          descripcion: 'Canvas principal',
          ancho: this.canvasBaseWidth,
          alto: this.canvasBaseHeight,
          niveles: 1,
          activo: true
        });
      })
    ).subscribe({
      next: (mapa: any) => {
        this.mapaId = mapa.id;
        this.mapaCargado = true;

        if (this.canvas) {
          this.cargarCanvas();
        }
      },
      error: (err) => {
        console.error(err);
        this.mensaje = 'No se pudo cargar o crear el mapa.';
      }
    });
  }

  cargarLocales(): void {
    this.localService.getLocales().subscribe({
      next: (data: any) => {
        this.locales = data;
        this.asignarLocalGestionablePorDefecto();
        this.actualizarEtiquetasCanvas();
      },
      error: (err) => console.error(err)
    });
  }

  cargarUsuarios(): void {
    if (!this.esSuperadmin()) return;

    this.localService.getUsuarios().subscribe({
      next: (data: any) => this.usuarios = data,
      error: (err) => console.error(err)
    });
  }

  cargarComponentes(): void {
    this.localService.getComponentes().subscribe({
      next: (data: any) => {
        this.componentes = data;
        this.actualizarEtiquetasCanvas();
      },
      error: (err) => console.error(err)
    });
  }

  cargarAdminSettings(): void {
    this.localService.getAdminSettings().subscribe({
      next: (settings: any) => {
        this.adminSettings = settings;
        this.adminLogoPreview = this.logoUrl(settings.logo);
      },
      error: (err) => console.error(err)
    });
  }

  cargarCanvas(): void {
    this.mapaService.getObjetos(this.mapaId).subscribe({
      next: async (data: any) => {
        this.objetosMapa = data;
        this.canvas.clear();
        this.canvas.backgroundColor = '#ffffff';

        const objetosVisuales = await Promise.all(
          data.map((objeto: any) => this.crearVisualDesdeObjeto(objeto))
        );
        objetosVisuales.forEach((objeto: any) => this.canvas.add(objeto));

        this.redimensionarCanvas();
        this.actualizarResaltadoCanvas();
        this.actualizarEtiquetasCanvas();
        this.canvas.renderAll();
      },
      error: (err) => console.error(err)
    });
  }

  guardarInformacionLocal(): void {
    if (!this.esSuperadmin() && !this.localEditandoId) {
      this.mensaje = 'Seleccione uno de sus locales asignados para editarlo.';
      return;
    }

    if (!this.localForm.nombre.trim()) {
      this.mensaje = 'El nombre del local es obligatorio.';
      return;
    }

    this.guardando = true;
    this.mensaje = '';

    const payload = {
      numero_local: this.localForm.numero_local,
      nombre: this.localForm.nombre,
      descripcion: this.localForm.descripcion,
      horario: this.localForm.horario,
      logo: this.localForm.logo,
      telefono: this.localForm.telefono,
      correo: this.localForm.correo,
      facebook: this.localForm.facebook,
      instagram: this.localForm.instagram,
      tiktok: this.localForm.tiktok,
      youtube: this.localForm.youtube,
      x: this.localForm.x,
      telegram: this.localForm.telegram,
      whatsapp: this.localForm.whatsapp,
      sitio_web: this.localForm.sitio_web,
      activo: true,
      productos: this.productos
        .filter((producto) => producto.nombre.trim())
        .map((producto) => ({
          id: producto.id,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: producto.precio
        })),
      servicios: this.servicios
        .filter((servicio) => servicio.nombre.trim())
        .map((servicio) => ({
          id: servicio.id,
          nombre: servicio.nombre,
          descripcion: servicio.descripcion
        }))
    };

    const request = this.localEditandoId
      ? this.localService.actualizarInformacionLocal(this.localEditandoId, payload)
      : this.localService.crearLocal(payload).pipe(
        switchMap((local: any) => this.localService.actualizarInformacionLocal(local.id, payload))
      );

    request.pipe(
      switchMap((local: any) => {
        return this.logoFile
          ? this.localService.subirLogo(local.id, this.logoFile)
          : of(local);
      })
    ).subscribe({
      next: (local: any) => {
        const estabaEditando = Boolean(this.localEditandoId);
        this.localSeleccionado = local.id;

        if (!estabaEditando) {
          this.crearLocalEnCanvas(local.id, local.nombre);
        } else {
          this.actualizarLocalEnCanvas(local.id, local.nombre);
        }

        this.cargarLocales();
        this.resetFormularioLocal();
        this.guardando = false;
        this.mensaje = estabaEditando
          ? 'Informacion del local actualizada.'
          : 'Local creado y agregado al canvas.';
      },
      error: (err) => {
        console.error(err);
        this.guardando = false;
        this.mensaje = 'No se pudo guardar el local. Revisa los datos.';
      }
    });
  }

  editarLocalSeleccionado(): void {
    if (!this.localSeleccionado) {
      this.mensaje = 'Seleccione un local para editar.';
      return;
    }
    if (!this.puedeEditarLocalId(this.localSeleccionado)) {
      this.mensaje = 'Puede ver este local, pero solo puede editar los locales asignados.';
      return;
    }

    const local = this.locales.find((item) => Number(item.id) === Number(this.localSeleccionado));

    if (!local) {
      this.mensaje = 'No se encontro el local seleccionado.';
      return;
    }

    this.localEditandoId = local.id;
    this.logoFile = null;
    this.logoPreview = this.logoUrl(local.logo);
    this.localForm = {
      ...this.nuevoLocalForm(),
      numero_local: local.numero_local || '',
      nombre: local.nombre || '',
      descripcion: local.descripcion || '',
      horario: local.horario || '',
      logo: local.logo || '',
      telefono: local.telefono || '',
      correo: local.correo || '',
      whatsapp: local.whatsapp || '',
      facebook: local.facebook || '',
      instagram: local.instagram || '',
      tiktok: local.tiktok || '',
      youtube: local.youtube || '',
      x: local.x || '',
      telegram: local.telegram || '',
      sitio_web: local.sitio_web || ''
    };
    this.sincronizarRedesVisiblesDesdeFormulario();

    const objetoLocal = this.buscarObjetoCanvasPorLocal(local.id);
    if (objetoLocal) {
      this.localForm.width = Math.round((objetoLocal.width ?? 0) * (objetoLocal.scaleX ?? 1));
      this.localForm.height = Math.round((objetoLocal.height ?? 0) * (objetoLocal.scaleY ?? 1));
      this.localForm.color = objetoLocal.get('fill') || '#d6d6d6';
      this.canvas.setActiveObject(objetoLocal);
      this.seleccionarObjetoCanvas(objetoLocal);
    }

    this.productos = local.productos?.length
      ? local.productos.map((producto: any) => ({
        id: producto.id,
        nombre: producto.nombre || '',
        descripcion: producto.descripcion || '',
        precio: producto.precio
      }))
      : [this.nuevoProductoForm()];
    this.servicios = local.servicios?.length
      ? local.servicios.map((servicio: any) => ({
        id: servicio.id,
        nombre: servicio.nombre || '',
        descripcion: servicio.descripcion || ''
      }))
      : [this.nuevoServicioForm()];
    this.mensaje = 'Editando local seleccionado.';
  }

  etiquetaLocal(local: any): string {
    const numero = local?.numero_local ? `Local ${local.numero_local}` : '';
    const nombre = local?.nombre || '';

    if (numero && nombre) return `${numero} - ${nombre}`;
    return numero || nombre || 'Local';
  }

  cancelarEdicion(): void {
    this.resetFormularioLocal();
    this.mensaje = 'Edicion cancelada.';
  }

  eliminarLocalSeleccionado(): void {
    if (!this.esSuperadmin()) return;

    const localId = Number(this.localEditandoId || this.localSeleccionado || 0);
    if (!localId) {
      this.mensaje = 'Seleccione un local para eliminar.';
      return;
    }

    const local = this.locales.find((item) => Number(item.id) === localId);
    const nombre = local ? this.etiquetaLocal(local) : 'este local';
    const confirmar = window.confirm(`Eliminar ${nombre}? Tambien se quitaran sus productos, servicios, componentes y objetos del canvas.`);
    if (!confirmar) return;

    this.localService.eliminarLocal(localId).subscribe({
      next: () => {
        this.canvas?.getObjects()
          .filter((objeto: any) => Number(objeto.get('local_id')) === localId)
          .forEach((objeto: any) => this.canvas.remove(objeto));

        this.canvas?.discardActiveObject();
        this.canvas?.requestRenderAll();
        this.actualizarEtiquetasCanvas();
        this.cargarLocales();
        this.cargarComponentes();
        this.resetFormularioLocal();
        this.localSeleccionado = 0;
        this.mensaje = 'Local eliminado.';
      },
      error: (err) => {
        console.error(err);
        this.mensaje = err?.error?.message || 'No se pudo eliminar el local.';
      }
    });
  }

  puedeEliminarLocal(): boolean {
    return Boolean(Number(this.localEditandoId || this.localSeleccionado || 0));
  }

  mostrarRedSocial(key: string): void {
    if (!this.esSocialField(key)) return;
    this.visibleSocialFields[key] = true;
  }

  ocultarRedSocial(key: SocialField): void {
    this.visibleSocialFields[key] = false;
    this.localForm[key] = '';
  }

  private esSocialField(key: string): key is SocialField {
    return this.socialFields.some((field) => field.key === key);
  }

  redesOcultas(): Array<{ key: SocialField; label: string; placeholder: string }> {
    return this.socialFields.filter((field) => !this.visibleSocialFields[field.key]);
  }

  private sincronizarRedesVisiblesDesdeFormulario(): void {
    this.visibleSocialFields = {
      facebook: Boolean(this.localForm.facebook) || true,
      instagram: Boolean(this.localForm.instagram) || true,
      tiktok: Boolean(this.localForm.tiktok),
      youtube: Boolean(this.localForm.youtube),
      x: Boolean(this.localForm.x),
      telegram: Boolean(this.localForm.telegram)
    };
  }

  seleccionarLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.logoFile = file;
    this.logoPreview = URL.createObjectURL(file);
  }

  seleccionarAdminLogo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.adminLogoFile = file;
    this.adminLogoPreview = URL.createObjectURL(file);
  }

  guardarAdminSettings(): void {
    this.localService.actualizarAdminSettings({
      background_color: this.adminSettings.background_color || '#f3f4f6'
    }).pipe(
      switchMap((settings: any) => this.adminLogoFile ? this.localService.subirLogoAdmin(this.adminLogoFile) : of(settings))
    ).subscribe({
      next: (settings: any) => {
        this.adminSettings = settings;
        this.adminLogoPreview = this.logoUrl(settings.logo);
        this.adminLogoFile = null;
        this.mensaje = 'Configuracion guardada.';
      },
      error: (err) => {
        console.error(err);
        this.mensaje = 'No se pudo guardar la configuracion.';
      }
    });
  }

  logoUrl(logo: string | null | undefined): string {
    if (!logo) return '';
    return logo.startsWith('http') ? logo : `${this.apiBase}${logo}`;
  }

  crearLocalExistente(): void {
    if (!this.localSeleccionado) {
      this.mensaje = 'Seleccione un local.';
      return;
    }
    if (!this.puedeEditarLocalId(this.localSeleccionado)) {
      this.mensaje = 'Solo puede agregar al canvas locales asignados a su usuario.';
      return;
    }

    const local = this.locales.find((item) => Number(item.id) === Number(this.localSeleccionado));
    this.localForm.color = this.localForm.color || '#d6d6d6';
    this.crearLocalEnCanvas(this.localSeleccionado, local?.nombre ?? 'Local');
  }

  crearLocalEnCanvas(localId: number, nombre: string): void {
    const rect = new Rect({
      left: 100,
      top: 100,
      width: Number(this.localForm.width) || 150,
      height: Number(this.localForm.height) || 100,
      fill: this.localForm.color || '#d6d6d6',
      stroke: '#202124',
      strokeWidth: 1,
      angle: 0
    });

    rect.set({
      tipo: 'local',
      local_id: Number(localId),
      nombre
    } as any);

    this.canvas.add(rect);
    this.canvas.setActiveObject(rect);
    this.canvas.renderAll();
    this.actualizarEtiquetasCanvas();
    this.guardarObjeto(rect);
  }

  crearEscalera(): void {
    this.crearObjetoMapa('escalera', 'Escalera', '#f39c12', 120, 80);
  }

  crearObjetoMapa(tipo: string, nombre: string, color: string, width = 140, height = 90): void {
    const rect = new Rect({
      left: 100,
      top: 100,
      width,
      height,
      fill: color,
      stroke: '#7a4b00',
      strokeWidth: 1
    });

    rect.set({
      tipo,
      nombre
    } as any);

    this.canvas.add(rect);
    this.canvas.setActiveObject(rect);
    this.actualizarEtiquetasCanvas();
    this.guardarObjeto(rect);
  }

  async agregarComponenteAlCanvas(componente: any): Promise<void> {
    if (!componente?.id) return;

    const existente = componente.local_id
      ? this.canvas.getObjects().find((objeto: any) =>
        Number(objeto.get('component_id')) === Number(componente.id)
      )
      : null;
    if (existente) {
      this.canvas.setActiveObject(existente);
      this.seleccionarObjetoCanvas(existente);
      this.canvas.requestRenderAll();
      this.mensaje = 'El componente ya esta agregado al canvas.';
      return;
    }

    const local = componente.local_id
      ? this.buscarObjetoCanvasPorLocal(Number(componente.local_id))
      : null;
    if (componente.local_id && !local) {
      this.mensaje = 'Primero agregue el local correspondiente al canvas.';
      return;
    }

    const localWidth = local ? Number(local.width || 1) * Number(local.scaleX || 1) : 64;
    const localHeight = local ? Number(local.height || 1) * Number(local.scaleY || 1) : 54;
    const width = local ? Math.max(24, Math.min(64, localWidth - 12)) : 64;
    const height = local ? Math.max(24, Math.min(54, localHeight - 12)) : 54;

    const visual = await this.crearVisualComponente(componente, {
      left: local ? Number(local.left || 0) + (localWidth - width) / 2 : 100,
      top: local ? Number(local.top || 0) + (localHeight - height) / 2 : 100,
      width,
      height,
      fill: this.colorComponente(componente.tipo)
    });

    visual.set({
      tipo: 'componente',
      component_id: Number(componente.id),
      local_id: componente.local_id ? Number(componente.local_id) : null,
      nombre: componente.nombre,
      descripcion: componente.descripcion || ''
    } as any);

    this.canvas.add(visual);
    this.canvas.setActiveObject(visual);
    this.seleccionarObjetoCanvas(visual);
    this.guardarObjeto(visual);
  }

  private limitarComponenteAlLocal(objeto: any): void {
    if (!objeto || objeto.get('tipo') !== 'componente') return;

    const local = this.buscarObjetoCanvasPorLocal(Number(objeto.get('local_id')));
    if (!local) return;

    const margin = 4;
    const localLeft = Number(local.left || 0) + margin;
    const localTop = Number(local.top || 0) + margin;
    const localWidth = Number(local.width || 1) * Number(local.scaleX || 1) - margin * 2;
    const localHeight = Number(local.height || 1) * Number(local.scaleY || 1) - margin * 2;

    if (objeto.getScaledWidth() > localWidth) {
      objeto.set('scaleX', localWidth / Math.max(Number(objeto.width || 1), 1));
    }
    if (objeto.getScaledHeight() > localHeight) {
      objeto.set('scaleY', localHeight / Math.max(Number(objeto.height || 1), 1));
    }

    const maxLeft = localLeft + localWidth - objeto.getScaledWidth();
    const maxTop = localTop + localHeight - objeto.getScaledHeight();
    objeto.set({
      left: Math.min(Math.max(Number(objeto.left || 0), localLeft), maxLeft),
      top: Math.min(Math.max(Number(objeto.top || 0), localTop), maxTop)
    });
    objeto.setCoords();
  }

  private ajustarComponentesDelLocal(objeto: any): void {
    if (!objeto || objeto.get('tipo') !== 'local') return;

    this.canvas.getObjects()
      .filter((item: any) => item.get('tipo') === 'componente'
        && Number(item.get('local_id')) === Number(objeto.get('local_id')))
      .forEach((componente: any) => {
        this.limitarComponenteAlLocal(componente);
        this.guardarObjeto(componente);
      });
  }

  guardarObjeto(obj: any): void {
    if (!obj) return;
    if (!this.puedeEditarObjeto(obj)) {
      this.mensaje = 'Puede ver este objeto, pero no editarlo.';
      return;
    }

    const payload = this.payloadObjeto(obj);
    const id = obj.get('id');
    const request = id
      ? this.mapaService.actualizarObjeto(id, payload)
      : this.mapaService.guardarObjeto(payload);

    request.subscribe({
      next: (res: any) => {
        obj.set('id', res.id);
        this.actualizarEtiquetasCanvas();
        this.mensaje = 'Canvas guardado.';
      },
      error: (err) => {
        console.error(err);
        this.mensaje = 'Error guardando el canvas.';
      }
    });
  }

  guardarCanvas(): void {
    const objetos = this.canvas.getObjects().filter((objeto: any) => {
      return this.puedeEditarObjeto(objeto);
    });

    if (!objetos.length) {
      this.mensaje = 'No hay objetos para guardar.';
      return;
    }

    objetos.forEach((objeto) => this.guardarObjeto(objeto));
  }

  reflejarSeleccionado(eje: 'x' | 'y'): void {
    const obj = this.canvas?.getActiveObject() as any;
    if (!obj || obj.get('tipo') !== 'componente') {
      this.mensaje = 'Seleccione un componente para reflejarlo.';
      return;
    }
    if (!this.puedeEditarObjeto(obj)) {
      this.mensaje = 'Puede ver este componente, pero no editarlo.';
      return;
    }

    const propiedad = eje === 'x' ? 'flipX' : 'flipY';
    obj.set(propiedad, !obj.get(propiedad));
    obj.setCoords();
    this.canvas.requestRenderAll();
    this.actualizarEtiquetasCanvas();
    this.guardarObjeto(obj);
  }

  eliminarSeleccionado(): void {
    const obj = this.canvas.getActiveObject() as any;

    if (!obj) {
      this.mensaje = 'Seleccione un objeto del canvas.';
      return;
    }
    if (!this.puedeEditarObjeto(obj)) {
      this.mensaje = 'Puede ver este objeto, pero no eliminarlo.';
      return;
    }

    const id = obj.get('id');
    this.canvas.remove(obj);
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    this.actualizarEtiquetasCanvas();

    if (!id) return;

    this.mapaService.eliminarObjeto(id).subscribe({
      next: () => this.mensaje = 'Objeto eliminado.',
      error: (err) => {
        console.error(err);
        this.mensaje = 'No se pudo eliminar el objeto.';
      }
    });
  }

  cerrarSesion(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigateByUrl('/admin/login'),
      error: () => {
        this.authService.cerrarSesionLocal();
        this.router.navigateByUrl('/admin/login');
      }
    });
  }

  buscarGlobal(): void {
    const texto = this.busqueda.trim();

    if (!texto) {
      this.resultados = null;
      return;
    }

    this.localService.buscarGlobal(texto).subscribe({
      next: (data) => this.resultados = data,
      error: (err) => console.error(err)
    });
  }

  guardarUsuario(): void {
    if (!this.esSuperadmin()) return;
    if (!this.usuarioForm.name.trim() || !this.usuarioForm.email.trim()) {
      this.mensaje = 'Nombre y correo del usuario son obligatorios.';
      return;
    }

    const payload = {
      ...this.usuarioForm,
      local_ids: this.usuarioForm.role === 'admin_local'
        ? this.usuarioForm.local_ids.map((id: any) => Number(id))
        : []
    };

    if (this.usuarioEditandoId && !payload.password) {
      delete payload.password;
    }

    const request = this.usuarioEditandoId
      ? this.localService.actualizarUsuario(this.usuarioEditandoId, payload)
      : this.localService.crearUsuario(payload);

    request.subscribe({
      next: () => {
        this.cargarUsuarios();
        this.resetUsuarioForm();
        this.mensaje = 'Usuario guardado.';
      },
      error: (err) => {
        console.error(err);
        this.mensaje = 'No se pudo guardar el usuario.';
      }
    });
  }

  editarUsuario(usuario: any): void {
    this.usuarioEditandoId = usuario.id;
    this.usuarioForm = {
      name: usuario.name || '',
      email: usuario.email || '',
      password: '',
      role: usuario.role === 'admin' ? 'superadmin' : (usuario.role || 'admin_local'),
      status: Boolean(usuario.status),
      local_ids: (usuario.locales || []).map((local: any) => Number(local.id))
    };
  }

  desactivarUsuario(usuario: any): void {
    this.localService.desactivarUsuario(usuario.id).subscribe({
      next: () => {
        this.cargarUsuarios();
        this.mensaje = 'Usuario desactivado.';
      },
      error: (err) => {
        console.error(err);
        this.mensaje = 'No se pudo desactivar el usuario.';
      }
    });
  }

  eliminarUsuario(usuario: any): void {
    if (!this.esSuperadmin()) return;

    const confirmar = window.confirm(`Eliminar permanentemente al usuario ${usuario.name}?`);
    if (!confirmar) return;

    this.localService.eliminarUsuario(usuario.id).subscribe({
      next: () => {
        this.cargarUsuarios();
        if (Number(this.usuarioEditandoId) === Number(usuario.id)) {
          this.resetUsuarioForm();
        }
        this.mensaje = 'Usuario eliminado.';
      },
      error: (err) => {
        console.error(err);
        this.mensaje = err?.error?.message || 'No se pudo eliminar el usuario.';
      }
    });
  }

  resetUsuarioForm(): void {
    this.usuarioEditandoId = null;
    this.usuarioForm = this.nuevoUsuarioForm();
  }

  guardarComponente(): void {
    if (!this.componenteForm.local_id && !this.esSuperadmin()) {
      this.mensaje = 'Los componentes generales solo pueden ser creados por un superadministrador.';
      return;
    }
    if (this.componenteForm.local_id && !this.puedeEditarLocalId(this.componenteForm.local_id)) {
      this.mensaje = 'Solo puede gestionar componentes de sus locales asignados.';
      return;
    }
    if (!this.componenteForm.nombre.trim()) {
      this.mensaje = 'El nombre del componente es obligatorio.';
      return;
    }

    const request = this.componenteEditandoId
      ? this.localService.actualizarComponente(this.componenteEditandoId, this.componenteForm)
      : this.localService.crearComponente(this.componenteForm);

    request.pipe(
      switchMap((componente: any) => this.componenteImagenFile
        ? this.localService.subirArchivoComponente(componente.id, 'imagen', this.componenteImagenFile)
        : of(componente)
      ),
      switchMap((componente: any) => this.componenteIconoFile
        ? this.localService.subirArchivoComponente(componente.id, 'icono', this.componenteIconoFile)
        : of(componente)
      )
    ).subscribe({
      next: (componente: any) => {
        this.actualizarComponenteEnCanvas(componente);
        this.cargarComponentes();
        this.cargarLocales();
        this.resetComponenteForm();
        this.mensaje = 'Componente guardado.';
      },
      error: (err) => {
        console.error(err);
        this.mensaje = err?.error?.message
          || Object.values(err?.error?.errors || {}).flat().join(' ')
          || 'No se pudo guardar el componente.';
      }
    });
  }

  editarComponente(componente: any): void {
    if (!this.puedeEditarLocalId(componente.local_id)) {
      this.mensaje = 'Solo puede editar componentes de sus locales asignados.';
      return;
    }
    this.componenteEditandoId = componente.id;
    this.componenteForm = {
      ...this.nuevoComponenteForm(),
      local_id: componente.local_id ? Number(componente.local_id) : null,
      tipo: componente.tipo || 'Otros',
      nombre: componente.nombre || '',
      descripcion: componente.descripcion || '',
      costo: componente.costo,
      imagen: componente.imagen || '',
      icono: componente.icono || '',
      activo: Boolean(componente.activo)
    };
    this.componenteImagenPreview = this.logoUrl(componente.imagen);
    this.componenteIconoPreview = this.logoUrl(componente.icono);
    this.componenteImagenFile = null;
    this.componenteIconoFile = null;
  }

  eliminarComponente(componente: any): void {
    const componenteActual = this.componentes.find((item: any) => Number(item.id) === Number(componente.id));
    if (componenteActual && !this.puedeEditarLocalId(componenteActual.local_id)) {
      this.mensaje = 'Solo puede eliminar componentes de sus locales asignados.';
      return;
    }

    this.localService.eliminarComponente(componente.id).subscribe({
      next: () => {
        this.canvas.getObjects()
          .filter((objeto: any) => Number(objeto.get('component_id')) === Number(componente.id))
          .forEach((objeto: any) => this.canvas.remove(objeto));
        this.canvas.discardActiveObject();
        this.actualizarEtiquetasCanvas();
        this.canvas.requestRenderAll();
        this.cargarComponentes();
        this.cargarLocales();
        this.resetComponenteForm();
        this.mensaje = 'Componente eliminado.';
      },
      error: (err) => {
        console.error(err);
        this.mensaje = err?.error?.message || 'No se pudo eliminar el componente.';
      }
    });
  }

  seleccionarArchivoComponente(event: Event, campo: 'imagen' | 'icono'): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      input.value = '';
      this.mensaje = 'El archivo no puede superar 10 MB.';
      return;
    }

    if (campo === 'imagen') {
      this.componenteImagenFile = file;
      this.componenteImagenPreview = URL.createObjectURL(file);
    } else {
      this.componenteIconoFile = file;
      this.componenteIconoPreview = URL.createObjectURL(file);
    }
  }

  eliminarArchivoComponente(campo: 'imagen' | 'icono'): void {
    if (!this.componenteEditandoId) {
      if (campo === 'imagen') {
        this.componenteImagenFile = null;
        this.componenteImagenPreview = '';
        this.componenteForm.imagen = '';
      } else {
        this.componenteIconoFile = null;
        this.componenteIconoPreview = '';
        this.componenteForm.icono = '';
      }
      return;
    }

    this.localService.eliminarArchivoComponente(this.componenteEditandoId, campo).subscribe({
      next: (componente: any) => this.editarComponente(componente),
      error: (err) => console.error(err)
    });
  }

  resetComponenteForm(): void {
    this.componenteEditandoId = null;
    this.componenteForm = this.nuevoComponenteForm();
    this.asignarLocalGestionablePorDefecto();
    this.componenteImagenFile = null;
    this.componenteIconoFile = null;
    this.componenteImagenPreview = '';
    this.componenteIconoPreview = '';
  }

  esSuperadmin(): boolean {
    return ['superadmin', 'admin'].includes(this.usuarioActual?.role);
  }

  localesGestionables(): any[] {
    if (this.esSuperadmin()) return this.locales;
    return this.locales.filter((local: any) => this.puedeEditarLocalId(local.id));
  }

  private asignarLocalGestionablePorDefecto(): void {
    if (this.esSuperadmin() || this.componenteForm.local_id) return;
    const [primerLocal] = this.localesGestionables();
    if (primerLocal) {
      this.componenteForm.local_id = Number(primerLocal.id);
    }
  }

  private puedeEditarLocalId(localId: number | string | null | undefined): boolean {
    if (this.esSuperadmin()) return true;
    const id = Number(localId || 0);
    if (!id) return false;
    return (this.usuarioActual?.locales || [])
      .some((local: any) => Number(local.id) === id);
  }

  private puedeEditarObjeto(objeto: any): boolean {
    return this.puedeEditarLocalId(objeto?.get?.('local_id'));
  }

  agregarProducto(): void {
    this.productos.push(this.nuevoProductoForm());
  }

  quitarProducto(index: number): void {
    this.productos.splice(index, 1);
  }

  agregarServicio(): void {
    this.servicios.push(this.nuevoServicioForm());
  }

  quitarServicio(index: number): void {
    this.servicios.splice(index, 1);
  }

  resetFormularioLocal(): void {
    this.localEditandoId = null;
    this.logoFile = null;
    this.logoPreview = '';
    this.localForm = this.nuevoLocalForm();
    this.sincronizarRedesVisiblesDesdeFormulario();
    this.productos = [this.nuevoProductoForm()];
    this.servicios = [this.nuevoServicioForm()];
  }

  seleccionarLocalEnCanvas(localId: number | string): void {
    const id = Number(localId);
    const objeto = this.buscarObjetoCanvasPorLocal(id);

    if (!objeto) {
      this.actualizarResaltadoCanvas();
      return;
    }

    if (!this.puedeEditarObjeto(objeto)) {
      this.canvas.discardActiveObject();
      this.actualizarResaltadoCanvas();
      this.actualizarEtiquetasCanvas();
      this.canvas.requestRenderAll();
      return;
    }

    this.canvas.setActiveObject(objeto);
    this.seleccionarObjetoCanvas(objeto);
    this.canvas.requestRenderAll();
  }

  seleccionarYEditarLocal(localId: number | string): void {
    const id = Number(localId);
    this.localSeleccionado = id;
    this.seleccionarLocalEnCanvas(id);

    if (id) {
      this.editarLocalSeleccionado();
    }
  }

  private seleccionarObjetoCanvas(objeto: any): void {
    this.objetoSeleccionado = objeto;

    if (objeto?.get('local_id')) {
      this.localSeleccionado = Number(objeto.get('local_id'));
    }

    const componenteId = Number(objeto?.get('component_id') || 0);
    if (componenteId && this.puedeEditarObjeto(objeto)) {
      const componente = this.componentes.find((item) => Number(item.id) === componenteId);
      if (componente) {
        this.panelActivo = 'componentes';
        this.editarComponente(componente);
      }
    }

    this.actualizarResaltadoCanvas();
    this.actualizarEtiquetasCanvas();
  }

  private actualizarLocalEnCanvas(localId: number, nombre: string): void {
    this.canvas.getObjects().forEach((objeto: any) => {
      if (objeto.get('tipo') === 'local' && Number(objeto.get('local_id')) === Number(localId)) {
        objeto.set({
          nombre,
          width: Number(this.localForm.width) || 150,
          height: Number(this.localForm.height) || 100,
          scaleX: 1,
          scaleY: 1,
          fill: this.localForm.color || '#d6d6d6'
        });
        this.guardarObjeto(objeto);
      }
    });
    this.actualizarEtiquetasCanvas();
    this.canvas.renderAll();
  }

  private buscarObjetoCanvasPorLocal(localId: number): any {
    return this.canvas?.getObjects()
      .find((objeto: any) => objeto.get('tipo') === 'local' && Number(objeto.get('local_id')) === Number(localId));
  }

  private async actualizarComponenteEnCanvas(componente: any): Promise<void> {
    if (!this.canvas) return;

    const objetos = this.canvas.getObjects()
      .filter((objeto: any) => Number(objeto.get('component_id')) === Number(componente.id));

    for (const objeto of objetos) {
      const index = this.canvas.getObjects().indexOf(objeto);
      const estabaSeleccionado = this.canvas.getActiveObject() === objeto;
      const width = Math.max(1, Number(objeto.width || 1) * Number(objeto.scaleX || 1));
      const height = Math.max(1, Number(objeto.height || 1) * Number(objeto.scaleY || 1));

      const visual = await this.crearVisualComponente(componente, {
        left: Number(objeto.left || 0),
        top: Number(objeto.top || 0),
        width,
        height,
        fill: this.colorComponente(componente.tipo),
        angle: Number(objeto.angle || 0),
        flipX: Boolean(objeto.flipX),
        flipY: Boolean(objeto.flipY),
        selectable: objeto.selectable,
        evented: objeto.evented
      });

      visual.set({
        id: objeto.get('id'),
        tipo: 'componente',
        local_id: componente.local_id ? Number(componente.local_id) : null,
        component_id: Number(componente.id),
        nombre: componente.nombre,
        descripcion: componente.descripcion || ''
      } as any);

      this.canvas.remove(objeto);
      this.canvas.insertAt(index, visual);
      if (estabaSeleccionado) this.canvas.setActiveObject(visual);
      this.guardarObjeto(visual);
    }

    this.actualizarEtiquetasCanvas();
    this.canvas.requestRenderAll();
  }

  private colorComponente(tipo: string): string {
    const colores: Record<string, string> = {
      Infraestructura: '#f59e0b',
      Mobiliario: '#60a5fa',
      Servicios: '#34d399',
      Otros: '#a78bfa'
    };
    return colores[tipo] || colores['Otros'];
  }

  private actualizarResaltadoCanvas(): void {
    const objetoActivo = this.canvas?.getActiveObject() as any;
    const activeLocalId = Number(objetoActivo?.get('local_id') || this.localSeleccionado || 0);

    this.canvas?.getObjects().forEach((objeto: any) => {
      const localId = Number(objeto.get('local_id') || 0);
      const isLocal = objeto.get('tipo') === 'local';
      const isAssigned = isLocal && !this.esSuperadmin() && this.puedeEditarLocalId(localId);
      const isActive = activeLocalId && localId === activeLocalId;
      objeto.set({
        stroke: isActive ? '#ffca28' : (isAssigned ? '#f8b400' : '#202124'),
        strokeWidth: isActive ? 6 : (isAssigned ? 4 : 1),
        strokeDashArray: isAssigned && !isActive ? [10, 6] : null,
        shadow: isAssigned
          ? {
            color: isActive ? 'rgba(248, 180, 0, 0.55)' : 'rgba(248, 180, 0, 0.38)',
            blur: isActive ? 18 : 12,
            offsetX: 0,
            offsetY: 0
          }
          : null
      });
    });

    this.canvas?.requestRenderAll();
  }

  private actualizarEtiquetasCanvas(): void {
    if (!this.canvas) return;

    const objetoActivo = this.canvas.getActiveObject() as any;

    this.canvasLabels = this.canvas.getObjects().map((objeto: any) => {
      const bounds = objeto.getBoundingRect();
      const width = Math.round(bounds.width || ((objeto.width ?? 0) * (objeto.scaleX ?? 1)));
      const height = Math.round(bounds.height || ((objeto.height ?? 0) * (objeto.scaleY ?? 1)));
      const esLocal = objeto.get('tipo') === 'local';
      const local = this.localDeObjetoCanvas(objeto);
      const nombre = esLocal
        ? (local?.nombre || objeto.get('nombre') || 'Local')
        : (objeto.get('nombre') || objeto.get('tipo') || 'Objeto');
      const numero = esLocal
        ? (local?.numero_local ? `Local ${local.numero_local}` : 'Local')
        : '';
      const scaledWidth = width * this.mapScale;
      const scaledHeight = height * this.mapScale;
      const left = esLocal
        ? (Number(bounds.left ?? objeto.left ?? 0) + width / 2) * this.mapScale
        : Number(bounds.left ?? objeto.left ?? 0) * this.mapScale;
      const top = esLocal
        ? (Number(bounds.top ?? objeto.top ?? 0) + height / 2) * this.mapScale
        : Number(bounds.top ?? objeto.top ?? 0) * this.mapScale;

      return {
        id: objeto.get('id') || `${objeto.get('tipo')}-${objeto.left}-${objeto.top}`,
        localId: Number(objeto.get('local_id') || 0),
        nombre,
        numero,
        descripcion: this.descripcionEtiqueta(objeto),
        tipo: objeto.get('tipo') || '',
        logo: this.logoEtiqueta(objeto),
        imagen: this.imagenEtiqueta(objeto),
        selected: objetoActivo === objeto,
        assigned: esLocal && !this.esSuperadmin() && this.puedeEditarLocalId(objeto.get('local_id')),
        style: {
          left: `${left}px`,
          top: `${top}px`,
          width: `${esLocal ? Math.max(34, Math.min(94, scaledWidth - 6)) : scaledWidth}px`,
          height: `${esLocal ? Math.max(34, Math.min(74, scaledHeight - 6)) : scaledHeight}px`,
        '--label-font-size': `${this.tamanoTextoEtiqueta(width, height, nombre)}px`,
          '--label-lines': `${this.lineasTextoEtiqueta(height)}`,
          '--component-flip-x': objeto.flipX ? '-1' : '1',
          '--component-flip-y': objeto.flipY ? '-1' : '1'
        }
      };
    });
  }

  private redimensionarCanvas(): void {
    if (!this.canvas) return;

    const wrapper = document.querySelector('.canvas-wrapper') as HTMLElement | null;
    const availableWidth = wrapper?.clientWidth ? wrapper.clientWidth - 2 : this.canvasBaseWidth;
    this.mapScale = Math.max(0.25, availableWidth / this.canvasBaseWidth);

    this.canvas.setDimensions({
      width: Math.round(this.canvasBaseWidth * this.mapScale),
      height: Math.round(this.canvasBaseHeight * this.mapScale)
    });
    this.canvas.setZoom(this.mapScale);
    this.actualizarEtiquetasCanvas();
    this.canvas.requestRenderAll();
  }

  private payloadObjeto(obj: any): any {
    const width = Math.max(1, Number(obj.width ?? 0) * Number(obj.scaleX ?? 1));
    const height = Math.max(1, Number(obj.height ?? 0) * Number(obj.scaleY ?? 1));

    return {
      mapa_id: this.mapaId,
      local_id: obj.get('local_id') || null,
      tipo: obj.get('tipo') || 'local',
      nombre: obj.get('nombre') || null,
      x: Math.round(Number(obj.left ?? 0)),
      y: Math.round(Number(obj.top ?? 0)),
      width: Math.round(width),
      height: Math.round(height),
      rotation: Math.round(obj.angle ?? 0),
      color: obj.get('fill') || '#cccccc',
      metadata: {
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1,
        flipX: Boolean(obj.flipX),
        flipY: Boolean(obj.flipY),
        component_id: obj.get('component_id') || null,
        descripcion: obj.get('descripcion') || null
      }
    };
  }

  private async crearVisualDesdeObjeto(objeto: any): Promise<any> {
    const editable = this.puedeEditarLocalId(objeto.local_id);
    const componentId = Number(objeto.metadata?.component_id || 0);
    const componente = componentId
      ? (objeto.local?.componentes || []).find((item: any) => Number(item.id) === componentId)
        || this.componentes.find((item) => Number(item.id) === componentId)
      : null;

    if (componente) {
      const visual = await this.crearVisualComponente(componente, {
        left: Number(objeto.x),
        top: Number(objeto.y),
        width: Number(objeto.width),
        height: Number(objeto.height),
        fill: objeto.color || this.colorComponente(componente.tipo),
        angle: Number(objeto.rotation ?? 0),
        flipX: Boolean(objeto.metadata?.flipX),
        flipY: Boolean(objeto.metadata?.flipY),
        selectable: editable,
        evented: editable
      });
      visual.set({
        id: objeto.id,
        tipo: objeto.tipo,
        local_id: objeto.local_id,
        component_id: componentId,
        nombre: objeto.nombre || componente.nombre,
        descripcion: componente.descripcion || objeto.metadata?.descripcion || ''
      } as any);
      return visual;
    }

    const rect = new Rect({
      left: Number(objeto.x),
      top: Number(objeto.y),
      width: Number(objeto.width),
      height: Number(objeto.height),
      fill: objeto.color || '#d6d6d6',
      stroke: '#202124',
      strokeWidth: 1,
      angle: Number(objeto.rotation ?? 0),
      flipX: Boolean(objeto.metadata?.flipX),
      flipY: Boolean(objeto.metadata?.flipY),
      selectable: editable,
      evented: editable
    });

    rect.set({
      id: objeto.id,
      tipo: objeto.tipo,
      local_id: objeto.local_id,
      component_id: objeto.metadata?.component_id || null,
      nombre: objeto.nombre || objeto.local?.nombre || objeto.tipo,
      descripcion: objeto.metadata?.descripcion || objeto.local?.descripcion || ''
    } as any);

    return rect;
  }

  private async crearVisualComponente(componente: any, options: any): Promise<any> {
    const asset = this.logoUrl(componente.icono || componente.imagen);
    if (asset) {
      try {
        const image = await FabricImage.fromURL(asset);
        const { width, height, ...visualOptions } = options;
        image.set({
          ...visualOptions,
          scaleX: Number(width) / Math.max(image.width || 1, 1),
          scaleY: Number(height) / Math.max(image.height || 1, 1),
          stroke: '#202124',
          strokeWidth: 1
        });
        return image;
      } catch (error) {
        console.warn('No se pudo cargar la imagen del componente.', error);
      }
    }

    return new Rect({
      ...options,
      stroke: '#202124',
      strokeWidth: 1
    });
  }

  private componenteDeObjetoCanvas(objeto: any): any {
    const componenteId = Number(objeto?.get('component_id') || 0);
    if (!componenteId) return null;
    return this.componentes.find((item) => Number(item.id) === componenteId) || null;
  }

  private localDeObjetoCanvas(objeto: any): any {
    const localId = Number(objeto?.get('local_id') || 0);
    if (!localId) return null;
    return this.locales.find((item) => Number(item.id) === localId) || null;
  }

  private descripcionEtiqueta(objeto: any): string {
    if (objeto.get('tipo') === 'componente') {
      return this.componenteDeObjetoCanvas(objeto)?.descripcion || objeto.get('descripcion') || '';
    }

    if (objeto.get('tipo') === 'local') {
      return this.localDeObjetoCanvas(objeto)?.descripcion || objeto.get('descripcion') || '';
    }

    return objeto.get('descripcion') || '';
  }

  private logoEtiqueta(objeto: any): string {
    if (objeto.get('tipo') !== 'local') return '';
    return this.logoUrl(this.localDeObjetoCanvas(objeto)?.logo);
  }

  private imagenEtiqueta(objeto: any): string {
    if (objeto.get('tipo') !== 'componente') return '';
    const componente = this.componenteDeObjetoCanvas(objeto);
    return this.logoUrl(componente?.icono || componente?.imagen);
  }

  private tamanoTextoEtiqueta(width: number, height: number, nombre: string): number {
    const scaledWidth = width * this.mapScale;
    const scaledHeight = height * this.mapScale;
    const base = Math.min(scaledWidth / Math.max(String(nombre).length * 0.55, 7), scaledHeight / 3.2);

    return Math.round(Math.max(7, Math.min(13, base)));
  }

  private lineasTextoEtiqueta(height: number): number {
    const scaledHeight = height * this.mapScale;
    if (scaledHeight < 34) return 1;
    if (scaledHeight < 58) return 2;
    return 3;
  }

  private nuevoLocalForm(): any {
    return {
      numero_local: '',
      nombre: '',
      descripcion: '',
      horario: '',
      logo: '',
      telefono: '',
      correo: '',
      whatsapp: '',
      facebook: '',
      instagram: '',
      tiktok: '',
      youtube: '',
      x: '',
      telegram: '',
      sitio_web: '',
      width: 150,
      height: 100,
      color: '#d6d6d6'
    };
  }

  private nuevoUsuarioForm(): any {
    return {
      name: '',
      email: '',
      password: '',
      role: 'admin_local',
      status: true,
      local_ids: []
    };
  }

  private nuevoComponenteForm(): ComponenteForm {
    return {
      local_id: null,
      tipo: 'Otros',
      nombre: '',
      descripcion: '',
      costo: null,
      imagen: '',
      icono: '',
      activo: true
    };
  }

  private nuevoProductoForm(): ProductoForm {
    return {
      nombre: '',
      descripcion: '',
      precio: null
    };
  }

  private nuevoServicioForm(): ServicioForm {
    return {
      nombre: '',
      descripcion: ''
    };
  }
}
