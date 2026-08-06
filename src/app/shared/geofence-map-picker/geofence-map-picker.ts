import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import * as L from 'leaflet';

export type GeofencePoint = { lat: number; lng: number };

const DEFAULT_CENTER: L.LatLngExpression = [30.0444, 31.2357];
const DEFAULT_ZOOM = 15;

const POLY_STYLE: L.PolylineOptions = {
  color: '#10b880',
  weight: 3,
  fillColor: '#10b880',
  fillOpacity: 0.22,
};

/** Leaflet default marker icons break under Angular bundling — use copied public assets. */
const locationPinIcon = L.icon({
  iconUrl: 'leaflet/marker-icon.png',
  iconRetinaUrl: 'leaflet/marker-icon-2x.png',
  shadowUrl: 'leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

@Component({
  selector: 'app-geofence-map-picker',
  standalone: true,
  template: `
    <div class="picker" dir="rtl">
      <p class="hint">
        ابدأ بكتابة العنوان واختر من القائمة للانتقال على الخريطة، أو استخدم موقعك الحالي،
        ثم ارسم حدود موقع العمل.
      </p>

      <div class="search">
        <input
          type="search"
          [value]="addressQuery()"
          (input)="onAddressInput($any($event.target).value)"
          (focus)="onAddressFocus()"
          placeholder="اكتب العنوان أو اسم المكان…"
          aria-label="بحث بالعنوان"
          aria-autocomplete="list"
          autocomplete="off"
        />
        @if (searching()) {
          <span class="search-hint">جارٍ البحث…</span>
        }
        @if (searchResults().length > 0) {
          <ul class="results" role="listbox">
            @for (hit of searchResults(); track hit.place_id) {
              <li>
                <button type="button" (mousedown)="$event.preventDefault()" (click)="goToResult(hit)">
                  {{ hit.display_name }}
                </button>
              </li>
            }
          </ul>
        }
      </div>

      <div class="actions">
        <button type="button" class="btn" (click)="useMyLocation()" [disabled]="locating()">
          {{ locating() ? 'جارٍ تحديد موقعك…' : 'موقعي الحالي' }}
        </button>
        @if (drawing() && draftCount() >= 3) {
          <button type="button" class="btn" (click)="finishDrawing()">إنهاء الرسم</button>
        }
        <button
          type="button"
          class="btn ghost"
          (click)="clearAll()"
          [disabled]="!hasShape() && draftCount() === 0"
        >
          مسح الرسم
        </button>
      </div>
      @if (drawing()) {
        <p class="status">
          نقاط مرسومة: {{ draftCount() }}
          @if (draftCount() < 3) {
            — أضف {{ 3 - draftCount() }} على الأقل
          } @else {
            — جاهز للإنهاء
          }
        </p>
      } @else if (hasShape()) {
        <p class="status ok">تم رسم نطاق العمل · يمكنك سحب النقاط للتعديل</p>
      }
      <div #mapHost class="map" role="application" aria-label="رسم نطاق موقع الفرع"></div>
      @if (error()) {
        <p class="err">{{ error() }}</p>
      }
    </div>
  `,
  styles: `
    .picker {
      display: grid;
      gap: 0.65rem;
    }
    .hint {
      margin: 0;
      font-size: 0.82rem;
      color: var(--ink-muted, #64748b);
      line-height: 1.45;
    }
    .search {
      position: relative;
      display: grid;
      gap: 0.35rem;
    }
    .search input {
      min-height: 2.4rem;
      border: 1.5px solid var(--border, #e2e8f0);
      border-radius: 0.65rem;
      padding: 0.4rem 0.75rem;
      font: inherit;
      background: var(--input-bg, #fff);
      color: var(--ink, #0f172a);
    }
    .search-hint {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--ink-muted, #64748b);
    }
    .results {
      list-style: none;
      margin: 0;
      padding: 0;
      max-height: 11rem;
      overflow: auto;
      border: 1px solid var(--border, #e2e8f0);
      border-radius: 0.75rem;
      background: var(--surface, #fff);
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
      z-index: 5;
    }
    .results li + li {
      border-top: 1px solid var(--border, #e2e8f0);
    }
    .results button {
      width: 100%;
      border: 0;
      background: transparent;
      text-align: start;
      padding: 0.65rem 0.8rem;
      font: inherit;
      font-size: 0.82rem;
      line-height: 1.35;
      color: var(--ink, #0f172a);
      cursor: pointer;
    }
    .results button:hover {
      background: var(--accent-soft, rgba(16, 184, 128, 0.12));
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .btn {
      min-height: 2.25rem;
      border: 0;
      border-radius: 0.65rem;
      padding: 0 0.85rem;
      background: var(--accent, #10b880);
      color: #fff;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn.ghost {
      background: transparent;
      color: var(--ink, #0f172a);
      border: 1.5px solid var(--border, #e2e8f0);
    }
    .status {
      margin: 0;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--ink-muted, #64748b);
    }
    .status.ok {
      color: #0d9a6a;
    }
    .map {
      height: 22rem;
      width: 100%;
      border-radius: 0.85rem;
      border: 1px solid var(--border, #e2e8f0);
      overflow: hidden;
      z-index: 0;
      cursor: crosshair;
    }
    .err {
      margin: 0;
      font-size: 0.8rem;
      color: var(--danger, #991b1b);
      background: var(--danger-bg, #fef2f2);
      padding: 0.5rem 0.7rem;
      border-radius: 0.55rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeofenceMapPicker implements AfterViewInit, OnDestroy {
  readonly polygon = input<GeofencePoint[] | null>(null);
  /** Legacy circle fallback for older branches without a drawn polygon. */
  readonly legacyLat = input<number | null>(null);
  readonly legacyLng = input<number | null>(null);
  readonly legacyRadiusMeters = input<number | null>(null);

  readonly polygonChange = output<GeofencePoint[]>();
  readonly cleared = output<void>();

  private readonly mapHost =
    viewChild.required<ElementRef<HTMLDivElement>>('mapHost');

  protected readonly locating = signal(false);
  protected readonly searching = signal(false);
  protected readonly addressQuery = signal('');
  protected readonly searchResults = signal<NominatimHit[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly drawing = signal(true);
  protected readonly draftCount = signal(0);
  protected readonly hasShape = signal(false);

  private map?: L.Map;
  private draftLine?: L.Polyline;
  private polygonLayer?: L.Polygon;
  private locationPin?: L.Marker;
  private vertexMarkers: L.CircleMarker[] = [];
  private draftPoints: L.LatLng[] = [];
  private ready = false;
  private skipNextInputSync = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchAbort?: AbortController;
  private searchSeq = 0;

  constructor() {
    effect(() => {
      const poly = this.polygon();
      if (!this.ready || !this.map) return;
      if (this.skipNextInputSync) {
        this.skipNextInputSync = false;
        return;
      }
      if (poly && poly.length >= 3) {
        this.showFinishedPolygon(poly.map((p) => L.latLng(p.lat, p.lng)), false);
      } else {
        this.showLegacyOrEmpty();
      }
    });
  }

  ngAfterViewInit(): void {
    const el = this.mapHost().nativeElement;
    const poly = this.polygon();
    const legacyLat = this.legacyLat();
    const legacyLng = this.legacyLng();
    const center: L.LatLngExpression =
      poly && poly.length
        ? [poly[0].lat, poly[0].lng]
        : legacyLat != null && legacyLng != null
          ? [legacyLat, legacyLng]
          : DEFAULT_CENTER;

    this.map = L.map(el, {
      center,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (!this.drawing()) return;
      this.addDraftPoint(e.latlng);
    });

    this.ready = true;
    if (poly && poly.length >= 3) {
      this.showFinishedPolygon(poly.map((p) => L.latLng(p.lat, p.lng)), false);
    } else {
      this.showLegacyOrEmpty();
    }

    queueMicrotask(() => this.map?.invalidateSize());
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchAbort?.abort();
    this.locationPin?.remove();
    this.locationPin = undefined;
    this.clearLayers();
    this.map?.remove();
    this.map = undefined;
  }

  protected useMyLocation(): void {
    if (!navigator.geolocation) {
      this.error.set('المتصفح لا يدعم تحديد الموقع');
      return;
    }
    this.locating.set(true);
    this.error.set(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating.set(false);
        const latlng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        this.map?.setView(latlng, 17);
        this.setLocationPin(latlng, 'موقعك الحالي');
      },
      (err) => {
        this.locating.set(false);
        this.error.set(
          err.code === 1
            ? 'يجب السماح بالوصول للموقع'
            : 'تعذر تحديد موقعك. حاول مرة أخرى',
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  protected onAddressInput(value: string): void {
    this.addressQuery.set(value);
    this.error.set(null);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const q = value.trim();
    if (q.length < 3) {
      this.searchAbort?.abort();
      this.searching.set(false);
      this.searchResults.set([]);
      return;
    }
    this.searchTimer = setTimeout(() => {
      void this.fetchSuggestions(q);
    }, 350);
  }

  protected onAddressFocus(): void {
    if (this.searchResults().length === 0 && this.addressQuery().trim().length >= 3) {
      void this.fetchSuggestions(this.addressQuery().trim());
    }
  }

  protected async fetchSuggestions(q: string): Promise<void> {
    this.searchAbort?.abort();
    const abort = new AbortController();
    this.searchAbort = abort;
    const seq = ++this.searchSeq;
    this.searching.set(true);
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('q', q);
      url.searchParams.set('limit', '6');
      url.searchParams.set('addressdetails', '0');
      const res = await fetch(url.toString(), {
        signal: abort.signal,
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'ar,en',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const hits = (await res.json()) as NominatimHit[];
      if (seq !== this.searchSeq) return;
      this.searchResults.set(hits);
      if (!hits.length) {
        this.error.set('لا توجد نتائج مطابقة');
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      if (seq !== this.searchSeq) return;
      this.searchResults.set([]);
      this.error.set('تعذر البحث عن العنوان. حاول مرة أخرى');
    } finally {
      if (seq === this.searchSeq) this.searching.set(false);
    }
  }

  protected goToResult(hit: NominatimHit): void {
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !this.map) return;
    const latlng = L.latLng(lat, lng);
    this.map.setView(latlng, 17);
    this.setLocationPin(latlng, hit.display_name);
    this.addressQuery.set(hit.display_name);
    this.searchResults.set([]);
    this.error.set(null);
  }

  private setLocationPin(latlng: L.LatLng, label: string): void {
    if (!this.map) return;
    if (!this.locationPin) {
      this.locationPin = L.marker(latlng, {
        icon: locationPinIcon,
        zIndexOffset: 1000,
        title: label,
      }).addTo(this.map);
    } else {
      this.locationPin.setLatLng(latlng);
    }
    this.locationPin.unbindPopup();
    this.locationPin.bindPopup(label).openPopup();
  }

  protected finishDrawing(): void {
    if (this.draftPoints.length < 3) {
      this.error.set('يحتاج الرسم إلى 3 نقاط على الأقل');
      return;
    }
    this.error.set(null);
    this.showFinishedPolygon([...this.draftPoints], true);
  }

  protected clearAll(): void {
    this.clearLayers();
    this.draftPoints = [];
    this.draftCount.set(0);
    this.drawing.set(true);
    this.hasShape.set(false);
    this.cleared.emit();
  }

  private addDraftPoint(latlng: L.LatLng): void {
    this.draftPoints.push(latlng);
    this.draftCount.set(this.draftPoints.length);
    this.error.set(null);
    this.redrawDraft();
  }

  private redrawDraft(): void {
    if (!this.map) return;
    this.draftLine?.remove();
    this.clearVertexMarkers();
    if (this.draftPoints.length === 0) return;

    this.draftLine = L.polyline(this.draftPoints, {
      ...POLY_STYLE,
      dashArray: '6 6',
      fill: false,
    }).addTo(this.map);

    this.vertexMarkers = this.draftPoints.map((p) =>
      L.circleMarker(p, {
        radius: 5,
        color: '#0d9a6a',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2,
      }).addTo(this.map!),
    );
  }

  private showFinishedPolygon(points: L.LatLng[], emit: boolean): void {
    if (!this.map || points.length < 3) return;
    this.clearLayers();
    this.draftPoints = [];
    this.draftCount.set(0);
    this.drawing.set(false);
    this.hasShape.set(true);

    this.polygonLayer = L.polygon(points, POLY_STYLE).addTo(this.map);
    this.vertexMarkers = points.map((p, index) => {
      const marker = L.circleMarker(p, {
        radius: 6,
        color: '#0d9a6a',
        fillColor: '#fff',
        fillOpacity: 1,
        weight: 2,
      }).addTo(this.map!);

      // CircleMarker isn't draggable by default — use drag via map events on mousedown
      marker.on('mousedown', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        const onMove = (ev: L.LeafletMouseEvent) => {
          marker.setLatLng(ev.latlng);
          const latlngs = this.vertexMarkers.map((m) => m.getLatLng());
          this.polygonLayer?.setLatLngs(latlngs);
        };
        const onUp = () => {
          this.map?.off('mousemove', onMove);
          this.map?.off('mouseup', onUp);
          this.emitPolygonFromMarkers();
        };
        this.map?.on('mousemove', onMove);
        this.map?.on('mouseup', onUp);
      });

      // keep index referenced for clarity
      void index;
      return marker;
    });

    try {
      this.map.fitBounds(this.polygonLayer.getBounds().pad(0.2));
    } catch {
      /* ignore empty bounds */
    }

    if (emit) this.emitPolygonFromMarkers();
  }

  private showLegacyOrEmpty(): void {
    this.clearLayers();
    this.draftPoints = [];
    this.draftCount.set(0);
    this.drawing.set(true);
    this.hasShape.set(false);

    const lat = this.legacyLat();
    const lng = this.legacyLng();
    const radius = this.legacyRadiusMeters();
    if (lat != null && lng != null && radius != null && radius > 0 && this.map) {
      // Soft hint for old circle geofences — admin should redraw as a polygon.
      L.circle([lat, lng], {
        radius,
        color: '#94a3b8',
        dashArray: '4 6',
        fillOpacity: 0.08,
        weight: 2,
      }).addTo(this.map);
      this.map.setView([lat, lng], Math.max(this.map.getZoom(), DEFAULT_ZOOM));
      this.error.set('هذا الفرع يستخدم نطاقاً دائرياً قديماً — ارسم الشكل الجديد فوق الخريطة');
    }
  }

  private emitPolygonFromMarkers(): void {
    const points = this.vertexMarkers.map((m) => {
      const p = m.getLatLng();
      return { lat: p.lat, lng: p.lng };
    });
    if (points.length < 3) return;
    this.skipNextInputSync = true;
    this.polygonChange.emit(points);
  }

  private clearVertexMarkers(): void {
    for (const m of this.vertexMarkers) m.remove();
    this.vertexMarkers = [];
  }

  private clearLayers(): void {
    this.draftLine?.remove();
    this.draftLine = undefined;
    this.polygonLayer?.remove();
    this.polygonLayer = undefined;
    this.clearVertexMarkers();
    // Remove any leftover legacy circles
    this.map?.eachLayer((layer) => {
      if (layer instanceof L.Circle && !(layer instanceof L.CircleMarker)) {
        this.map?.removeLayer(layer);
      }
    });
  }
}

interface NominatimHit {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}
