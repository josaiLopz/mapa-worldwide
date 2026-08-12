import { AfterViewInit, Component, HostListener, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { switchMap } from 'rxjs';

import { LocalService } from '../../../services/local.service';
import { MapaService } from '../../../services/mapa.service';
import { Canvas, Rect, Shadow } from 'fabric';
import { API_ORIGIN } from '../../api.config';

@Component({
  selector: 'app-public-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './public-map.component.html',
  styleUrls: ['./public-map.component.scss']
})
export class PublicMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('zoomLayer') zoomLayerRef!: ElementRef<HTMLDivElement>;

  canvas!: Canvas;

  canvasBaseWidth  = 1800;
  canvasBaseHeight = 1000;
  mapScale         = 1;
  stageWidth       = 1800;
  stageHeight      = 1000;
  mapaId           = 1;
  objetos: any[]   = [];
  componentes: any[] = [];
  busqueda         = '';
  resultados: any  = null;
  tagsPorLocal: Record<number, string[]> = {};
  localActivo: any = null;
  adminSettings: any = { background_color: '#f3f4f6', logo: '' };
  adminLogo = '';
  imagenAmpliada = '';
  imagenAmpliadaAlt = '';

  mostrarBarraBusqueda = false;
  mostrarNavegadorMapa = false;
  zoomActivo = false;
  zoomPorcentaje = 100;
  esVistaCelular = false;

  mostrarOnboarding = false;
  mostrarHorizontalHint = false;
  mostrarPinchHint = false;
  mostrarBusquedaHint = false;
  primerLocalIndex  = -1;

  // ── Guía de funciones nuevas (3D, arrastre, cubos, cómo llegar): totalmente independiente
  // del onboarding original de arriba — no lo toca ni cambia su timing. Se muestra una sola
  // vez por sesión/dispositivo (localStorage propio), como un tour paso a paso: contenido
  // distinto para PC (mouse/clic) y móvil (dedos/toques). ──
  mostrarGuiaNueva = false;
  guiaPasoActual = 0;
  private readonly GUIA_NUEVA_KEY = 'croquis_guia_funciones_nuevas_visto';

  private readonly guiaPasosPc = [
    { titulo: '2D / 3D', texto: 'Con este botón cambias entre la vista plana y la vista en 3D del mapa.' },
    { titulo: 'Mover el mapa', texto: 'Haz clic izquierdo y arrastra en cualquier parte del mapa para moverte.' },
    { titulo: 'Rotar la cámara (solo 3D)', texto: 'Arrastra el ícono de la brújula para rotar. Un clic simple en la brújula restablece el norte.' },
    { titulo: 'Acercar / alejar (solo 3D)', texto: 'Usa la rueda del mouse, o los botones ＋ / － junto a la brújula, para hacer zoom.' },
    { titulo: 'Información de un local', texto: 'Haz clic en cualquier local (o cubo, en 3D) para ver su información completa.' },
    { titulo: 'Cómo llegar', texto: 'Dentro de la información de un local, usa el botón "Cómo llegar" para trazar la ruta desde la entrada hasta ahí.' },
  ];

  private readonly guiaPasosMovil = [
    { titulo: '2D / 3D', texto: 'Toca este botón para cambiar entre la vista plana y la vista en 3D del mapa.' },
    { titulo: 'Mover el mapa', texto: 'Arrastra con un dedo en cualquier parte del mapa para moverte.' },
    { titulo: 'Rotar la cámara (solo 3D)', texto: 'Arrastra el ícono de la brújula para rotar. Un toque simple restablece el norte.' },
    { titulo: 'Acercar / alejar (solo 3D)', texto: 'Pellizca con dos dedos, o usa los botones ＋ / － junto a la brújula, para hacer zoom.' },
    { titulo: 'Información de un local', texto: 'Toca cualquier local (o cubo, en 3D) para ver su información completa.' },
    { titulo: 'Cómo llegar', texto: 'Dentro de la información de un local, usa el botón "Cómo llegar" para trazar la ruta desde la entrada hasta ahí.' },
  ];

  get guiaPasos() {
    return this.esVistaCelular ? this.guiaPasosMovil : this.guiaPasosPc;
  }

  // ── Modo 3D: el canvas de Fabric se queda plano de fondo (se inclina como un todo
  // vía CSS en .tilt-layer); locales y componentes se muestran como cubos DOM aparte. ──
  modo3d = false;
  private readonly ALTURA_CUBO_LOCAL = 46;
  private readonly ALTURA_CUBO_COMPONENTE = 26;

  // ── Cámara 3D: rotación interactiva (orbit) con mouse/touch, estilo Google Maps ──
  rot3dX = 48;
  rot3dY = 0;
  private readonly ROT3D_X_MIN = -180;
  private readonly ROT3D_X_MAX = 180;
  private orbitMoved = false;
  orbiting = false;
  private orbitStartX = 0;
  private orbitStartY = 0;
  private orbitStartRotX = 48;
  private orbitStartRotY = 0;

  // ── "Cómo llegar": ruta animada desde la entrada hasta un local ──
  @ViewChild('rutaPath') rutaPathRef?: ElementRef<SVGPathElement>;
  rutaActiva = false;
  rutaPathD = '';
  walkerVisible = false;
  walkerPos = { x: 0, y: 0 };

  // ── Pinch-to-zoom state (CSS transform compartido) ──
  private zoomScale = 1;          // escala visual aplicada (1 = sin zoom)
  private zoomTranslateX = 0;
  private zoomTranslateY = 0;
  private minZoomFactor = 0.5;    // en 3D sí se puede alejar más allá del 100% inicial
  private maxZoomFactor = 4;      // tope de acercamiento
  private lastPinchDistance = 0;
  private isPinching = false;
  private isPanning = false;
  private isDraggingNavigator = false;
  private lastPanX = 0;
  private lastPanY = 0;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;
  private modalResizeLockTimer: ReturnType<typeof setTimeout> | null = null;
  private bloquearResizePorModal = false;
  private lastViewportWidth = window.innerWidth;

  private apiBase = API_ORIGIN;

  constructor(
    private localService: LocalService,
    private mapaService: MapaService
  ) {}

  ngOnInit(): void {
    this.actualizarVistaCelular();
    this.cargarAdminSettings();
    this.cargarComponentesPublicos();
    this.cargarMapaActivo();
    this.iniciarGuiaNueva();
  }

  /** Guía de funciones nuevas — independiente del onboarding original, no lo modifica.
   *  Se retrasa ~9s para no encimarse visualmente con la secuencia de onboarding original
   *  (que dura ~8.5s la primera vez que alguien entra), y solo se muestra una vez. */
  private iniciarGuiaNueva(): void {
    if (localStorage.getItem(this.GUIA_NUEVA_KEY)) return;
    setTimeout(() => {
      this.guiaPasoActual = 0;
      this.mostrarGuiaNueva = true;
    }, 9500);
  }

  siguientePasoGuia(): void {
    if (this.guiaPasoActual < this.guiaPasos.length - 1) {
      this.guiaPasoActual++;
    } else {
      this.cerrarGuiaNueva();
    }
  }

  anteriorPasoGuia(): void {
    if (this.guiaPasoActual > 0) this.guiaPasoActual--;
  }

  claseVisualGuia(): string {
    const clases = ['modo', 'mover', 'rotar', 'zoom', 'info', 'ruta'];
    return `guia-visual-${clases[this.guiaPasoActual] || 'modo'}`;
  }

  cerrarGuiaNueva(): void {
    this.mostrarGuiaNueva = false;
    localStorage.setItem(this.GUIA_NUEVA_KEY, '1');
  }

  private cargarComponentesPublicos(): void {
    this.localService.getComponentes().subscribe({
      next: (componentes: any) => {
        this.componentes = componentes;
        if (this.canvas && this.objetos.length) this.dibujarCanvas();
      },
      error: (err) => console.error(err)
    });
  }

  private cargarAdminSettings(): void {
    this.localService.getAdminSettings().subscribe({
      next: (settings: any) => {
        this.adminSettings = settings;
        this.adminLogo = this.logoUrl(settings.logo);
        if (this.canvas) {
          this.canvas.backgroundColor = settings.background_color || '#f3f4f6';
          this.canvas.requestRenderAll();
        }
      },
      error: (err) => console.error(err)
    });
  }

  ngAfterViewInit(): void {

    this.canvas = new Canvas('publicMapCanvas', {
      width: this.canvasBaseWidth,
      height: this.canvasBaseHeight,
      backgroundColor: this.adminSettings.background_color || '#f3f4f6',
      selection: false
    });

    this.canvas.on('mouse:down', (event) => {
      const target = event.target as any;
      const local = target?.get('local');

      if (local) {
        this.abrirLocal(local);
      }
    });

    // Hover moderno
    this.canvas.on('mouse:over', (event) => {
      const target = event.target as any;
      if (!target?.get('local')) return;

      target.set({
        stroke: '#8fa3ad',
        strokeWidth: 1.5
      });

      this.canvas.requestRenderAll();
    });

    this.canvas.on('mouse:out', (event) => {
      const target = event.target as any;
      if (!target?.get('local')) return;

      const highlighted =
        target.get('local')?.id &&
        this.esLocalResaltado(Number(target.get('local').id));

      target.set({
        stroke: highlighted ? '#ffbd00' : '#d3d9df',
        strokeWidth: highlighted ? 2.5 : 1
      });

      this.canvas.requestRenderAll();
    });

    setTimeout(() => {
      this.redimensionarCanvas();
      this.attachPinchZoom();
      this.observarTamanoStage();
    });

    if (this.objetos.length) {
      this.dibujarCanvas();
    }
  }

  private resizeObserver?: ResizeObserver;

  /** Mantiene el canvas ajustado al tamaño REAL del contenedor en todo momento,
   *  en vez de medirlo una sola vez con un setTimeout (que podía medir un tamaño
   *  todavía inestable y dejar espacio muerto o contenido cortado). */
  private observarTamanoStage(): void {
    const wrap = document.querySelector('.canvas-stage-wrap') as HTMLElement | null;
    if (!wrap || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => {
      if (this.bloquearResizePorModal || this.localActivo) return;
      if (this.resizeTimer) clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.redimensionarCanvas(), 60);
    });
    this.resizeObserver.observe(wrap);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onResize(): void {
    const viewportWidth = window.innerWidth;
    this.actualizarVistaCelular();
    if (Math.abs(viewportWidth - this.lastViewportWidth) < 40) return;
    this.lastViewportWidth = viewportWidth;

    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.resetZoomInstant();
      this.redimensionarCanvas();
    }, 120);
  }

  // ── Modo 3D ─────────────────────────────────────
  toggleModo3d(): void {
    this.modo3d = !this.modo3d;
    this.resetZoomInstant(); // arranca el nuevo modo sin zoom/desplazamiento residual del anterior
    this.redimensionarCanvas(); // 2D y 3D usan estrategias de encuadre distintas (contain vs cover)
    this.dibujarCanvas(); // vuelve a dibujar sin/con sombra y sin/con rects de local según el modo
  }

  /** Solo locales y componentes se muestran como cubo; escaleras/pasillos/zonas quedan planos (ya los dibuja Fabric). */
  esCubo(objeto: any): boolean {
    return objeto.tipo === 'local' || objeto.tipo === 'componente';
  }

  private alturaCubo(objeto: any): number {
    return objeto.tipo === 'componente' ? this.ALTURA_CUBO_COMPONENTE : this.ALTURA_CUBO_LOCAL;
  }

  private colorCubo(objeto: any): string {
    if (objeto.tipo === 'componente') {
      const componente = this.componenteDeObjeto(objeto);
      return componente?.color || objeto.color || '#b8a7ff';
    }
    return this.colorLocal(objeto.color) || '#ffffff';
  }

  private anguloLegibleTag(grados: number): number {
    let angulo = ((grados + 180) % 360 + 360) % 360 - 180;
    if (angulo > 90) angulo -= 180;
    if (angulo < -90) angulo += 180;
    return angulo;
  }

  /** Posición/tamaño del cubo en pantalla, reutilizando las mismas coordenadas x/y/width/height que estilosObjeto(). */
  estilosCubo(objeto: any): Record<string, string> {
    const x = Number(objeto.x) * this.mapScale;
    const y = Number(objeto.y) * this.mapScale;
    const wPx = Number(objeto.width)  * this.mapScale;
    const hPx = Number(objeto.height) * this.mapScale;

    const footprintW = Math.max(36, Math.min(104, wPx - 4));
    const footprintD = Math.max(30, Math.min(82, hPx - 4));

    return {
      left: `${x + wPx / 2}px`,
      top: `${y + hPx / 2}px`,
      transform: `rotate(${Number(objeto.rotation ?? 0)}deg)`,
      '--cube-w': `${footprintW}px`,
      '--cube-d': `${footprintD}px`,
      '--cube-h': `${this.alturaCubo(objeto)}px`,
      '--cube-color': this.colorCubo(objeto),
      '--component-flip-x': objeto.metadata?.flipX ? '-1' : '1',
      '--component-flip-y': objeto.metadata?.flipY ? '-1' : '1',
    };
  }

  estilosTagCubo3d(objeto: any): Record<string, string> {
    const x = Number(objeto.x) * this.mapScale;
    const y = Number(objeto.y) * this.mapScale;
    const wPx = Number(objeto.width) * this.mapScale;
    const hPx = Number(objeto.height) * this.mapScale;
    const lift = this.alturaCubo(objeto) + 6;
    const sideOffset = Math.round(Math.sin((this.rot3dY * Math.PI) / 180) * 58);

    return {
      left: `${x + wPx / 2}px`,
      top: `${y + hPx / 2}px`,
      transform: `translate(-50%, -50%) translateZ(${lift}px)`,
      transformOrigin: '50% 100%',
      '--flag-yaw': `${this.anguloLegibleTag(-this.rot3dY)}deg`,
      '--flag-pitch': `${this.anguloLegibleTag(-this.rot3dX)}deg`,
      '--flag-side-offset': `${sideOffset}px`,
    };
  }

  /** Un local/componente puede recibir el clic normal, salvo que justo se haya arrastrado para mover/rotar la cámara. */
  onCubeClick(objeto: any): void {
    if (this.orbitMoved) { this.orbitMoved = false; return; }
    this.abrirObjeto(objeto);
  }

  // ── Cámara: arrastrar para mover el mapa (pan) — funciona en 2D y 3D, con mouse y touch.
  // Shift + arrastrar rota/inclina (orbit), solo disponible en 3D. Antes solo existía pan táctil
  // (pinch-zoom), nunca hubo arrastre con mouse; ahora sí. ──
  private dragMode: 'pan' | 'orbit' | null = null;
  private orbitSource: 'map' | 'compass' | null = null;
  private dragStartPanX = 0;
  private dragStartPanY = 0;

  estiloTiltLayer(): Record<string, string> {
    if (!this.modo3d) {
      return { transform: 'none', '--cam-rx': '0deg', '--cam-ry': '0deg' };
    }
    return {
      transform: `rotateX(${this.rot3dX}deg) rotateY(${this.rot3dY}deg)`,
      '--cam-rx': `${this.rot3dX}deg`,
      '--cam-ry': `${this.rot3dY}deg`,
    };
  }

  iniciarOrbita(event: PointerEvent): void {
    // el touch ya tiene su propio manejo de pan/pinch-zoom (attachPinchZoom); esto es solo para mouse
    if (event.pointerType && event.pointerType !== 'mouse') return;

    const quiereRotar = this.modo3d && event.shiftKey;
    this.dragMode = quiereRotar ? 'orbit' : 'pan';
    this.orbitSource = quiereRotar ? 'map' : null;
    this.orbiting = true; // controla el cursor "grabbing" mientras se arrastra, sea pan u orbit
    this.orbitMoved = false;
    this.orbitStartX = event.clientX;
    this.orbitStartY = event.clientY;

    if (quiereRotar) {
      this.orbitStartRotX = this.rot3dX;
      this.orbitStartRotY = this.rot3dY;
    } else {
      this.dragStartPanX = this.zoomTranslateX;
      this.dragStartPanY = this.zoomTranslateY;
    }
  }

  @HostListener('window:pointermove', ['$event'])
  onWindowPointerMove(event: PointerEvent): void {
    if (!this.dragMode) return;
    const dx = event.clientX - this.orbitStartX;
    const dy = event.clientY - this.orbitStartY;
    if (!this.orbitMoved && Math.hypot(dx, dy) < 4) return;
    this.orbitMoved = true;
    event.preventDefault();

    if (this.dragMode === 'orbit') {
      this.rot3dY = this.orbitStartRotY + dx * (this.orbitSource === 'compass' ? 0.6 : 0.35);
      const inclinacionFactor = this.orbitSource === 'compass' ? 0.35 : 0.25;
      this.rot3dX = Math.max(this.ROT3D_X_MIN, Math.min(this.ROT3D_X_MAX, this.orbitStartRotX - dy * inclinacionFactor));
    } else {
      this.zoomTranslateX = this.dragStartPanX + dx;
      this.zoomTranslateY = this.dragStartPanY + dy;
      this.clampTranslate();
      this.applyZoomTransform();
    }
  }

  @HostListener('window:pointerup')
  onWindowPointerUp(): void {
    this.dragMode = null;
    this.orbitSource = null;
    this.orbiting = false;
  }

  restablecerCompas(): void {
    if (this.orbitMoved) {
      this.orbitMoved = false;
      return;
    }
    this.rot3dY = 0;
  }

  /** Arrastra la brújula para rotar (como Google Maps) — no necesita tecla modificadora.
   *  Un clic simple (sin arrastrar) sigue restableciendo el norte vía restablecerCompas(). */
  iniciarRotacionCompas(event: PointerEvent): void {
    event.stopPropagation(); // que no también empiece a mover el mapa debajo
    event.preventDefault();
    this.dragMode = 'orbit';
    this.orbitSource = 'compass';
    this.orbiting = true;
    this.orbitMoved = false;
    this.orbitStartX = event.clientX;
    this.orbitStartY = event.clientY;
    this.orbitStartRotX = this.rot3dX;
    this.orbitStartRotY = this.rot3dY;
  }

  restablecerVista3d(): void {
    this.rot3dY = 0;
    this.rot3dX = 48;
    this.resetZoomAnimado();
  }

  /** Zoom con la rueda del mouse — SOLO en 3D. En 2D todo cabe siempre (contain-fit),
   *  así que no hace falta zoom ahí y se deja la rueda libre para scroll normal si algo lo necesita. */
  onWheelZoom(event: WheelEvent): void {
    if (!this.modo3d) return;
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    const next = Math.max(this.minZoomFactor, Math.min(this.maxZoomFactor, this.zoomScale * factor));
    this.setZoomManual(next);
  }

  // ── "Cómo llegar": traza una ruta animada desde la entrada hasta un local ──
  //
  // NOTA: asumo que la "entrada" es el primer objeto con tipo 'local' marcado con
  // `es_entrada` si existe ese campo, o si no, el primer local del mapa. Si tu backend
  // tiene otra forma de marcar cuál local es la entrada, dime cuál campo usar y lo ajusto.
  // NOTA: la entrada real está un poco atrás y a la izquierda del objeto "Worldwide Games"
  // (-50px en x, +20px en y respecto a su centro), según lo describiste.
  private obtenerEntrada(): any {
    return this.objetos.find(o => (o.nombre || o.local?.nombre || '').toLowerCase().includes('worldwide'))
      || this.objetos.find(o => o.es_entrada === true || o.local?.es_entrada === true)
      || this.objetos.find(o => o.tipo === 'local')
      || null;
  }

  private centroObjeto(objeto: any): { x: number, y: number } {
    return {
      x: Number(objeto.x) * this.mapScale + (Number(objeto.width) * this.mapScale) / 2,
      y: Number(objeto.y) * this.mapScale + (Number(objeto.height) * this.mapScale) / 2,
    };
  }

  /** Punto real de la entrada: el objeto "Worldwide Games" desplazado a donde marcaste. */
  private puntoEntrada(): { x: number, y: number } | null {
    const base = this.obtenerEntrada();
    if (!base) return null;
    const c = this.centroObjeto(base);
    return { x: c.x - 50, y: c.y + 90 };
  }

  /** Estilo para la etiqueta visible "Entrada" que se muestra siempre en el mapa (2D y 3D). */
  estilosEntrada(): Record<string, string> {
    const p = this.puntoEntrada();
    if (!p) return { display: 'none' };
    return {
      left: `${p.x}px`,
      top: `${p.y}px`,
    };
  }

  /** Botón "Cómo llegar aquí" dentro del modal del local. */
  comoLlegar(): void {
    if (!this.localActivo) return;
    const objetoDestino = this.objetos.find(o => o.tipo === 'local' && o.local?.id === this.localActivo.id);
    if (!objetoDestino) return;
    this.cerrarModal();
    if (!this.modo3d) this.modo3d = true;
    this.iniciarRuta(objetoDestino);
  }

  iniciarRuta(destino: any): void {
    const a = this.puntoEntrada();
    if (!a) return;

    const b = this.centroObjeto(destino);
    const midX = (a.x + b.x) / 2;

    this.rutaPathD = `M ${a.x} ${a.y} Q ${midX} ${a.y}, ${midX} ${(a.y + b.y) / 2} T ${b.x} ${b.y}`;
    this.rutaActiva = true;

    setTimeout(() => this.animarCaminante(), 0);
  }

  cancelarRuta(): void {
    this.rutaActiva = false;
    this.rutaPathD = '';
    this.walkerVisible = false;
  }

  private animarCaminante(): void {
    const pathEl = this.rutaPathRef?.nativeElement;
    if (!pathEl) return;

    const len = pathEl.getTotalLength();
    const dur = 1800;
    const t0 = performance.now();
    this.walkerVisible = true;

    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const pt = pathEl.getPointAtLength(len * p);
      this.walkerPos = { x: pt.x, y: pt.y };
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        this.walkerVisible = false;
      }
    };
    requestAnimationFrame(step);
  }

  // ── Pinch-to-zoom (CSS transform compartido canvas + labels) ──
  private attachPinchZoom(): void {
    const wrapperEl = this.zoomLayerRef?.nativeElement?.closest('.canvas-stage-wrap') as HTMLElement | null;
    if (!wrapperEl) return;

    wrapperEl.style.touchAction = 'none';

    wrapperEl.addEventListener('touchstart', this.onTouchStart, { passive: false });
    wrapperEl.addEventListener('touchmove', this.onTouchMove, { passive: false });
    wrapperEl.addEventListener('touchend', this.onTouchEnd, { passive: false });
    wrapperEl.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
  }

  private getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  private getTouchMidpoint(touches: TouchList): { x: number, y: number } {
    const rect = (this.zoomLayerRef.nativeElement.closest('.canvas-stage-wrap') as HTMLElement)
      .getBoundingClientRect();
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
    };
  }

  private onTouchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.isPinching = true;
      this.lastPinchDistance = this.getTouchDistance(e.touches);
      this.isPanning = false;
    } else if (e.touches.length === 1) {
      this.isPanning = true;
      this.lastPanX = e.touches[0].clientX;
      this.lastPanY = e.touches[0].clientY;
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (e.touches.length === 2 && this.isPinching) {
      e.preventDefault();

      const newDistance = this.getTouchDistance(e.touches);
      const midpoint = this.getTouchMidpoint(e.touches);

      if (this.lastPinchDistance > 0) {
        const distanceRatio = newDistance / this.lastPinchDistance;

        let nextScale = this.zoomScale * distanceRatio;
        nextScale = Math.min(this.maxZoomFactor, Math.max(this.minZoomFactor, nextScale));

        // Para que el punto bajo los dedos permanezca fijo en pantalla
        const scaleDelta = nextScale / this.zoomScale;

        this.zoomTranslateX = midpoint.x - (midpoint.x - this.zoomTranslateX) * scaleDelta;
        this.zoomTranslateY = midpoint.y - (midpoint.y - this.zoomTranslateY) * scaleDelta;

        this.zoomScale = nextScale;

        this.clampTranslate();
        this.applyZoomTransform();
      }

      this.lastPinchDistance = newDistance;
    } else if (e.touches.length === 1 && this.isPanning && (this.zoomScale > 1 || this.modo3d)) {
      e.preventDefault();
      const touch = e.touches[0];
      this.zoomTranslateX += touch.clientX - this.lastPanX;
      this.zoomTranslateY += touch.clientY - this.lastPanY;
      this.lastPanX = touch.clientX;
      this.lastPanY = touch.clientY;
      this.clampTranslate();
      this.applyZoomTransform();
    } else if (e.touches.length === 1 && this.isPanning) {
      const viewport = this.zoomLayerRef?.nativeElement?.closest('.canvas-stage-wrap') as HTMLElement | null;
      if (!viewport) return;
      e.preventDefault();
      const touch = e.touches[0];
      viewport.scrollLeft -= touch.clientX - this.lastPanX;
      viewport.scrollTop -= touch.clientY - this.lastPanY;
      this.lastPanX = touch.clientX;
      this.lastPanY = touch.clientY;
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) {
      this.isPinching = false;
      this.lastPinchDistance = 0;
    }
    if (e.touches.length === 0) this.isPanning = false;
  };

  /** Evita que el contenido se desplace fuera del area visible */
  private clampTranslate(): void {
    if (this.modo3d) return; // en 3D el arrastre es libre — ver nota abajo

    const el = this.zoomLayerRef?.nativeElement;
    const viewport = el?.closest('.canvas-stage-wrap') as HTMLElement | null;
    if (!viewport) return;

    const viewportW = viewport.clientWidth;
    const viewportH = viewport.clientHeight;
    const scaledW = this.stageWidth * this.zoomScale;
    const scaledH = this.stageHeight * this.zoomScale;

    // Modelo centrado (solo 2D): el mapa arranca centrado y se puede arrastrar en cualquier
    // dirección hasta que su borde llegue al borde de la pantalla. En 3D este cálculo no
    // sirve porque el plano está inclinado (rotateX + perspective): lo que se ve en pantalla
    // es mucho más chico que stageWidth/stageHeight reales, y cualquier límite basado en esos
    // valores atrapa el arrastre antes de llegar a las orillas visibles de verdad. Por eso en
    // 3D no se limita nada (return arriba) y el arrastre queda completamente libre.
    const maxX = Math.max(0, (scaledW - viewportW) / 2);
    const maxY = Math.max(0, (scaledH - viewportH) / 2);

    this.zoomTranslateX = Math.min(maxX, Math.max(-maxX, this.zoomTranslateX));
    this.zoomTranslateY = Math.min(maxY, Math.max(-maxY, this.zoomTranslateY));
  }

  private applyZoomTransform(): void {
    const el = this.zoomLayerRef?.nativeElement;
    if (!el) return;

    this.zoomActivo = this.zoomScale >= 1.65;
    this.zoomPorcentaje = Math.round(this.zoomScale * 100);
    el.style.setProperty('--zoom-scale', String(this.zoomScale));
    el.style.transform = this.modo3d
      ? `translate3d(${this.zoomTranslateX}px, ${this.zoomTranslateY}px, 0) scale3d(${this.zoomScale}, ${this.zoomScale}, ${this.zoomScale})`
      : `translate3d(${this.zoomTranslateX}px, ${this.zoomTranslateY}px, 0) scale(${this.zoomScale})`;
    this.ajustarResolucionCanvas();
  }

  private canvasRenderScale = 1;
  private renderScaleFrame: number | null = null;

  /** Re-renderiza el canvas de Fabric a mayor resolución interna conforme haces zoom con CSS,
   *  para que no se vea pixeleado (el tamaño EN PANTALLA no cambia, solo la nitidez interna). */
  private ajustarResolucionCanvas(): void {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const target = Math.min(4, this.mapScale * this.zoomScale * dpr);
    if (Math.abs(target - this.canvasRenderScale) / this.canvasRenderScale < 0.08) return;

    if (this.renderScaleFrame) cancelAnimationFrame(this.renderScaleFrame);
    this.renderScaleFrame = requestAnimationFrame(() => {
      this.canvas.setDimensions(
        { width: Math.round(this.canvasBaseWidth * target), height: Math.round(this.canvasBaseHeight * target) },
        { backstoreOnly: true } as any
      );
      this.canvas.setZoom(target);
      this.canvas.requestRenderAll();
      this.canvasRenderScale = target;
      this.renderScaleFrame = null;
    });
  }

  private setZoomManual(nextScale: number): void {
    const viewport = this.zoomLayerRef?.nativeElement?.closest('.canvas-stage-wrap') as HTMLElement | null;
    if (!viewport) return;

    const centerX = viewport.clientWidth / 2;
    const centerY = viewport.clientHeight / 2;
    const scaleDelta = nextScale / this.zoomScale;

    this.zoomTranslateX = centerX - (centerX - this.zoomTranslateX) * scaleDelta;
    this.zoomTranslateY = centerY - (centerY - this.zoomTranslateY) * scaleDelta;
    this.zoomScale = nextScale;

    this.clampTranslate();
    this.applyZoomTransform();
  }

  private moverMapaDesdeNavegador(event: PointerEvent): void {
    const navigatorMap = (event.currentTarget as HTMLElement).closest('.navigator-map') as HTMLElement | null;
    const viewport = this.zoomLayerRef?.nativeElement?.closest('.canvas-stage-wrap') as HTMLElement | null;
    if (!navigatorMap || !viewport) return;

    const rect = navigatorMap.getBoundingClientRect();
    const percentX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const percentY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const contentX = this.stageWidth * percentX;
    const contentY = this.stageHeight * percentY;

    this.zoomTranslateX = viewport.clientWidth / 2 - contentX * this.zoomScale;
    this.zoomTranslateY = viewport.clientHeight / 2 - contentY * this.zoomScale;

    this.clampTranslate();
    this.applyZoomTransform();
  }

  /** Resetea sin animación (uso interno, p.ej. en resize) */
  private resetZoomInstant(): void {
    this.zoomScale = 1;
    this.zoomTranslateX = 0;
    this.zoomTranslateY = 0;
    this.applyZoomTransform();
  }

  /** Regresa animado al estado original (sin zoom) */
  private resetZoomAnimado(): void {
    const startScale = this.zoomScale;
    const startX = this.zoomTranslateX;
    const startY = this.zoomTranslateY;

    const duration = 220;
    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      this.zoomScale = startScale + (1 - startScale) * eased;
      this.zoomTranslateX = startX + (0 - startX) * eased;
      this.zoomTranslateY = startY + (0 - startY) * eased;

      this.applyZoomTransform();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.resetZoomInstant();
      }
    };

    requestAnimationFrame(step);
  }

  // ── Carga ───────────────────────────────────────
  cargarMapaActivo(): void {
    this.mapaService.getMapas().pipe(
      switchMap((mapas: any) => {
        this.mapaId = mapas?.[0]?.id ?? 1;
        return this.mapaService.getObjetos(this.mapaId, true);
      })
    ).subscribe({
      next: (objetos: any) => {
        this.objetos = objetos;
        this.redimensionarCanvas();
        this.dibujarCanvas();
        this.iniciarOnboarding();
      },
      error: (err) => console.error(err)
    });
  }

  // ── Onboarding ──────────────────────────────────
  private iniciarOnboarding(): void {
    if (localStorage.getItem('croquis_onboarding_visto')) {
      this.mostrarOnboarding = false;
      this.mostrarHorizontalHint = false;
      this.mostrarPinchHint = false;
      this.mostrarBusquedaHint = false;
      return;
    }

    this.primerLocalIndex = this.objetos.findIndex(o => o.tipo === 'local');

    // Paso 1: rotar dispositivo
    this.mostrarHorizontalHint = true;

    setTimeout(() => {
      this.mostrarHorizontalHint = false;

      // Paso 2: pinch to zoom
      this.mostrarPinchHint = true;

      setTimeout(() => {
        this.mostrarPinchHint = false;

        // Paso 3: tocar un local (solo si existe alguno)
        if (this.primerLocalIndex >= 0) {
          this.mostrarOnboarding = true;

          setTimeout(() => {
            this.mostrarOnboarding = false;
            this.finalizarOnboarding();
          }, 3000);
        } else {
          this.finalizarOnboarding();
        }

      }, 2500); // duración del hint de pinch

    }, 3000); // duración del hint horizontal
  }

  private finalizarOnboarding(): void {
    this.mostrarOnboarding = false;
    this.mostrarHorizontalHint = false;
    this.mostrarPinchHint = false;
    this.mostrarBusquedaHint = false;
    localStorage.setItem('croquis_onboarding_visto', '1');
  }

  private ocultarOnboarding(): void {
    this.finalizarOnboarding();
  }

  toggleBarraBusqueda(): void {
    this.mostrarBarraBusqueda = !this.mostrarBarraBusqueda;
  }

  private actualizarVistaCelular(): void {
    const userAgentMovil = /Android|iPhone|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);
    this.esVistaCelular = userAgentMovil || window.innerWidth <= 480 || window.innerHeight <= 480;
  }

  toggleNavegadorMapa(): void {
    this.mostrarNavegadorMapa = !this.mostrarNavegadorMapa;
  }

  acercarMapa(): void {
    this.setZoomManual(Math.min(this.maxZoomFactor, this.zoomScale + 0.5));
  }

  alejarMapa(): void {
    this.setZoomManual(Math.max(this.minZoomFactor, this.zoomScale - 0.5));
  }

  restablecerZoomMapa(): void {
    this.resetZoomAnimado();
  }

  navegadorVentanaEstilo(): Record<string, string> {
    const viewport = this.zoomLayerRef?.nativeElement?.closest('.canvas-stage-wrap') as HTMLElement | null;
    if (!viewport) {
      return { left: '0%', top: '0%', width: '100%', height: '100%' };
    }

    const visibleWidth = Math.min(100, (viewport.clientWidth / (this.stageWidth * this.zoomScale)) * 100);
    const visibleHeight = Math.min(100, (viewport.clientHeight / (this.stageHeight * this.zoomScale)) * 100);
    const left = Math.min(100 - visibleWidth, Math.max(0, (-this.zoomTranslateX / (this.stageWidth * this.zoomScale)) * 100));
    const top = Math.min(100 - visibleHeight, Math.max(0, (-this.zoomTranslateY / (this.stageHeight * this.zoomScale)) * 100));

    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${visibleWidth}%`,
      height: `${visibleHeight}%`
    };
  }

  iniciarArrastreNavegador(event: PointerEvent): void {
    event.preventDefault();
    this.isDraggingNavigator = true;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.moverMapaDesdeNavegador(event);
  }

  arrastrarNavegador(event: PointerEvent): void {
    if (!this.isDraggingNavigator) return;
    event.preventDefault();
    this.moverMapaDesdeNavegador(event);
  }

  terminarArrastreNavegador(event: PointerEvent): void {
    this.isDraggingNavigator = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  // ── Búsqueda ────────────────────────────────────
  buscar(): void {
    if (this.mostrarBusquedaHint || this.mostrarHorizontalHint || this.mostrarPinchHint || this.mostrarOnboarding) {
      this.ocultarOnboarding();
    }

    const texto = this.busqueda.trim();
    if (!texto) {
      this.resultados   = null;
      this.tagsPorLocal = {};
      this.dibujarCanvas();
      return;
    }
    this.localService.buscarGlobal(texto).subscribe({
      next: (data: any) => {
        this.resultados   = data;
        this.tagsPorLocal = this.obtenerTags(data);
        this.dibujarCanvas();
      },
      error: (err) => console.error(err)
    });
  }

  limpiarBusqueda(): void {
    this.busqueda     = '';
    this.resultados   = null;
    this.tagsPorLocal = {};
    this.dibujarCanvas();
  }

  // ── Modal ───────────────────────────────────────
  abrirLocal(local: any): void {
    if (this.mostrarOnboarding || this.mostrarPinchHint || this.mostrarHorizontalHint) {
      this.ocultarOnboarding();
    }
    this.bloquearResizeTemporalmente();
    this.localActivo = local;
  }

  cerrarModal(): void {
    this.localActivo = null;
    this.bloquearResizeTemporalmente();
  }

  private bloquearResizeTemporalmente(): void {
    this.bloquearResizePorModal = true;
    if (this.modalResizeLockTimer) clearTimeout(this.modalResizeLockTimer);
    this.modalResizeLockTimer = setTimeout(() => {
      this.bloquearResizePorModal = false;
    }, 360);
  }

  abrirObjeto(objeto: any): void {
    const componente = this.componenteDeObjeto(objeto);
    const imagen = componente?.imagen || componente?.icono;

    if (objeto?.tipo === 'componente' && imagen) {
      this.ampliarImagen(imagen, componente?.nombre || objeto?.nombre || 'Componente');
      return;
    }

    if (objeto?.local) this.abrirLocal(objeto.local);
  }

  ampliarImagen(imagen: string, alt = 'Imagen del componente'): void {
    this.imagenAmpliada = this.logoUrl(imagen);
    this.imagenAmpliadaAlt = alt;
  }

  cerrarImagenAmpliada(): void {
    this.imagenAmpliada = '';
    this.imagenAmpliadaAlt = '';
  }

  // ── Helpers ─────────────────────────────────────
  normalizarUrl(url: string | null | undefined): string {
    if (!url) return '';
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  limpiarTelefono(telefono: string | null | undefined): string {
    return (telefono || '').replace(/\D/g, '');
  }

  logoUrl(logo: string | null | undefined): string {
    if (!logo) return '';
    return logo.startsWith('http') ? logo : `${this.apiBase}${logo}`;
  }

  etiquetaLocal(local: any): string {
    const numero = local?.numero_local ? `Local ${local.numero_local}` : '';
    const nombre = local?.nombre || '';

    if (numero && nombre) return `${numero} - ${nombre}`;
    return numero || nombre || 'Local';
  }

  nombreLocal(local: any, fallback = 'Local'): string {
    return local?.nombre || fallback || 'Local';
  }

  numeroLocal(local: any): string {
    return local?.numero_local ? `Local ${local.numero_local}` : 'Local';
  }

  etiquetaTipo(tipo: string): string {
    const tipos: Record<string, string> = {
      local:              'Local',
      escalera:           'Escalera',
      escalera_electrica: 'Escalera eléctrica',
      pasillo:            'Pasillo',
      mesas:              'Zona de mesas',
      maquinitas:         'Maquinitas'
    };
    return tipos[tipo] ?? tipo;
  }

  componenteDeObjeto(objeto: any): any {
    const componenteId = Number(objeto?.metadata?.component_id || 0);
    if (!componenteId) return null;

    return (objeto.local?.componentes || [])
      .find((componente: any) => Number(componente.id) === componenteId)
      || this.componentes.find((componente: any) => Number(componente.id) === componenteId)
      || null;
  }

  esLocalResaltado(localId: number): boolean {
    return Boolean(this.tagsPorLocal[localId]?.length);
  }

  tagsLocal(localId: number): string[] {
    return this.tagsPorLocal[localId] ?? [];
  }

  tieneResultados(): boolean {
    if (!this.resultados) return false;
    return Boolean(
      this.resultados.locales?.length      ||
      this.resultados.productos?.length    ||
      this.resultados.servicios?.length    ||
      this.resultados.mapa_objetos?.length
    );
  }

  // ── Estilos de posicionamiento ──────────────────
  estilosObjeto(objeto: any): Record<string, string> {
    let x = Number(objeto.x);
    let y = Number(objeto.y);
    let w = Number(objeto.width);
    let h = Number(objeto.height);
    const nombre = objeto.tipo === 'local'
      ? this.nombreLocal(objeto.local, objeto.nombre)
      : (this.componenteDeObjeto(objeto)?.nombre || objeto.nombre || this.etiquetaTipo(objeto.tipo));

    if (objeto.tipo === 'componente' && objeto.local_id) {
      const local = this.objetos.find((item: any) => item.tipo === 'local'
        && Number(item.local_id) === Number(objeto.local_id));

      if (local) {
        const margin = 4;
        const localX = Number(local.x) + margin;
        const localY = Number(local.y) + margin;
        const localWidth = Math.max(1, Number(local.width) - margin * 2);
        const localHeight = Math.max(1, Number(local.height) - margin * 2);
        w = Math.min(w, localWidth);
        h = Math.min(h, localHeight);
        x = Math.min(Math.max(x, localX), localX + localWidth - w);
        y = Math.min(Math.max(y, localY), localY + localHeight - h);
      }
    }

    const esLocal = objeto.tipo === 'local';
    const scaledWidth = w * this.mapScale;
    const scaledHeight = h * this.mapScale;

    return {
      left: `${x * this.mapScale}px`,
      top: `${y * this.mapScale}px`,
      width: `${esLocal ? Math.max(40, Math.min(104, scaledWidth - 4)) : scaledWidth}px`,
      height: `${esLocal ? Math.max(40, Math.min(84, scaledHeight - 4)) : scaledHeight}px`,
      transform: esLocal
        ? `translate(-50%, -50%) rotate(${Number(objeto.rotation ?? 0)}deg)`
        : `rotate(${Number(objeto.rotation ?? 0)}deg)`,
      transformOrigin: esLocal ? 'center center' : 'top left',
      '--label-font-size': `${this.tamanoTextoEtiqueta(w, h, nombre)}px`,
      '--label-lines': `${this.lineasTextoEtiqueta(h)}`,
      '--component-flip-x': objeto.metadata?.flipX ? '-1' : '1',
      '--component-flip-y': objeto.metadata?.flipY ? '-1' : '1'
    };
  }

  estilosTagEtiqueta(objeto: any): Record<string, string> {
    const x = Number(objeto.x) * this.mapScale;
    const y = Number(objeto.y) * this.mapScale;
    const w = Number(objeto.width) * this.mapScale;

    const tagHeight = 46;
    const hiloHeight = 10;

    const centerX = x + w / 2;
    const groupTop = y - hiloHeight - tagHeight;

    return {
      left: `${centerX}px`,
      top: `${groupTop}px`,
      transform: 'translateX(-50%)',
      '--object-rotation': `${Number(objeto.rotation ?? 0)}deg`,
      '--label-font-size': `${this.tamanoTextoEtiqueta(Number(objeto.width), Number(objeto.height), this.nombreLocal(objeto.local, objeto.nombre))}px`,
      '--label-lines': `${this.lineasTextoEtiqueta(Number(objeto.height))}`
    };
  }

  private tamanoTextoEtiqueta(width: number, height: number, texto: string): number {
    const scaledWidth = width * this.mapScale;
    const scaledHeight = height * this.mapScale;
    const base = Math.min(
      scaledWidth / Math.max(String(texto || '').length * 0.55, 7),
      scaledHeight / 5
    );

    return Math.round(Math.max(8, Math.min(14, base)));
  }

  private lineasTextoEtiqueta(height: number): number {
    const scaledHeight = height * this.mapScale;
    if (scaledHeight < 38) return 1;
    if (scaledHeight < 66) return 2;
    return 3;
  }

  colorPorTipo(tipo: string): string {
    const colores: Record<string, string> = {
      local:              '#ffffff',
      escalera:           '#747b84',
      escalera_electrica: '#f2a900',
      pasillo:            '#edf1f5',
      mesas:              '#7db7f2',
      maquinitas:         '#b8a7ff'
    };
    return colores[tipo] ?? '#ffffff';
  }

  private colorLocal(color: string | null | undefined): string {
    const normalizado = String(color || '').trim().toLowerCase();
    const coloresDefault = new Set(['', '#fff', '#ffffff', '#d6d6d6', '#d9dde2', '#cccccc']);
    return coloresDefault.has(normalizado) ? this.colorPorTipo('local') : String(color);
  }

  // ── Canvas ──────────────────────────────────────
  private dibujarCanvas(): void {
    if (!this.canvas) return;

    this.canvas.clear();
    this.canvas.backgroundColor = this.adminSettings.background_color || '#f3f4f6';

    this.objetos.forEach((objeto) => {

      // En 3D, los locales y componentes ya se muestran como cubo — ocultar su rectángulo
      // plano 2D para no duplicar/ensuciar visualmente. Escaleras, pasillos y zonas (que no
      // tienen cubo) se siguen dibujando normal, para que el fondo blanco/zonas se vea completo.
      if (this.modo3d && this.esCubo(objeto)) return;

      const esLocal = objeto.tipo === 'local';

      const isHighlighted =
        objeto.local_id &&
        this.esLocalResaltado(Number(objeto.local_id));

      const width = Number(objeto.width);
      const height = Number(objeto.height);
      const componente = objeto.tipo === 'componente' ? this.componenteDeObjeto(objeto) : null;
      const componenteConImagen = Boolean(componente?.icono || componente?.imagen);

      const rect = new Rect({
        left: Number(objeto.x),
        top: Number(objeto.y),

        width,
        height,

        fill: componenteConImagen
          ? 'rgba(255,255,255,0)'
          : esLocal
          ? this.colorLocal(objeto.color)
          : (objeto.tipo === 'componente' ? (objeto.color || '#d6d6d6') : this.colorPorTipo(objeto.tipo)),

        rx: esLocal ? 16 : 4,
        ry: esLocal ? 16 : 4,

        stroke: componenteConImagen ? 'rgba(0,0,0,0)' : (isHighlighted ? '#ffbd00' : (esLocal ? '#d3d9df' : '#9aa3ad')),
        strokeWidth: componenteConImagen ? 0 : (isHighlighted ? 2.5 : 1),

        angle: Number(objeto.rotation ?? 0),

        selectable: false,

        hoverCursor: objeto.local ? 'pointer' : 'default',

        shadow: (esLocal && !this.modo3d)
          ? new Shadow({
              color: 'rgba(31,41,55,.08)',
              blur: 9,
              offsetX: 0,
              offsetY: 3
            })
          : undefined
      });

      rect.set({
        local: objeto.local || null,
        tipo: objeto.tipo
      } as any);

      this.canvas.add(rect);
    });

    this.canvas.renderAll();
  }

  private dimensionesContenido2d(): { width: number; height: number } {
    if (!this.objetos.length) {
      return { width: this.canvasBaseWidth, height: this.canvasBaseHeight };
    }

    const margen = 36;
    const maxX = Math.max(...this.objetos.map((objeto) =>
      Number(objeto.x || 0) + Number(objeto.width || 0)
    ));
    const maxY = Math.max(...this.objetos.map((objeto) =>
      Number(objeto.y || 0) + Number(objeto.height || 0)
    ));

    return {
      width: Math.min(this.canvasBaseWidth, Math.max(1, maxX + margen)),
      height: Math.min(this.canvasBaseHeight, Math.max(1, maxY + margen))
    };
  }

  private redimensionarCanvas(): void {
    if (!this.canvas) return;

    const wrap = document.querySelector('.canvas-stage-wrap') as HTMLElement | null;
    if (!wrap) return;

    const wrapStyles = getComputedStyle(wrap);
    const paddingX = parseFloat(wrapStyles.paddingLeft) + parseFloat(wrapStyles.paddingRight);
    const paddingY = parseFloat(wrapStyles.paddingTop) + parseFloat(wrapStyles.paddingBottom);
    const availableWidth  = Math.max(1, wrap.clientWidth - paddingX);
    const availableHeight = Math.max(1, wrap.clientHeight - paddingY);

    const scaleW = availableWidth  / this.canvasBaseWidth;
    const scaleH = availableHeight / this.canvasBaseHeight;
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    const desktopWidthBoost = !isTouchDevice && availableWidth >= 1400 ? 1.10 : 1;
    // 2D: "contain" — siempre cabe completo, nunca se corta nada (no hay zoom/arrastre en 2D
    // para alcanzar lo que sobrara). 3D: "cover" — llena la pantalla sin espacio muerto a los
    // lados; ahí sí existen arrastre/rotación/zoom para alcanzar cualquier borde.
    const targetScale = this.modo3d
      ? Math.max(scaleW, scaleH * desktopWidthBoost)
      : (isTouchDevice ? Math.min(scaleW, scaleH) : Math.min(scaleW, scaleH * desktopWidthBoost));
    const minScale = isTouchDevice && !this.modo3d ? 0.12 : 0.25;
    this.mapScale    = Math.max(minScale, targetScale);
    this.stageWidth  = Math.round(this.canvasBaseWidth  * this.mapScale);
    this.stageHeight = Math.round(this.canvasBaseHeight * this.mapScale);

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const renderScale = this.mapScale * dpr;

    this.canvas.setDimensions({ width: this.stageWidth, height: this.stageHeight }, { cssOnly: true } as any);
    this.canvas.setDimensions(
      { width: Math.round(this.canvasBaseWidth * renderScale), height: Math.round(this.canvasBaseHeight * renderScale) },
      { backstoreOnly: true } as any
    );
    this.canvas.setZoom(renderScale);
    this.canvas.requestRenderAll();
    this.canvasRenderScale = renderScale;
  }

  private obtenerTags(data: any): Record<number, string[]> {
    const tags: Record<number, string[]> = {};

    const addTag = (localId: number | null | undefined, tag: string) => {
      if (!localId) return;
      const id = Number(localId);
      tags[id] = tags[id] ?? [];
      if (!tags[id].includes(tag)) tags[id].push(tag);
    };

    data.locales?.forEach   ((l: any) => addTag(l.id,                             'Local'));
    data.productos?.forEach ((p: any) => addTag(p.local_id ?? p.local?.id,        `Producto: ${p.nombre}`));
    data.servicios?.forEach ((s: any) => addTag(s.local_id ?? s.local?.id,        `Servicio: ${s.nombre}`));
    data.mapa_objetos?.forEach((o: any) => addTag(o.local_id ?? o.local?.id,      this.etiquetaTipo(o.tipo)));

    return tags;
  }

}
