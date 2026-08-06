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

const DEFAULT_CENTER: L.LatLngExpression = [30.0444, 31.2357]; // Cairo
const DEFAULT_ZOOM = 14;

/** Leaflet default marker icons break under Angular bundling — use copied public assets. */
const markerIcon = L.icon({
  iconUrl: 'leaflet/marker-icon.png',
  iconRetinaUrl: 'leaflet/marker-icon-2x.png',
  shadowUrl: 'leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

@Component({
  selector: 'app-geofence-map-picker',
  standalone: true,
  template: `
    <div class="picker" dir="rtl">
      <p class="hint">
        اضغط على الخريطة لتحديد موقع الفرع. الدائرة توضح نطاق تسجيل دخول المندوبين.
      </p>
      <div class="actions">
        <button type="button" class="btn" (click)="useMyLocation()" [disabled]="locating()">
          {{ locating() ? 'جارٍ تحديد موقعك…' : 'موقعي الحالي' }}
        </button>
        <button type="button" class="btn ghost" (click)="clearPin()" [disabled]="!hasPin()">
          مسح الموقع
        </button>
      </div>
      <div #mapHost class="map" role="application" aria-label="خريطة موقع الفرع"></div>
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
    .map {
      height: 16rem;
      width: 100%;
      border-radius: 0.85rem;
      border: 1px solid var(--border, #e2e8f0);
      overflow: hidden;
      z-index: 0;
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
  readonly lat = input<number | null>(null);
  readonly lng = input<number | null>(null);
  readonly radiusMeters = input<number>(150);
  readonly positionChange = output<{ lat: number; lng: number }>();
  readonly cleared = output<void>();

  private readonly mapHost =
    viewChild.required<ElementRef<HTMLDivElement>>('mapHost');

  protected readonly locating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly hasPin = signal(false);

  private map?: L.Map;
  private marker?: L.Marker;
  private circle?: L.Circle;
  private ready = false;
  private skipNextInputSync = false;

  constructor() {
    effect(() => {
      const lat = this.lat();
      const lng = this.lng();
      const radius = this.radiusMeters() || 150;
      if (!this.ready || !this.map) return;

      if (this.skipNextInputSync) {
        this.skipNextInputSync = false;
        this.syncCircleRadius(radius);
        return;
      }

      if (lat != null && lng != null) {
        this.setPin(lat, lng, false);
        this.map.setView([lat, lng], Math.max(this.map.getZoom(), DEFAULT_ZOOM));
      } else {
        this.removePinVisual();
      }
      this.syncCircleRadius(radius);
    });
  }

  ngAfterViewInit(): void {
    const el = this.mapHost().nativeElement;
    const startLat = this.lat();
    const startLng = this.lng();
    const center: L.LatLngExpression =
      startLat != null && startLng != null
        ? [startLat, startLng]
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
      this.setPin(e.latlng.lat, e.latlng.lng, true);
    });

    this.ready = true;
    if (startLat != null && startLng != null) {
      this.setPin(startLat, startLng, false);
    }
    this.syncCircleRadius(this.radiusMeters() || 150);

    // Drawer animation / overlay: invalidate size after paint.
    queueMicrotask(() => this.map?.invalidateSize());
    setTimeout(() => this.map?.invalidateSize(), 200);
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = undefined;
    this.marker = undefined;
    this.circle = undefined;
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
        const { latitude, longitude } = pos.coords;
        this.map?.setView([latitude, longitude], 16);
        this.setPin(latitude, longitude, true);
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

  protected clearPin(): void {
    this.removePinVisual();
    this.cleared.emit();
  }

  private setPin(lat: number, lng: number, emit: boolean): void {
    if (!this.map) return;
    const latlng: L.LatLngExpression = [lat, lng];
    if (!this.marker) {
      this.marker = L.marker(latlng, { icon: markerIcon, draggable: true }).addTo(
        this.map,
      );
      this.marker.on('dragend', () => {
        const p = this.marker!.getLatLng();
        this.syncCircleCenter(p.lat, p.lng);
        this.emitPosition(p.lat, p.lng);
      });
    } else {
      this.marker.setLatLng(latlng);
    }
    this.syncCircleCenter(lat, lng);
    this.hasPin.set(true);
    if (emit) this.emitPosition(lat, lng);
  }

  private emitPosition(lat: number, lng: number): void {
    this.skipNextInputSync = true;
    this.positionChange.emit({ lat, lng });
  }

  private removePinVisual(): void {
    this.marker?.remove();
    this.circle?.remove();
    this.marker = undefined;
    this.circle = undefined;
    this.hasPin.set(false);
  }

  private syncCircleCenter(lat: number, lng: number): void {
    if (!this.map) return;
    const radius = this.radiusMeters() || 150;
    if (!this.circle) {
      this.circle = L.circle([lat, lng], {
        radius,
        color: '#10b880',
        fillColor: '#10b880',
        fillOpacity: 0.18,
        weight: 2,
      }).addTo(this.map);
    } else {
      this.circle.setLatLng([lat, lng]);
      this.circle.setRadius(radius);
    }
  }

  private syncCircleRadius(radius: number): void {
    this.circle?.setRadius(radius);
  }
}
